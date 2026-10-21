// A disposable runtime exercises the actual player/actions with temporary authored fixtures.
// Both source files are restored byte-for-byte in finally; no preview route ships to production.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import postgres from 'postgres';

const dbURL = new URL(process.env.DATABASE_URL);
assert.equal(process.env.ARTIFACTS_QA_DISPOSABLE, '1');
assert.equal(dbURL.pathname, '/investi_artifacts_qa');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(dbURL.hostname));
const baseURL = process.env.EXERCISES_TEST_URL ?? process.env.BETTER_AUTH_URL;
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname));
const sql = postgres(dbURL.toString(), { prepare: false });
const files = ['src/features/lessons/registry.ts', 'src/features/lessons/steps.ts'];
const originals = await Promise.all(files.map((file) => readFile(file, 'utf8')));
let server, browser, userId;
let log = '';
const errors = [];
const output = 'test-results/lesson-exercises';
await mkdir(output, { recursive: true });
try {
  await writeFile(files[0], originals[0] + '\nimport { exercisePreviewBlocks } from "./exercise-fixtures";\nauthoredLessons.find(item => item.id === "foundations-why-invest")!.blocks = exercisePreviewBlocks;\n');
  await writeFile(files[1], 'import { exercisePreviewSteps } from "./exercise-fixtures";\n' + originals[1].replace('  if (!Object.hasOwn(stepDefinitions, lessonId))', '  if (lessonId === "foundations-why-invest") return exercisePreviewSteps;\n  if (!Object.hasOwn(stepDefinitions, lessonId))'));
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
  const response = await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: 'Exercise QA', email: `exercise-${randomUUID()}@example.com`, password: randomUUID() } });
  assert.ok(response.ok(), await response.text());
  userId = (await response.json()).user.id;
  await sql`insert into learning_profile(user_id,experience_level,goals,interests,daily_goal_minutes,time_zone,onboarding_completed_at) values(${userId},'BEGINNER','{}','{}',10,'Europe/Prague',now())`;
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseURL}/learn/investing-foundations/why-invest`);
  await page.waitForLoadState('networkidle');
  const primary = () => page.getByRole('button', { name: 'Zkontrolovat odpověď', exact: true });
  const continueButton = () => page.getByRole('button', { name: 'Pokračovat', exact: true });
  async function selectWithKeys(locator, offset) {
    const option = locator.locator('option').nth(offset);
    const label = await option.textContent();
    // Native macOS headless selects support type-ahead, including repeated-letter cycling.
    const letter = label[0].toLowerCase();
    const before = (await locator.locator('option').allTextContents()).slice(0, offset + 1);
    const presses = before.filter((text) => text[0].toLowerCase() === letter).length;
    await locator.focus();
    for (let index = 0; index < presses; index++) await page.keyboard.press(letter);
    await page.keyboard.press('Tab');
    assert.equal(await locator.inputValue(), await option.getAttribute('value'));
  }
  async function capture(name) {
    const previewStyle = await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    for (const width of [1440, 1024, 768, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflows at ${width}`);
      if (width === 1440 || width === 390 || width === 320) await page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true });
    }
    const textStyle = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((element) => element.getBoundingClientRect().right > innerWidth + 1).map((element) => `${element.tagName}: ${element.textContent?.slice(0, 80)}`));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflows at 200% text: ${overflow.join(', ')}`);
    await textStyle.evaluate((element) => element.remove());
    await page.setViewportSize({ width: 1440, height: 1000 });
    await previewStyle.evaluate((element) => element.remove());
  }
  async function checkedContinue(nextPrompt) {
    await primary().click(); await page.getByRole('status').filter({ hasText: 'Správně' }).waitFor();
    await continueButton().click(); await page.getByRole('heading', { name: nextPrompt, exact: true }).first().waitFor();
    await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-save-state') === 'idle');
  }
  await page.getByRole('combobox').first().waitFor();
  assert.equal(await primary().isDisabled(), true);
  const combos = page.getByRole('combobox');
  await selectWithKeys(combos.nth(0), 2); await selectWithKeys(combos.nth(1), 1);
  assert.match(await page.locator('article').ariaSnapshot(), /combobox "Poplatek za nákup"/);
  assert.deepEqual(await combos.evaluateAll((elements) => elements.map((element) => element.value)), ['ongoing', 'order']);
  await primary().click(); await page.getByRole('status').filter({ hasText: 'Zkus to ještě jednou' }).waitFor();
  await capture('categorize-wrong');
  await page.getByRole('button', { name: 'Zkusit znovu', exact: true }).click();
  await page.waitForFunction(() => document.activeElement === document.querySelector('article select'));
  await selectWithKeys(combos.nth(0), 1); await selectWithKeys(combos.nth(1), 2);
  await checkedContinue('Seřaď kroky modelového nákupu.');
  await selectWithKeys(combos.nth(0), 3); await selectWithKeys(combos.nth(1), 2); await selectWithKeys(combos.nth(2), 1);
  await capture('order');
  await checkedContinue('Kde najdeš poplatek za směnu?');
  await page.getByRole('radio').first().focus(); await page.keyboard.press('ArrowDown');
  await capture('document');
  await checkedContinue('Jaká je přirážka při směně v procentech?');
  await page.getByRole('textbox', { name: 'Hodnota z dokumentu' }).fill('0,25');
  await capture('numeric-document');
  await checkedContinue('Najdi chybu v modelovém výpočtu.');
  await page.getByRole('radio').last().focus(); await page.keyboard.press('Space');
  await capture('find-error');
  await checkedContinue('Co ověřit před rozhodnutím?');
  assert.equal(await continueButton().isEnabled(), true);
  await page.getByRole('button', { name: 'Ano, mám plán' }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('status').filter({ hasText: 'Porovnej rozhodnutí' }).waitFor();
  await capture('decision');
  await page.getByRole('button', { name: 'Zpět o rozhodnutí' }).click();
  await page.getByRole('button', { name: 'Zatím ne' }).click();
  await page.getByRole('status').filter({ hasText: 'Nejdřív si zapiš' }).waitFor();
  await continueButton().click();
  await page.getByRole('heading', { name: 'Můj kontrolní seznam', exact: true }).first().waitFor();
  await page.getByText('Načítám uložený výstup…').waitFor({ state: 'hidden' });
  assert.equal(await continueButton().isEnabled(), true, 'a blank checklist never gates the cursor');
  await capture('checklist');
  const consent = () => page.getByRole('checkbox').last();
  await consent().focus(); await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Uložit výstup', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Aktuální výstup je uložený.' }).waitFor();
  await continueButton().click();
  await page.getByRole('heading', { name: 'Moje pravidlo pro rozhodování', exact: true }).first().waitFor();
  await page.getByText('Načítám uložený výstup…').waitFor({ state: 'hidden' });
  assert.equal(await continueButton().isDisabled(), true);
  const prose = page.getByRole('textbox');
  await prose.fill('  Před rozhodnutím si přečtu svůj plán. \n');
  await selectWithKeys(combos.first(), 1);
  await consent().check();
  await page.getByRole('button', { name: 'Uložit výstup', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Aktuální výstup je uložený.' }).waitFor();
  assert.equal(await continueButton().isEnabled(), true, 'self-rating level one still permits submission');
  await page.reload();
  await page.getByRole('status').filter({ hasText: 'Aktuální výstup je uložený.' }).waitFor();
  assert.equal(await prose.inputValue(), 'Před rozhodnutím si přečtu svůj plán.');
  assert.equal(await combos.first().inputValue(), '1');
  await prose.fill('Před každým rozhodnutím ověřím cíl, horizont a náklady.');
  assert.equal(await continueButton().isDisabled(), true, 'unsaved changes need a new explicit submission');
  await capture('rubric');
  await consent().check();
  await page.getByRole('button', { name: 'Uložit výstup', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Aktuální výstup je uložený.' }).waitFor();
  await continueButton().click();
  await page.getByRole('button', { name: 'Dokončit lekci', exact: true }).click();
  await page.getByRole('heading', { name: 'Lekce dokončena', exact: true }).waitFor();
  assert.equal((await sql`select * from lesson_award where user_id=${userId}`).length, 1);
  assert.equal((await sql`select * from learner_artifact where user_id=${userId}`).length, 3);
  assert.deepEqual(errors, []);
  console.log('PASS: actual player/actions, wrong → retry → correct, keyboard controls/focus, accessible names/live feedback, ungraded navigation, consent, reload, lowest rubric level, completion, six widths and 200% text.');
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
  await Promise.all(files.map((file, index) => writeFile(file, originals[index])));
  if (userId) await sql`delete from "user" where id=${userId}`;
  await sql.end();
  await writeFile(`${output}/server.log`, log);
}
