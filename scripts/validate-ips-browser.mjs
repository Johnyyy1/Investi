import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { chromium } from 'playwright';

const baseURL = process.env.IPS_TEST_URL ?? process.env.BETTER_AUTH_URL;
assert.equal(process.env.IPS_QA_DISPOSABLE, '1');
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/investi_artifacts_qa');
for (const value of [baseURL, process.env.DATABASE_URL]) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname));
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const ids = []; const errors = []; const expectedRouteErrors = []; let checkingRecovery = false;
const output = 'test-results/ips'; await mkdir(output, { recursive: true });
const goal = { label: 'Dlouhodobý cíl z mapy', purpose: 'retirement', horizonMonths: 360, priority: 'important' };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.on('pageerror', error => (checkingRecovery ? expectedRouteErrors : errors).push(error.message));
  const signup = await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: 'IPS QA', email: `ips-${randomUUID()}@example.com`, password: randomUUID() } });
  assert.ok(signup.ok(), await signup.text()); const owner = (await signup.json()).user; ids.push(owner.id);
  await sql`insert into learning_profile(user_id,experience_level,goals,interests,daily_goal_minutes,time_zone,onboarding_completed_at) values (${owner.id},'BEGINNER','{}','{}',10,'Europe/Prague',now())`;
  await sql`insert into learner_artifact(id,user_id,kind,version,payload,request_id) values (${randomUUID()},${owner.id},'goal_map',1,${sql.json({ goals: [goal] })},${randomUUID()})`;
  await page.goto(`${baseURL}/lab`); await page.getByRole('link', { name: 'Můj investiční plán (IPS)' }).click();
  await page.getByRole('heading', { name: 'Můj investiční plán', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Název cíle 1', { exact: true }).inputValue(), goal.label);
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  const save = page.getByRole('button', { name: 'Uložit verzi plánu', exact: true }); assert.equal(await save.isDisabled(), true);
  // Selecting a planning instrument is available before Lab unlock and creates no order.
  await page.getByLabel('Pohotovostní rezerva', { exact: true }).selectOption('building');
  await page.getByLabel('Drahý dluh', { exact: true }).selectOption('none');
  await page.route('**/lab/plan', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.getByRole('combobox', { name: 'Přidat konkrétní instrument' }).fill('VWCE');
  await page.getByRole('alert').filter({ hasText: 'Hledání se nepodařilo' }).waitFor();
  assert.equal(await page.getByLabel('Název cíle 1', { exact: true }).inputValue(), goal.label);
  await page.unroute('**/lab/plan');
  await page.getByRole('combobox', { name: 'Přidat konkrétní instrument' }).fill('');
  await page.getByRole('combobox', { name: 'Přidat konkrétní instrument' }).fill('VWCE');
  await page.getByRole('option').filter({ hasText: 'VWCE' }).waitFor();
  await page.getByRole('combobox', { name: 'Přidat konkrétní instrument' }).focus(); await page.keyboard.press('Enter');
  await page.getByLabel('Váha položky 1 v %', { exact: true }).fill('80');
  await page.getByLabel('Cílová hotovost v %', { exact: true }).fill('20');
  await page.getByLabel('Zvolené nástroje a proč (jeden na řádek)', { exact: true }).fill('Široké ETF pro můj dlouhodobý cíl');
  await page.getByLabel('Zvolená platforma nebo co ještě ověřím', { exact: true }).fill('Fiktivní platforma pro výuku');
  await page.getByLabel('Měsíční částka v Kč', { exact: true }).fill('0,25');
  await page.getByLabel('Den v měsíci (1–28)', { exact: true }).fill('15');
  await page.getByLabel('Způsob rebalancingu', { exact: true }).selectOption('band');
  await page.getByLabel('Pásmo odchylky v procentních bodech', { exact: true }).fill('5');
  await page.getByLabel('Akce při propadu', { exact: true }).selectOption('keep_plan');
  await page.getByLabel('Co při propadu udělám a co si ověřím', { exact: true }).fill('Nejdřív zkontroluji cíle a finanční rezervu.');
  await page.getByLabel('Jak často portfolio zkontroluji', { exact: true }).selectOption('quarterly');
  await page.getByLabel('Měsíc přezkumu celého plánu', { exact: true }).selectOption('10');
  await page.getByLabel('Proč tento plán ukládám nebo měním', { exact: true }).fill('První plán pro vlastní rozhodování.');
  await page.getByRole('checkbox').focus(); await page.keyboard.press('Space');
  await page.route('**/lab/plan', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await save.click(); await page.getByRole('alert').filter({ hasText: 'Připojení' }).waitFor();
  assert.equal(await page.getByLabel('Měsíční částka v Kč', { exact: true }).inputValue(), '0,25');
  await page.unroute('**/lab/plan');
  await save.click(); await page.getByRole('status').filter({ hasText: 'Verze 1.' }).waitFor();
  await save.click(); await page.getByRole('status').filter({ hasText: 'Verze 1.' }).waitFor();
  assert.equal((await sql`select * from learner_artifact where user_id=${owner.id} and kind='investment_plan'`).length, 1);
  assert.equal((await sql`select * from portfolio where user_id=${owner.id}`).length, 0);
  assert.equal((await sql`select * from learner_artifact where user_id=${owner.id} and kind='investment_plan'`)[0].payload.contribution.amountMinor, '25');
  await page.reload(); assert.equal(await page.getByLabel('Měsíční částka v Kč', { exact: true }).inputValue(), '0.25');
  console.log('PASS: entry before Lab unlock, goal-map reuse, keyboard search/consent, network retry, exact decimal persistence, idempotent save and refresh.');

  await sql`insert into progression_unlock(user_id,unlock_id,practice_capital_minor,reason,unlocked_at) values (${owner.id},'PORTFOLIO_LAB',500000,'legacy',now())`;
  await page.goto(`${baseURL}/lab/portfolio`); await page.getByRole('link', { name: 'Můj investiční plán (IPS)' }).click();
  const protectedRows = async () => ({ trades: await sql`select * from portfolio_trade where portfolio_id in (select id from portfolio where user_id=${owner.id})`, awards: await sql`select * from lesson_award where user_id=${owner.id}`, unlocks: await sql`select * from progression_unlock where user_id=${owner.id}` });
  const before = await protectedRows();
  const apply = page.getByRole('button', { name: 'Použít alokaci IPS jako cílový mix', exact: true });
  await apply.click(); await page.getByRole('status').filter({ hasText: 'Žádný obchod se neprovedl' }).waitFor();
  await apply.click(); await page.getByRole('status').filter({ hasText: 'Žádný obchod se neprovedl' }).waitFor();
  const targets = await sql`select * from portfolio_allocation where portfolio_id in (select id from portfolio where user_id=${owner.id})`;
  assert.equal(targets.length, 1); assert.equal(targets[0].cash_weight_basis_points, 2000);
  assert.deepEqual(await protectedRows(), before);
  await page.getByLabel('Měsíční částka v Kč', { exact: true }).fill('1.3333');
  assert.equal(await apply.isDisabled(), true);
  assert.equal(await page.getByLabel('Proč tento plán ukládám nebo měním', { exact: true }).inputValue(), '');
  await page.getByLabel('Proč tento plán ukládám nebo měním', { exact: true }).fill('Změna pravidelné částky.');
  await page.getByRole('checkbox').check();
  await save.click(); await page.getByRole('alert').filter({ hasText: 'dvěma desetinnými' }).waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'alert');
  assert.equal(await page.getByRole('alert').filter({ hasText: 'dvěma desetinnými' }).evaluate(el => el === document.activeElement), true);
  assert.equal((await sql`select * from learner_artifact where user_id=${owner.id} and kind='investment_plan'`).length, 1);
  await page.getByLabel('Měsíční částka v Kč', { exact: true }).fill('1,33');
  await save.focus(); await page.keyboard.press('Enter'); await page.getByRole('status').filter({ hasText: 'Verze 2.' }).waitFor();
  const row = (await sql`select * from learner_artifact where user_id=${owner.id} and kind='investment_plan' order by version desc`)[0];
  assert.equal(row.payload.contribution.amountMinor, '133');
  const older = page.getByText(/^Verze 1 ·/); await older.click();
  await page.getByText('0,25 Kč · den 15 v měsíci', { exact: true }).waitFor();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: 'Exportovat všechny verze (JSON)' }).click();
  const download = await downloadPromise; const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.deepEqual(exported.versions.map(v => v.version), [2, 1]); assert.equal(exported.versions[1].payload.contribution.amountMinor, '25');
  const accountExport = await context.request.get(`${baseURL}/api/account/export`); assert.ok(accountExport.ok());
  assert.equal((await accountExport.json()).learnerArtifacts.filter(a => a.kind === 'investment_plan').length, 2);
  console.log('PASS: target handoff without trades/rewards, retry idempotence, edit protection, exact validation/focus, required new rationale, history and both exports.');
  // Only this disposable owner's row is corrupted to exercise the real server-render fallback.
  // No application write path can persist this invalid payload.
  checkingRecovery = true;
  try {
    await sql`update learner_artifact set payload='{}'::jsonb where id=${row.id}`;
    await page.reload();
    await page.getByRole('heading', { name: 'Plán se teď nenačetl.', exact: true }).waitFor();
  } finally { await sql`update learner_artifact set payload=${sql.json(row.payload)} where id=${row.id}`; }
  await page.getByRole('button', { name: 'Zkusit znovu', exact: true }).click();
  await page.getByRole('heading', { name: 'Můj investiční plán', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Uložený plán · verze 2', exact: true }).waitFor();
  checkingRecovery = false;
  assert.ok(expectedRouteErrors.every(message => /Server Components render|digest/i.test(message)));
  console.log('PASS: real server-render failure recovers through the route retry without a manual reload.');


  for (const width of [1440, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'overflow at 320px / 200% text');
  await page.screenshot({ path: `${output}/plan-320-200.png`, fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  for (const [width, name] of [[1440, 'desktop'], [390, 'mobile']]) {
    await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    await page.screenshot({ path: `${output}/${name}-top.png` });
    await page.getByRole('heading', { name: /Uložený plán/ }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${name}-saved.png` });
  }
  await page.getByRole('button', { name: 'Smazat plán', exact: true }).click();
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('button', { name: 'Smazat plán', exact: true }).evaluate(el => el === document.activeElement), true);
  await page.getByRole('button', { name: 'Smazat plán', exact: true }).click();
  await page.getByRole('button', { name: 'Smazat všechny verze plánu', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('status').filter({ hasText: 'všechny jeho verze jsou smazané' }).waitFor();
  assert.equal((await sql`select * from learner_artifact where user_id=${owner.id} and kind='investment_plan'`).length, 0);
  assert.equal((await sql`select * from portfolio_allocation where portfolio_id in (select id from portfolio where user_id=${owner.id})`).length, 1);
  assert.equal(await page.getByRole('heading', { name: 'Můj investiční plán', exact: true }).evaluate(el => el === document.activeElement), true);
  await page.reload(); assert.equal(await page.getByRole('heading', { name: /Uložený plán/ }).count(), 0);
  console.log('PASS: six responsive widths, 200% text, keyboard delete/cancel/focus return, all-version deletion and retained Lab audit.');

  const guestContext = await browser.newContext();
  const response = await guestContext.request.post(`${baseURL}/api/auth/sign-in/anonymous`, { headers: { origin: baseURL, 'x-investi-anonymous-kind': 'guest' }, data: {} });
  assert.ok(response.ok()); const guest = (await response.json()).user; ids.push(guest.id);
  await sql`insert into learning_profile(user_id,experience_level,goals,interests,daily_goal_minutes,time_zone,onboarding_completed_at) values (${guest.id},'BEGINNER','{}','{}',10,'Europe/Prague',now()) on conflict(user_id) do update set onboarding_completed_at=now()`;
  const guestPage = await guestContext.newPage(); await guestPage.goto(`${baseURL}/lab/plan`);
  await guestPage.getByRole('link', { name: 'Uložit účet', exact: true }).waitFor(); assert.equal(await guestPage.getByRole('button', { name: 'Uložit verzi plánu' }).count(), 0);
  assert.equal((await guestContext.request.get(`${baseURL}/api/ips/export`)).status(), 401);
  const anonymous = await browser.newContext(); assert.equal((await anonymous.request.get(`${baseURL}/api/ips/export`)).status(), 401); await anonymous.close();
  assert.deepEqual(errors, []); console.log('PASS: guest and unauthenticated access restrictions, no page errors.');
} finally {
  await browser.close(); if (ids.length) await sql`delete from "user" where id in ${sql(ids)}`; await sql.end();
}
