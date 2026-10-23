import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import postgres from 'postgres';
import { chromium } from 'playwright';

const baseURL = process.env.TRAINING_TEST_URL ?? process.env.BETTER_AUTH_URL;
assert.equal(process.env.TRAINING_QA_DISPOSABLE, '1');
for (const value of [baseURL, process.env.DATABASE_URL]) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname));
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const output = process.env.TRAINING_SCREENSHOT_DIR ?? 'test-results/training'; await mkdir(output, { recursive: true });
const ids = []; const errors = [];
// Same shape as src/features/ips/test-fixtures.ts: band rule ±5 p. b. around 80 % invested, 2 500,25 Kč a month.
const ips = { schemaVersion: 2, goals: [{ label: 'Důchod', purpose: 'retirement', horizonMonths: 360, priority: 'important' }],
  foundation: { emergencyFund: 'building', highCostDebt: 'none' }, allocation: { lines: [{ instrumentId: 'IE-XETR:VWCE', weightBps: 8000 }], cashBps: 2000 },
  instruments: ['Široké ETF'], platform: 'Fiktivní broker', contribution: { amountMinor: '250025', dayOfMonth: 15 }, rebalancing: { mode: 'band', bandBps: 500 },
  drawdownRule: { action: 'keep_plan', text: 'Přečtu si cíle před každým rozhodnutím.' }, checkFrequency: 'quarterly', reviewMonth: 10,
  changeReason: 'První verze mého plánu.', signedAt: '2026-10-21T12:00:00.000Z' };
// The chart's ResponsiveContainer resizes on a ResizeObserver tick, so let layout settle before judging overflow.
const overflow = (page) => page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 3000 }).then(() => false, () => true);
const idle = (page) => page.locator('main[data-save-state="idle"]').waitFor();
try {
  const context = await browser.newContext({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
  const signup = await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: 'Training QA', email: `training-${randomUUID()}@example.com`, password: randomUUID() } });
  assert.ok(signup.ok(), await signup.text()); const owner = (await signup.json()).user; ids.push(owner.id);
  await sql`insert into learning_profile(user_id,experience_level,goals,interests,daily_goal_minutes,time_zone,onboarding_completed_at) values (${owner.id},'BEGINNER','{}','{}',10,'Europe/Prague',now())`;
  const protectedRows = async () => ({ portfolios: await sql`select * from portfolio where user_id=${owner.id}`, awards: await sql`select * from lesson_award where user_id=${owner.id}`, unlocks: await sql`select * from progression_unlock where user_id=${owner.id}` });
  const before = await protectedRows();

  await page.goto(`${baseURL}/lab`); await page.getByRole('link', { name: 'Krizový nácvik', exact: true }).click();
  await page.getByRole('heading', { name: 'Nejdřív investiční plán' }).waitFor();
  await sql`insert into learner_artifact(id,user_id,kind,version,payload,request_id) values (${randomUUID()},${owner.id},'investment_plan',1,${sql.json(ips)},${randomUUID()})`;
  await page.reload();
  // Keyboard only: radio group, then submit.
  const model = page.getByRole('radio', { name: /Modelová krize/ });
  await model.focus(); assert.equal(await model.isChecked(), true);
  await page.keyboard.press('ArrowDown'); assert.equal(await page.getByRole('radio', { name: /Pandemie 2020/ }).isChecked(), true);
  await page.keyboard.press('ArrowUp'); assert.equal(await model.isChecked(), true);
  await page.route('**/lab/training', (route) => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.getByRole('button', { name: 'Začít nácvik' }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('alert').filter({ hasText: 'Připojení selhalo' }).waitFor();
  await page.unroute('**/lab/training');
  // The pending button was disabled, so focus returns to it before the keyboard retry.
  await page.getByRole('button', { name: 'Začít nácvik' }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: /Modelová krize · Měsíc 0/ }).waitFor();
  assert.equal(await overflow(page), false, 'overflow at 320 px');
  assert.ok(await page.getByText('Modelový scénář: vymyšlená řada').isVisible());
  assert.equal((await sql`select * from training_session where user_id=${owner.id}`).length, 1);
  console.log('PASS: IPS required first, keyboard scenario choice, network failure then retry starts exactly one session, 320 px without overflow.');

  await page.getByLabel('Koupit za částku v Kč').fill('80000,50'); await page.keyboard.press('Enter');
  await page.getByRole('status').filter({ hasText: 'Nakoupeno za' }).waitFor(); await idle(page);
  const [buy] = await sql`select * from training_action where session_id=(select id from training_session where user_id=${owner.id})`;
  assert.equal(buy.kind, 'buy'); assert.equal(buy.amount_minor, '8000050');
  const next = page.getByRole('button', { name: 'Pokračovat na další měsíc' });
  for (let month = 1; month <= 6; month++) { await next.focus(); await page.keyboard.press('Enter'); await page.getByRole('heading', { name: new RegExp(`Měsíc ${month} \\(`) }).waitFor(); await idle(page); }
  assert.ok(await page.getByText(/Index scénáře: 70/).isVisible());

  // A second tab moves on; the first tab's stale action is refused and catches up.
  const other = await context.newPage(); await other.goto(`${baseURL}/lab/training`);
  await other.getByRole('button', { name: 'Pokračovat na další měsíc' }).click(); await other.getByRole('heading', { name: /Měsíc 7 \(/ }).waitFor();
  await page.getByLabel(/Prodat podíly/).fill('1'); await page.keyboard.press('Enter');
  await page.getByRole('alert').filter({ hasText: 'posunul' }).waitFor();
  await page.getByRole('heading', { name: /Měsíc 7 \(/ }).waitFor(); await other.close();
  // Panic sale at month 7 against a "keep the plan" IPS.
  const held = await page.getByLabel(/Prodat podíly/).evaluate((input) => input.labels[0].textContent.match(/máš ([\d\s,]+)/)[1]);
  await page.getByLabel(/Prodat podíly/).fill(held.replace(/\s/g, '')); await page.keyboard.press('Enter');
  await page.getByRole('status').filter({ hasText: 'Prodej zaznamenán' }).waitFor(); await idle(page);
  assert.ok(await page.getByText('mimo pravidla plánu').isVisible());
  console.log('PASS: exact CZK buy amount, keyboard month steps, stale second tab refused and refreshed, sale recorded outside the plan.');

  for (let month = 8; month < 24; month++) { await next.click(); await page.getByRole('heading', { name: new RegExp(`Měsíc ${month} \\(`) }).waitFor(); await idle(page); }
  await page.getByRole('button', { name: 'Dokončit poslední měsíc' }).click();
  await page.getByRole('heading', { name: 'Vyhodnocení podle tvého plánu' }).waitFor();
  const facts = await page.locator('dl').last().innerText();
  assert.match(facts, /Prodeje mimo pravidla plánu\s+1/);
  assert.match(facts, /Časově vážený výnos \(TWR\)\s+[+−-]/);
  assert.match(facts, /Peněžně vážený výnos \(MWR\)\s+[+−-]/);
  assert.match(facts, /Největší propad indexu\s+−30/);
  await page.reload(); await page.getByRole('heading', { name: 'Vyhodnocení podle tvého plánu' }).waitFor();
  assert.equal(await page.locator('dl').last().innerText(), facts, 'the evaluation replays identically after reload');
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 900 }); assert.equal(await overflow(page), false, `overflow at ${width}`); }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await overflow(page), false, 'overflow at 320 px / 200 % text');
  await page.screenshot({ path: `${output}/evaluation-320-200.png`, fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  assert.deepEqual(await protectedRows(), before, 'training creates no portfolio, reward or unlock');
  assert.deepEqual(errors, []);
  console.log('PASS: evaluation (IPS rule, TWR, MWR, drawdown) after the last month, identical after reload, no overflow up to 200 % text, personal portfolio and rewards untouched.');
} finally {
  if (ids.length) await sql`delete from "user" where id in ${sql(ids)}`;
  await browser.close(); await sql.end();
}
