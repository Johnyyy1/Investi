// Isolated fixture runtime; source is restored byte-for-byte before exiting.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import postgres from 'postgres';
const dbURL = new URL(process.env.DATABASE_URL);
assert.equal(process.env.MISSIONS_QA_DISPOSABLE, '1');
assert.equal(dbURL.pathname, '/investi_missions_qa');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(dbURL.hostname));
const baseURL = process.env.BETTER_AUTH_URL;
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname));
const sql = postgres(dbURL.toString(), { prepare: false });
const files = ['src/features/lessons/registry.ts', 'src/features/lessons/steps.ts'];
const originals = await Promise.all(files.map((file) => readFile(file, 'utf8')));
const output = 'test-results/missions';
await mkdir(output, { recursive: true });
let server, browser, userId, log = '';
const errors = [];
try {
  await writeFile(files[0], originals[0] + '\nimport { missionPreviewBlocks } from "@/features/missions/test-fixtures";\nauthoredLessons.find(item => item.id === "foundations-portfolio")!.blocks = missionPreviewBlocks;\n');
  await writeFile(files[1], 'import { missionPreviewSteps } from "@/features/missions/test-fixtures";\n' + originals[1].replace('  if (!Object.hasOwn(stepDefinitions, lessonId))', '  if (lessonId === "foundations-portfolio") return missionPreviewSteps;\n  if (!Object.hasOwn(stepDefinitions, lessonId))'));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', new URL(baseURL).port], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [server.stdout, server.stderr]) stream.on('data', (chunk) => { log += chunk; });
  const deadline = Date.now() + 60000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(log);
    try { if ((await fetch(`${baseURL}/sign-in`)).ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, log);
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const response = await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: 'Mission QA', email: `mission-${randomUUID()}@example.com`, password: randomUUID() } });
  assert.ok(response.ok(), await response.text());
  userId = (await response.json()).user.id;
  await sql`insert into learning_profile(user_id,experience_level,goals,interests,daily_goal_minutes,time_zone,onboarding_completed_at) values(${userId},'BEGINNER','{}','{}',10,'Europe/Prague',now())`;
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const path = `${baseURL}/learn/investing-foundations/your-first-portfolio`;
  const primary = () => page.getByRole('button', { name: 'Pokračovat', exact: true });
  async function capture(target, name) {
    const hide = await target.addStyleTag({ content: 'nextjs-portal { display:none !important; }' });
    for (const width of [1440, 1024, 768, 390, 375, 320]) {
      await target.setViewportSize({ width, height: 1000 });
      assert.equal(await target.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflows at ${width}`);
      if ([1440, 390].includes(width)) await target.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true });
    }
    const zoom = await target.addStyleTag({ content: 'html { font-size:200% !important; }' });
    assert.equal(await target.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflows at 200%`);
    await zoom.evaluate((element) => element.remove()); await hide.evaluate((element) => element.remove());
    await target.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto(path);
  await page.getByRole('heading', { name: 'Rozlož oddělené portfolio podle čtyř pravidel.' }).waitFor();
  assert.ok(await primary().isDisabled());
  assert.equal(await page.getByRole("link", { name: /^Otevřít Portfolio Lab/ }).count(), 0, "an isolated mission must not send the learner to personal trading");
  await capture(page, 'mission-brief');
  await page.getByRole('button', { name: 'Ukázat modelový rozbor (misi tím nesplníš)' }).click();
  assert.ok(await primary().isDisabled(), 'sample analysis never satisfies the mission');
  await capture(page, 'mission-sample');
  await page.getByRole('button', { name: 'Zpět na zadání mise' }).click();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: /Otevřít oddělené cvičení/ }).click();
  const exercise = await popupPromise;
  exercise.on('pageerror', (error) => errors.push(error.message));
  const addWorld = exercise.getByRole('button', { name: 'Fond Svět: přidat 10 %', exact: true });
  await addWorld.waitFor();
  await addWorld.focus(); await exercise.keyboard.press('Enter');
  for (let i = 0; i < 7; i++) await addWorld.click();
  await exercise.getByRole('button', { name: 'Ne, nějaké nesplní', exact: true }).click();
  await capture(exercise, 'exercise-decision');
  await exercise.getByRole('button', { name: 'Zamknout rozhodnutí', exact: true }).click();
  await exercise.getByRole('status').filter({ hasText: 'Server ověřil všechna pravidla' }).waitFor();
  await capture(exercise, 'exercise-verified');
  assert.equal((await sql`select * from portfolio where user_id=${userId}`).length, 0);
  assert.equal((await sql`select * from lesson_award where user_id=${userId}`).length, 0);
  await page.getByRole('button', { name: 'Ověřit výsledek cvičení', exact: true }).click();
  await primary().waitFor({ state: 'visible' });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'Pokračovat' && !b.disabled));
  await page.reload();
  await page.getByRole('status').filter({ hasText: 'Mise už je ověřená' }).waitFor();
  assert.equal(await primary().isDisabled(), false);
  await capture(page, 'mission-verified');
  await primary().click();
  await page.getByRole('button', { name: 'Dokončit lekci', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('main[data-save-state]')?.dataset.saveState === 'idle');
  assert.equal((await sql`select last_position from lesson_progress where user_id=${userId} and lesson_id='foundations-portfolio'`)[0].last_position, 1);
  await page.getByRole('button', { name: 'Dokončit lekci', exact: true }).click();
  await page.getByText('Lekce dokončena', { exact: true }).first().waitFor();
  assert.equal((await sql`select * from lesson_award where user_id=${userId}`).length, 1);
  await page.goto(`${baseURL}/lab/missions/ips-etf-purchase-v1`);
  await page.getByRole('button', { name: 'Ověřit misi', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Zatím nemáš cvičný kapitál' }).waitFor();
  await capture(page, 'mission-no-capital');
  assert.deepEqual(errors, []);
  console.log(`PASS: lesson gating, sample bypass refusal, keyboard scenario decision, verified persistence/reload, completion, no capital guidance, isolation; widths 320–1440 + 200% text; screenshots in ${output}.`);
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await new Promise((resolve) => { server.once('exit', resolve); setTimeout(resolve, 5000); }); }
  await Promise.all(files.map((file, index) => writeFile(file, originals[index])));
  if (userId) await sql`delete from "user" where id=${userId}`;
  await sql.end();
}
