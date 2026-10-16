// Settings acceptance uses only a dedicated local disposable database and fresh server.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { chromium } from 'playwright';
const baseURL = process.env.SETTINGS_TEST_URL;
const local = (value) => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname);
assert.ok(baseURL && local(baseURL));
assert.ok(process.env.DATABASE_URL && local(process.env.DATABASE_URL));
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/investi_6a3a_qa');
assert.equal(process.env.PERSONALIZATION_QA_DISPOSABLE, '1');
assert.equal(process.env.MARKET_DATA_PROVIDER, 'deterministic');
assert.equal(process.env.FX_DATA_PROVIDER, 'deterministic');
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = process.env.SETTINGS_SCREENSHOT_DIR ?? '/tmp/investi-settings-screenshots';
await mkdir(output, { recursive: true });
const ids = [], errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Prague', reducedMotion: 'reduce' });
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
const root = () => page.locator('[data-investi-settings]');
async function settle() {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode().catch(() => {}))); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
}
async function matrix(label) {
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await settle(); await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: overflow at ${width}`);
    const clipped = await root().locator('h1:visible,h2:visible,h3:visible,p:visible,a:visible,button:visible,label:visible,dt:visible,dd:visible').evaluateAll((elements) => elements.filter((e) => e.clientWidth && e.scrollWidth > e.clientWidth + 2).map((e) => e.textContent));
    assert.deepEqual(clipped, [], `${label}: clipped text at ${width}`);
    await page.screenshot({ path: `${output}/${label}-${width}.png`, fullPage: true, animations: 'disabled' });
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await settle();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: overflow at ${width}/200%`);
    const clipped = await root().locator('h1:visible,h2:visible,p:visible,a:visible,button:visible,label:visible,dt:visible,dd:visible').evaluateAll((elements) => elements.filter((e) => e.clientWidth && e.scrollWidth > e.clientWidth + 2).map((e) => e.textContent));
    assert.deepEqual(clipped, [], `${label}: clipped text at ${width}/200%`);
    await page.screenshot({ path: `${output}/${label}-${width}-text-200.png`, fullPage: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function go(section = '') { await page.goto(`${baseURL}/settings${section ? `?section=${section}` : ''}`); await root().waitFor(); await settle(); }
async function snapshot(id) {
  const tables = ['lesson_progress','lesson_award','progression_unlock','portfolio'];
  const result = {};
  for (const table of tables) result[table] = await sql.unsafe(`select * from ${table} where user_id=$1 order by 1`, [id]);
  result.portfolio_trade = await sql`select t.* from portfolio_trade t join portfolio p on p.id=t.portfolio_id where p.user_id=${id} order by t.id`;
  return JSON.parse(JSON.stringify(result));
}
try {
  const email = `settings-${randomUUID()}@example.com`;
  const password = randomUUID();
  const response = await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: 'Klára Nováková', email, password } });
  assert.ok(response.ok(), `signup: ${response.status()}`);
  const { user } = await (await context.request.get(`${baseURL}/api/auth/get-session`)).json(); ids.push(user.id);
  await sql`insert into learning_profile(user_id,experience_level,goals,interests,daily_goal_minutes,time_zone,onboarding_completed_at) values(${user.id},'BASIC','{CONFIDENCE}','{}',10,'Europe/Prague',now())`;
  const before = await snapshot(user.id);
  if (process.env.SETTINGS_QA_FOCUS === 'visual') {
    for (const section of ['', 'account', 'goal', 'format', 'learning', 'security', 'portfolio', 'data']) {
      await go(section); await matrix(section ? `final-${section}` : 'final-overview');
    }
    await go('goal'); await page.getByRole('button', { name: 'Změnit cíl nebo úroveň…' }).click(); await matrix('final-editor');
    assert.deepEqual(errors, []);
    console.log(`PASS: final screenshots and reflow for every Settings section at all five widths and 200% text. Artifacts: ${output}`);
  } else {
  await go(); await page.getByRole('heading', { name: 'Účet', exact: true }).waitFor();
  assert.ok(await root().getByText(email, { exact: true }).isVisible());
  assert.ok(await root().getByText('E-mail a heslo', { exact: true }).first().isVisible());
  await matrix('account-overview');
  await page.setViewportSize({ width: 390, height: 844 }); await go();
  assert.ok(await page.getByRole('heading', { name: 'Profil a nastavení', exact: true }).isVisible());
  await page.getByRole('link', { name: /Klára Nováková/ }).click(); await page.waitForURL('**/settings?section=account');
  assert.equal(await page.getByRole('navigation', { name: 'Mobilní navigace' }).isVisible(), false);
  await matrix('account-detail');
  await page.getByRole('button', { name: 'Upravit', exact: true }).click();
  const name = page.getByLabel('Jméno', { exact: true });
  assert.ok(await name.evaluate((input) => input === document.activeElement));
  for (const invalid of [' ', 'a'.repeat(81)]) {
    await name.fill(invalid); await page.getByRole('button', { name: 'Uložit jméno', exact: true }).click();
    assert.ok(await name.getAttribute('aria-invalid')); assert.equal((await sql`select name from "user" where id=${user.id}`)[0].name, 'Klára Nováková');
  }
  await name.fill('Klára QA');
  await page.route('**/api/auth/update-user', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Uložit jméno', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Jméno se nepodařilo uložit' }).waitFor(); assert.equal(await name.inputValue(), 'Klára QA');
  await page.unroute('**/api/auth/update-user');
  let releaseName; const gate = new Promise((resolve) => { releaseName = resolve; }); let names = 0;
  await page.route('**/api/auth/update-user', async (route) => { names++; await gate; await route.continue(); });
  await page.getByRole('button', { name: 'Uložit jméno', exact: true }).click();
  await page.getByRole('button', { name: 'Ukládám…', exact: true }).waitFor(); assert.ok(await name.isDisabled());
  releaseName(); await page.getByRole('status').filter({ hasText: 'Jméno je uložené.' }).waitFor(); assert.equal(names, 1); await page.unroute('**/api/auth/update-user');
  await page.reload(); await root().getByRole('heading', { name: 'Klára QA', exact: true }).waitFor();
  console.log('PASS: saved identity, invalid names, request failure/retry, duplicate prevention and refreshed session name.');

  await go('goal');
  await page.route('**/*', (route) => route.request().headers()['next-action'] ? route.abort('failed') : route.continue());
  await page.locator('input[value="20"]').check();
  await page.getByRole('alert').filter({ hasText: 'Změny se nepodařilo uložit' }).waitFor(); assert.ok(await page.locator('input[value="20"]').isChecked());
  assert.equal((await sql`select daily_goal_minutes from learning_profile where user_id=${user.id}`)[0].daily_goal_minutes, 10);
  await page.unroute('**/*'); await page.getByRole('button', { name: 'Zkusit uložit znovu' }).click(); await page.getByRole('status', { name: '' }).filter({ hasText: 'Uloženo' }).waitFor();
  await page.reload(); assert.ok(await page.locator('input[value="20"]').isChecked());
  await matrix('goal-summary');
  await page.locator('input[value="20"]').focus();
  await page.keyboard.press('ArrowUp');
  await page.getByRole('status').filter({ hasText: 'Uloženo' }).waitFor();
  assert.ok(await page.locator('input[value="10"]').evaluate((input) => document.activeElement === input));
  assert.equal(await page.locator('input[value="10"]').evaluate((input) => getComputedStyle(input.closest('label')).outlineStyle), 'solid');
  await page.keyboard.press('ArrowDown');
  await page.getByRole('status').filter({ hasText: 'Uloženo' }).waitFor();
  assert.ok(await page.locator('input[value="20"]').evaluate((input) => document.activeElement === input));
  await page.getByRole('button', { name: 'Změnit cíl nebo úroveň…' }).click();
  await page.locator('input[value="QUANT"][type="radio"]').check();
  await page.locator('input[value="DATA"]').check();
  await page.locator('input[value="INVESTOR"]').check();
  await page.locator('input[value="30"]').check();
  await page.getByRole('navigation', { name: 'Sekce nastavení' }).getByRole('link', { name: 'Jazyk a formát' }).click();
  await page.getByRole('navigation', { name: 'Sekce nastavení' }).getByRole('link', { name: 'Můj cíl a tempo' }).click();
  assert.ok(await page.locator('input[value="QUANT"][type="radio"]').isChecked());
  await matrix('goal-edit');
  await page.getByRole('button', { name: 'Uložit předvolby' }).click(); await page.getByRole('status').filter({ hasText: 'Tvoje předvolby učení jsou uložené.' }).waitFor();
  const [saved] = await sql`select * from learning_profile where user_id=${user.id}`;
  assert.deepEqual(saved.goals, ['QUANT']); assert.deepEqual(saved.interests, ['DATA']); assert.equal(saved.experience_level, 'INVESTOR'); assert.equal(saved.daily_goal_minutes, 30);
  assert.deepEqual(await snapshot(user.id), before);
  console.log('PASS: immediate session save, failure retains choice, retry/reload and cross-section drafts preserve progress/accounting.');

  await go('learning'); await matrix('learning-empty');
  await page.getByRole('link', { name: 'Dokončit přizpůsobení' }).click(); await page.waitForURL('**/onboarding?personalize=1');
  await page.getByRole('heading', { name: 'Co se chceš naučit?', exact: true }).waitFor();
  await go('format'); await matrix('format');
  await go('portfolio'); await matrix('portfolio-locked'); assert.equal(await page.getByRole('button', { name: 'Začít znovu…' }).count(), 0);
  await go('security'); await matrix('security');
  await sql`alter table account rename to settings_qa_account_unavailable`;
  try {
    await go('security');
    await page.getByRole('button', { name: 'Zkusit načíst znovu', exact: true }).waitFor();
    assert.equal(await page.getByRole('status').filter({ hasText: 'Načítám způsoby' }).count(), 0);
    await go('data'); await root().getByRole('heading', { name: 'Smazání teď nejde připravit' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Smazat účet…' }).count(), 0, 'no deletion while sign-in methods are unknown');
    await go('security'); await page.getByRole('button', { name: 'Zkusit načíst znovu', exact: true }).waitFor();
  } finally { await sql`alter table settings_qa_account_unavailable rename to account`; }
  await page.getByRole('button', { name: 'Zkusit načíst znovu', exact: true }).click();
  await page.getByRole('heading', { name: 'Způsoby přihlášení', exact: true }).waitFor();
  await page.getByText('E-mail a heslo', { exact: true }).waitFor();
  await root().getByRole('alert').waitFor({ state: 'hidden' });
  if (process.env.SETTINGS_ENABLED_TEST_URL) {
    const enabledURL = process.env.SETTINGS_ENABLED_TEST_URL;
    assert.ok(local(enabledURL));
    await page.goto(`${enabledURL}/settings?section=security`);
    await page.getByRole('button', { name: 'Připojit Google', exact: true }).waitFor();
    let releaseLink, linkCount = 0;
    const gate = new Promise((resolve) => { releaseLink = resolve; });
    await page.route('**/api/auth/link-social', async (route) => {
      linkCount++;
      assert.deepEqual(route.request().postDataJSON(), { provider: 'google', callbackURL: '/settings', errorCallbackURL: '/settings' });
      await gate;
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'EMAIL_DOES_NOT_MATCH', message: 'Private provider detail must not be displayed' }) });
    });
    await page.getByRole('button', { name: 'Připojit Google', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'Připojit Facebook', exact: true }).isDisabled());
    releaseLink(); await root().getByRole('alert').filter({ hasText: 'Účet nelze bezpečně propojit.' }).waitFor();
    assert.equal(linkCount, 1); assert.equal(await root().getByText('Private provider detail must not be displayed').count(), 0);
    await page.unroute('**/api/auth/link-social'); await go('security');
    console.log('PASS: configured provider controls, linking payload, duplicate prevention and normalized OAuth failure without external OAuth traffic.');
  }
  // Real linked-account operations with fixture identities; no OAuth request is sent.
  await sql`insert into account(id,account_id,provider_id,user_id,created_at,updated_at) values(${randomUUID()},'fixture-google','google',${user.id},now(),now())`;
  await go('security'); await page.getByRole('button', { name: 'Odpojit Google' }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor(); await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), false);
  assert.ok(await page.getByRole('button', { name: 'Odpojit Google' }).evaluate((button) => document.activeElement === button));
  await page.getByRole('button', { name: 'Odpojit Google' }).click(); await dialog.getByRole('button', { name: 'Odpojit', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.equal((await sql`select * from account where user_id=${user.id} and provider_id='google'`).length, 0);
  await sql`insert into account(id,account_id,provider_id,user_id,created_at,updated_at) values(${randomUUID()},'fixture-google-only','google',${user.id},now(),now())`;
  await sql`delete from account where user_id=${user.id} and provider_id='credential'`;
  await go('security'); await page.getByRole('button', { name: 'Odpojit Google' }).click(); await dialog.getByRole('button', { name: 'Odpojit', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'Nejdřív si připoj jiný způsob přihlášení.' }).waitFor();
  assert.equal((await sql`select * from account where user_id=${user.id}`).length, 1);
  await page.keyboard.press('Escape');
  console.log('PASS: linked account confirmation, Escape/focus return, unlink and last-sign-in safeguard.');

  await go('account'); await page.getByRole('button', { name: 'Upravit', exact: true }).click(); await name.fill('Neuložené jméno');
  await page.getByRole('navigation', { name: 'Sekce nastavení' }).getByRole('button', { name: 'Odhlásit se' }).click();
  await page.getByRole('dialog', { name: 'Máš neuložené změny' }).waitFor(); await page.keyboard.press('Escape'); assert.equal(await name.inputValue(), 'Neuložené jméno');
  await page.getByRole('button', { name: 'Zrušit', exact: true }).click();
  await page.route('**/api/auth/sign-out', (route) => route.abort('failed'));
  await page.getByRole('navigation', { name: 'Sekce nastavení' }).getByRole('button', { name: 'Odhlásit se' }).click();
  await page.getByRole('alert').filter({ hasText: 'Odhlášení se nezdařilo' }).waitFor(); await page.unroute('**/api/auth/sign-out');
  await page.getByRole('navigation', { name: 'Sekce nastavení' }).getByRole('button', { name: 'Odhlásit se' }).click(); await page.waitForURL('**/sign-in');
  assert.equal(await (await context.request.get(`${baseURL}/api/auth/get-session`)).json(), null);
  await page.goto(`${baseURL}/settings`); await page.waitForURL('**/sign-in');
  console.log('PASS: unsaved-change confirmation, sign-out error/retry and authenticated route/session transitions.');

  const demo = await context.request.post(`${baseURL}/api/auth/sign-in/anonymous`, { headers: { origin: baseURL }, data: {} }); assert.ok(demo.ok());
  const demoUser = (await demo.json()).user; ids.push(demoUser.id);
  await go();
  execFileSync('node_modules/.bin/tsx', ['--tsconfig', 'scripts/tsconfig.persistence.json', 'scripts/settings-browser-fixtures.mts'], { env: { ...process.env, SETTINGS_QA_DEMO_ID: demoUser.id }, stdio: 'pipe' });
  assert.equal(await root().getByText(demoUser.email, { exact: true }).count(), 0); await matrix('demo-account');
  await go('portfolio'); await page.getByRole('button', { name: 'Začít znovu…' }).click(); const reset = page.getByRole('dialog', { name: 'Resetovat portfolio?' });
  await reset.waitFor(); await page.keyboard.press('Tab'); assert.ok(await reset.evaluate((d) => d.contains(document.activeElement)));
  await page.keyboard.press('Escape'); assert.ok(await page.getByRole('button', { name: 'Začít znovu…' }).evaluate((button) => button === document.activeElement));
  await page.getByRole('button', { name: 'Začít znovu…' }).click();
  await page.route('**/*', (route) => route.request().headers()['next-action'] ? route.abort('failed') : route.continue());
  await reset.getByRole('button', { name: 'Resetovat portfolio', exact: true }).click(); await reset.getByRole('alert').waitFor();
  await page.unroute('**/*'); const demoBefore = await snapshot(demoUser.id);
  assert.equal(demoBefore.portfolio_trade.length, 1, 'reset fixture includes an authoritative fractional trade');
  await reset.getByRole('button', { name: 'Resetovat portfolio', exact: true }).click(); await reset.waitFor({ state: 'hidden' });
  await page.getByRole('status').filter({ hasText: 'Portfolio resetováno' }).waitFor();
  const demoAfter = await snapshot(demoUser.id);
  for (const table of ['lesson_progress','lesson_award','progression_unlock','portfolio_trade']) assert.deepEqual(demoAfter[table], demoBefore[table], `reset retains ${table}`);
  assert.equal(demoAfter.portfolio.filter((p) => p.closed_at === null).length, 1);
  assert.equal(demoAfter.portfolio.length, demoBefore.portfolio.length + 1);
  console.log('PASS: isolated demo identity, real reset failure/retry, modal focus and immutable learning/reward/trade history.');
  await go('data'); await root().getByRole('heading', { name: 'Tento profil se smaže sám' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Smazat účet…' }).count(), 0, 'a demo has no account to delete');

  // Moje data: owner-only export download, then the deletion dialog and a real deletion.
  const owner = { email: `settings-delete-${randomUUID()}@example.com`, password: randomUUID() };
  assert.ok((await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: 'Mazání QA', ...owner } })).ok());
  const { user: deletable } = await (await context.request.get(`${baseURL}/api/auth/get-session`)).json(); ids.push(deletable.id);
  await sql`insert into learning_profile(user_id,experience_level,goals,interests,daily_goal_minutes,time_zone,onboarding_completed_at) values(${deletable.id},'BASIC','{CONFIDENCE}','{}',10,'Europe/Prague',now())`;
  await go('data'); await matrix('data');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Stáhnout data' }).click()]);
  assert.match(download.suggestedFilename(), /^investi-moje-data-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(exported.user.email, owner.email); assert.equal(exported.learningProfile.dailyGoalMinutes, 10);
  await page.getByRole('status').filter({ hasText: 'se stahuje' }).waitFor();
  const deleteTrigger = page.getByRole('button', { name: 'Smazat účet…' });
  await deleteTrigger.click(); const confirmDelete = page.getByRole('dialog', { name: 'Smazat účet natrvalo?' }); await confirmDelete.waitFor();
  assert.ok(await confirmDelete.getByRole('button', { name: 'Ponechat účet' }).evaluate((button) => button === document.activeElement), 'the safe choice is focused first');
  await page.keyboard.press('Escape'); await confirmDelete.waitFor({ state: 'hidden' });
  assert.ok(await deleteTrigger.evaluate((button) => button === document.activeElement), 'focus returns to the trigger');
  await deleteTrigger.click();
  await confirmDelete.getByRole('button', { name: 'Smazat účet natrvalo' }).click();
  await confirmDelete.getByRole('alert').filter({ hasText: 'Pro smazání účtu zadej své heslo.' }).waitFor();
  assert.ok(await confirmDelete.getByLabel('Heslo k účtu').evaluate((input) => input === document.activeElement));
  await confirmDelete.getByLabel('Heslo k účtu').fill('wrong-password-123'); await confirmDelete.getByRole('button', { name: 'Smazat účet natrvalo' }).click();
  await confirmDelete.getByRole('alert').filter({ hasText: 'Heslo nesouhlasí' }).waitFor();
  assert.equal((await sql`select id from "user" where id=${deletable.id}`).length, 1, 'a wrong password deletes nothing');
  for (const width of [390, 1440]) { await page.setViewportSize({ width, height: 900 }); await settle(); await page.screenshot({ path: `${output}/data-delete-dialog-${width}.png`, animations: 'disabled' }); }
  await confirmDelete.getByLabel('Heslo k účtu').fill(owner.password); await confirmDelete.getByRole('button', { name: 'Smazat účet natrvalo' }).click();
  await page.waitForURL('**/sign-in?account=deleted'); await page.getByRole('status').filter({ hasText: 'Účet je smazaný' }).waitFor();
  assert.equal((await sql`select id from "user" where id=${deletable.id}`).length, 0);
  assert.equal(await (await context.request.get(`${baseURL}/api/auth/get-session`)).json(), null);
  console.log('PASS: data export download, deletion dialog focus/Escape/password errors and a real account deletion that signs the learner out.');
  assert.deepEqual(errors, []);
  console.log(`PASS: responsive screenshots at 320/390/768/1024/1440 and 200% text. Artifacts: ${output}`);
  }
} finally {
  await browser.close();
  for (const id of ids) await sql`delete from "user" where id=${id}`;
  await sql.end();
}
