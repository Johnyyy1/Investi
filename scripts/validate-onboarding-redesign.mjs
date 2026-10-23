import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import postgres from 'postgres';
import { chromium } from 'playwright';

const baseURL = process.env.PERSONALIZATION_TEST_URL;
const local = (url) => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
assert.ok(baseURL && local(baseURL));
assert.ok(process.env.DATABASE_URL && local(process.env.DATABASE_URL));
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/investi_6a3a_qa');
assert.equal(process.env.PERSONALIZATION_QA_DISPOSABLE, '1');
assert.equal(process.env.MARKET_DATA_PROVIDER, 'deterministic');
assert.equal(process.env.FX_DATA_PROVIDER, 'deterministic');
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = process.env.PERSONALIZATION_SCREENSHOT_DIR ?? '/tmp/investi-onboarding-redesign';
await mkdir(output, { recursive: true });
const accounts = [], errors = [];
const correct = ['ten', 'ninety_six', 'forty', 'ask', 'count'];
const weak = ['one', 'hundred', 'twenty', 'bid', 'no_risk'];
async function account() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Prague', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const email = `personalization-browser-${randomUUID()}@example.com`, password = randomUUID();
  const signup = () => context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: 'Jana', email, password } });
  let response = await signup();
  for (let attempt = 0; response.status() === 429 && attempt < 6; attempt++) {
    const seconds = Number(response.headers()['retry-after']) || 11;
    await new Promise((resolve) => setTimeout(resolve, Math.min(30000, Math.max(1000, seconds * 1000 + 1000))));
    response = await signup();
  }
  assert.ok(response.ok(), `signup: ${response.status()}`);
  const [{ id }] = await sql`select id from "user" where email=${email}`;
  const result = { page, context, id, email, password };
  accounts.push(result); return result;
}
async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode().catch(() => {}))); window.scrollTo(0, 0); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
}
async function layouts(page, name, capture = true) {
  async function headerDoesNotOverlap() {
    const clear = await page.locator('header').evaluate((header) => {
      const brand = header.querySelector('a').getBoundingClientRect();
      const action = header.lastElementChild.getBoundingClientRect();
      return brand.right <= action.left || action.bottom <= brand.top || action.top >= brand.bottom;
    });
    assert.ok(clear, `${name}: header logo and action must not overlap`);
  }
  for (const width of [1440, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 }); await settle(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: overflow at ${width}`);
    await headerDoesNotOverlap();
    assert.ok(await page.locator('main img').evaluateAll((images) => images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0)), `${name}: illustrations load`);
    for (const button of await page.locator('main button:visible, main label:visible, header a:visible').all()) {
      const box = await button.boundingBox(); assert.ok(box.height >= 44, `${name}: touch target ${await button.textContent()}`);
    }
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuemax'), '100');
    assert.equal(await page.locator('main section').first().evaluate((element) => getComputedStyle(element).animationName), 'none', 'reduced motion disables the transition');
    if (capture) await page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await settle(page);
  // Names the innermost elements that stick out, so a failure shows what overflows.
  assert.deepEqual(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth ? [...document.body.querySelectorAll('*')].filter((element) => element.getBoundingClientRect().right > innerWidth + 1 && ![...element.children].some((child) => child.getBoundingClientRect().right > innerWidth + 1)).slice(0, 5).map((element) => `${element.tagName.toLowerCase()} "${element.textContent.trim().slice(0, 40)}" ends at ${Math.round(element.getBoundingClientRect().right)}px`) : []), [], `${name}: overflow at 320/200%`);
  await headerDoesNotOverlap();
  const clipped = await page.locator('main h1, main h2, main label, main button, main a, main summary').evaluateAll((elements) => elements.filter((element) => element.clientWidth && element.scrollWidth > element.clientWidth + 2).map((element) => element.textContent));
  assert.deepEqual(clipped, [], `${name}: essential text clips at 200%`);
  if (capture) await page.screenshot({ path: `${output}/${name}-320-text-200.png`, fullPage: true, animations: 'disabled' });
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.setViewportSize({ width: 1440, height: 900 });
}
async function next(page) { await page.getByRole('button', { name: 'Pokračovat', exact: true }).click(); }
async function miniLessonLayouts(page, step) {
  for (const width of [1440, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 }); await settle(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${step}: overflow at ${width}`);
    if ([1440, 390].includes(width)) await page.screenshot({ path: `${output}/mini-lesson-${step}-${width}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await settle(page);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${step}: overflow at 320/200%`);
  assert.deepEqual(await page.locator('main button, main label, main p').evaluateAll((elements) => elements.filter((element) => element.clientWidth && element.scrollWidth > element.clientWidth + 2).map((element) => element.textContent)), [], `${step}: clipped text at 200%`);
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.setViewportSize({ width: 1440, height: 900 });
}
async function preferences(page, { goal = 'LONG_TERM_ETF', minutes = '5', capture = false } = {}) {
  await page.getByRole('heading', { name: 'Co se chceš naučit?', exact: true }).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Pokračovat', exact: true }).isDisabled());
  assert.equal(await page.locator('[data-pose]').getAttribute('data-pose'), '01-welcome');
  await page.locator(`input[value="${goal}"]`).check();
  assert.equal(await page.locator('[data-pose]').getAttribute('data-pose'), '03-explaining');
  if (capture) await layouts(page, 'goal');
  await next(page);
  await page.locator('input[value="ETFS"]').check(); await page.locator('input[value="DATA"]').check();
  await page.reload(); await page.locator('input[value="ETFS"]').waitFor();
  assert.ok(await page.locator('input[value="ETFS"]').isChecked()); assert.ok(await page.locator('input[value="DATA"]').isChecked());
  await page.getByRole('button', { name: 'Zpět', exact: true }).click();
  assert.ok(await page.locator(`input[value="${goal}"]`).isChecked());
  await next(page); if (capture) await layouts(page, 'interests');
  await next(page); await page.locator('input[value="INVESTOR"]').check(); if (capture) await layouts(page, 'experience');
  await next(page); await page.locator(`input[value="${minutes}"]`).check(); if (capture) await layouts(page, 'pace');
  await next(page);
}
async function diagnostic(page, answers, { capture = false, submit = true } = {}) {
  await page.getByText('Výsledek nic neodemkne ani nepřeskakuje.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Začít diagnostiku', exact: true }).click();
  for (let i = 0; i < answers.length; i++) {
    assert.ok(await page.getByRole('button', { name: i === 4 ? 'Zobrazit můj plán' : 'Další otázka', exact: true }).isDisabled());
    if (capture && i === 0) await layouts(page, 'diagnostic');
    await page.locator(`input[value="${answers[i]}"]`).check();
    assert.equal(await page.getByText('Správná odpověď', { exact: true }).count(), 0);
    assert.equal(await page.locator('[data-pose]').getAttribute('data-pose'), '04-calm-book');
    if (i === 2) { await page.reload(); await page.locator(`input[value="${answers[i]}"]`).waitFor(); assert.ok(await page.locator(`input[value="${answers[i]}"]`).isChecked()); }
    if (i < 4) await page.getByRole('button', { name: 'Další otázka', exact: true }).click();
  }
  if (submit) { await page.getByRole('button', { name: 'Zobrazit můj plán', exact: true }).click(); await page.waitForURL('**/onboarding/plan'); await page.getByRole('heading', { name: 'Tvůj plán', exact: true }).waitFor(); }
}
async function unchangedFinance(id) {
  const state = {};
  for (const table of ['lesson_progress', 'lesson_award', 'progression_unlock', 'portfolio']) state[table] = await sql.unsafe(`select * from ${table} where user_id=$1 order by 1,2`, [id]);
  state.trades = await sql`select t.* from portfolio_trade t join portfolio p on p.id=t.portfolio_id where p.user_id=${id} order by t.id`;
  return JSON.parse(JSON.stringify(state));
}
async function profile(id) { return (await sql`select * from learning_profile where user_id=${id}`)[0]; }
try {
  // Pen main path: guest answers → plan → first mini-lesson → save account → Studovna. The account takes the guest's learning over.
  const guestContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Prague', reducedMotion: 'reduce' });
  const guest = await guestContext.newPage(); guest.on('pageerror', (error) => errors.push(error.message));
  await guest.goto(`${baseURL}/onboarding`); assert.equal(new URL(guest.url()).pathname, '/onboarding');
  assert.equal(await guest.getByRole('link', { name: 'Přihlásit se', exact: true }).getAttribute('href'), '/sign-in');
  assert.equal((await (await guestContext.request.get(`${baseURL}/api/auth/get-session`)).json()), null, 'answering questions creates no identity');
  await preferences(guest); await diagnostic(guest, correct, { submit: false });
  await guest.getByRole('button', { name: 'Zobrazit můj plán', exact: true }).click();
  await guest.waitForURL('**/onboarding/plan'); await guest.getByRole('heading', { name: 'Tvůj plán', exact: true }).waitFor();
  const guestSession = await (await guestContext.request.get(`${baseURL}/api/auth/get-session`)).json();
  assert.equal(guestSession.user.isAnonymous, true); assert.equal(guestSession.user.anonymousKind, 'guest');
  const guestId = guestSession.user.id; accounts.push({ id: guestId });
  assert.equal((await sql`select count(*)::int as n from lesson_award where user_id=${guestId}`)[0].n, 0, 'a guest is never seeded with demo data');
  assert.equal((await profile(guestId)).diagnostic_result.level, 'strong_foundations');
  await guest.goto(`${baseURL}/learn/investing-foundations/why-invest`);
  await miniLessonLayouts(guest, 'concept');
  await guest.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await guest.getByText(/^Modelový příklad: máš 10 000 Kč/).waitFor();
  await miniLessonLayouts(guest, 'envelope');
  await guest.getByRole('radio', { name: 'Nic. Pořád je to 10 000 Kč, koupím za ně stejně.', exact: true }).check();
  await guest.getByRole('button', { name: 'Zkontrolovat odpověď', exact: true }).click();
  await guest.getByText(/Skoro\. Číslo na obálce se nezmění/).waitFor();
  await guest.getByRole('button', { name: 'Zkusit znovu', exact: true }).click();
  await guest.getByRole('radio', { name: 'Koupím si za ně o něco méně.', exact: true }).check();
  await guest.getByRole('button', { name: 'Zkontrolovat odpověď', exact: true }).click();
  await guest.getByText(/Přesně\. Číslo stejné, hodnota menší/).waitFor();
  await guest.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await guest.getByText(/Než začneš investovat, měj rezervu a žádný drahý dluh\./).waitFor();
  await miniLessonLayouts(guest, 'summary');
  assert.equal(await guest.locator('a[href="/learn/before-investing/emergency-fund"]').count(), 0, 'no link to the unpublished reserve lesson');
  await guest.getByRole('button', { name: 'Dokončit lekci', exact: true }).click();
  await guest.getByRole('heading', { name: 'Lekce dokončena', exact: true }).waitFor();
  const guestReceipt = (await sql`select * from lesson_award where user_id=${guestId}`)[0];
  assert.equal(guestReceipt.lesson_id, 'foundations-why-invest');
  await guest.getByRole('button', { name: 'Ulož si, co už víš', exact: true }).click();
  await guest.waitForURL('**/onboarding/save'); await guest.getByRole('heading', { name: 'Ulož si, co už víš.', exact: true }).waitFor();
  assert.equal(await guest.getByRole('link', { name: 'Teď ne', exact: true }).getAttribute('href'), '/learn');
  for (const width of [1440, 390, 320]) { await guest.setViewportSize({ width, height: 900 }); assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `guest save: overflow at ${width}`); await guest.screenshot({ path: `${output}/guest-save-${width}.png`, fullPage: true, animations: 'disabled' }); }
  await guest.setViewportSize({ width: 1440, height: 900 });
  const guestEmail = `personalization-guest-${randomUUID()}@example.com`;
  await guest.getByLabel('Jméno', { exact: true }).fill('Jana'); await guest.getByLabel('E-mail', { exact: true }).fill(guestEmail); await guest.getByLabel('Heslo', { exact: true }).fill(randomUUID());
  await guest.getByRole('button', { name: 'Vytvořit účet', exact: true }).click();
  await guest.waitForURL('**/learn');
  const [{ id: savedId }] = await sql`select id from "user" where email=${guestEmail}`; accounts.push({ id: savedId });
  assert.equal((await sql`select count(*)::int as n from "user" where id=${guestId}`)[0].n, 0, 'the guest identity is gone after the claim');
  const savedReceipts = await sql`select * from lesson_award where user_id=${savedId}`;
  assert.equal(savedReceipts.length, 1); assert.equal(savedReceipts[0].awarded_at.getTime(), guestReceipt.awarded_at.getTime(), 'the original receipt moved');
  assert.equal((await sql`select status from lesson_progress where user_id=${savedId} and lesson_id='foundations-why-invest'`)[0].status, 'completed');
  assert.equal((await profile(savedId)).diagnostic_result.level, 'strong_foundations');
  const savedSession = await (await guestContext.request.get(`${baseURL}/api/auth/get-session`)).json();
  assert.equal(savedSession.user.id, savedId); assert.equal(savedSession.user.isAnonymous, false);
  await guestContext.close();
  console.log('PASS: guest answers, sees the plan, finishes the mini-lesson, then saves an account that takes over the receipt, progress and profile.');
  const a = await account();
  const response = await a.page.goto(`${baseURL}/learn`); await a.page.waitForURL('**/onboarding');
  assert.ok(!(await response.text()).includes('correctAnswer'));
  await preferences(a.page, { capture: true }); await diagnostic(a.page, weak, { capture: true, submit: false });
  const beforeSave = await unchangedFinance(a.id);
  await a.page.route('**/*', (route) => route.request().method() === 'POST' && route.request().headers()['next-action'] ? route.abort('failed') : route.continue());
  await a.page.getByRole('button', { name: 'Zobrazit můj plán', exact: true }).click();
  await a.page.getByRole('alert').filter({ hasText: 'Odpovědi tu zůstaly' }).waitFor();
  assert.ok(await a.page.locator('input[value="no_risk"]').isChecked()); await layouts(a.page, 'failed-save');
  assert.deepEqual(await unchangedFinance(a.id), beforeSave); assert.equal(await profile(a.id), undefined);
  await a.page.unroute('**/*');
  await a.page.route('**/*', (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.headers()['next-action']) { const body = JSON.parse(request.postData()); body[0].preferences.preferredSessionMinutes = 999; return route.continue({ postData: JSON.stringify(body) }); }
    return route.continue();
  });
  await a.page.getByRole('button', { name: 'Zobrazit můj plán', exact: true }).click();
  await a.page.getByRole('alert').filter({ hasText: 'Zkontroluj odpovědi' }).waitFor();
  assert.ok(await a.page.locator('input[value="no_risk"]').isChecked()); assert.equal(await profile(a.id), undefined);
  await a.page.unroute('**/*');
  let release; const gate = new Promise((resolve) => { release = resolve; });
  await a.page.route('**/*', async (route) => { if (route.request().method() === 'POST' && route.request().headers()['next-action']) await gate; await route.continue(); });
  await a.page.getByRole('button', { name: 'Zobrazit můj plán', exact: true }).click();
  const saving = a.page.getByRole('button', { name: 'Ukládám odpovědi…', exact: true }); await saving.waitFor();
  assert.ok(await saving.isDisabled()); assert.equal(await a.page.locator('[data-pose]').getAttribute('data-pose'), '21-hourglass');
  assert.equal(await a.page.locator('fieldset:disabled').count(), 1); release();
  await a.page.waitForURL('**/onboarding/plan'); await a.page.unroute('**/*');
  assert.equal((await profile(a.id)).diagnostic_result.level, 'foundations_needed');
  await a.page.getByText('Klidně od základů', { exact: true }).waitFor(); await layouts(a.page, 'plan-guided');
  assert.equal(await a.page.getByRole('link', { name: 'Začít doporučenou lekci', exact: true }).getAttribute('href'), '/learn/investing-foundations/why-invest');
  await a.page.getByText('Jak si rozvrhnout učení', { exact: false }).click();
  assert.equal(await a.page.locator('ol').first().locator('li').count(), 1);
  await a.page.reload(); await a.page.getByRole('heading', { name: 'Tvůj plán', exact: true }).waitFor();
  assert.deepEqual(await unchangedFinance(a.id), beforeSave);
  await a.page.getByRole('link', { name: 'Začít doporučenou lekci', exact: true }).click(); await a.page.waitForURL('**/learn/investing-foundations/why-invest');
  await a.page.goto(`${baseURL}/onboarding`); await a.page.waitForURL('**/learn');
  console.log('PASS: initial gate, responsive choices/plan, back/refresh, network and validation failures, disabled saving, real completion, no financial/learning writes.');

  const savedA = await profile(a.id);
  await a.page.goto(`${baseURL}/onboarding?retake=1`); await a.page.getByRole('link', { name: 'Zpět do nastavení', exact: true }).waitFor(); await a.page.locator('header').nth(1).waitFor({ state: 'detached' }).catch(() => {}); await layouts(a.page, 'retake');
  await a.page.getByRole('link', { name: 'Zpět do nastavení', exact: true }).click(); await a.page.waitForURL('**/settings');
  await a.page.locator('main').getByRole('link', { name: 'Učení', exact: true }).click();
  await a.page.getByRole('link', { name: 'Zopakovat krátkou diagnostiku', exact: true }).click();
  await diagnostic(a.page, correct);
  const retaken = await profile(a.id);
  for (const key of ['goals', 'interests', 'experience_level', 'daily_goal_minutes', 'onboarding_completed_at', 'personalized_onboarding_completed_at']) assert.deepEqual(retaken[key], savedA[key], `retake preserves ${key}`);
  assert.equal(retaken.diagnostic_result.level, 'strong_foundations'); assert.deepEqual(await unchangedFinance(a.id), beforeSave);
  console.log('PASS: retake changes diagnostic and plan guidance, preserves saved preferences and progress; settings exit remains available.');

  const b = await account(); await b.page.goto(`${baseURL}/onboarding`);
  await preferences(b.page, { goal: 'QUANT', minutes: '30' }); await diagnostic(b.page, correct, { submit: false });
  await sql`delete from session where user_id=${b.id}`;
  await b.page.getByRole('button', { name: 'Zobrazit můj plán', exact: true }).click();
  // The server-rendered route guard redirects when Better Auth clears the expired cookie.
  await b.page.waitForURL('**/sign-in');
  assert.equal(await profile(b.id), undefined);
  await b.page.getByLabel('E-mail', { exact: true }).fill(b.email); await b.page.getByLabel('Heslo', { exact: true }).fill(b.password);
  await b.page.getByRole('button', { name: 'Přihlásit se', exact: true }).click(); await b.page.waitForURL('**/onboarding');
  await b.page.locator('input[value="count"]').waitFor(); assert.ok(await b.page.locator('input[value="count"]').isChecked());
  await b.page.getByRole('button', { name: 'Zobrazit můj plán', exact: true }).click({ clickCount: 2 }); await b.page.waitForURL('**/onboarding/plan');
  await b.page.getByText('Svižné zopakování', { exact: true }).waitFor(); await layouts(b.page, 'plan-compact');
  await b.page.getByText('Jak si rozvrhnout učení', { exact: false }).click();
  assert.equal(await b.page.locator('ol').first().locator('li').count(), 3);
  assert.equal((await profile(b.id)).daily_goal_minutes, 30);
  assert.equal(await b.page.getByRole('link', { name: 'Začít doporučenou lekci', exact: true }).getAttribute('href'), '/learn/investing-foundations/why-invest');
  console.log('PASS: expired authentication handoff restores final draft; goal, diagnostic and tempo produce supported context, guidance and session differences; double submit is safe.');

  const c = await account(); await c.page.goto(`${baseURL}/onboarding`);
  await c.page.getByRole('button', { name: 'Přeskočit personalizaci', exact: true }).click(); await c.page.waitForURL('**/learn');
  const skipped = await profile(c.id); assert.deepEqual(skipped.goals, []); assert.deepEqual(skipped.interests, []); assert.equal(skipped.daily_goal_minutes, 10); assert.equal(skipped.diagnostic_result, null); assert.equal(skipped.personalized_onboarding_completed_at, null); assert.ok(skipped.onboarding_completed_at);
  await c.page.goto(`${baseURL}/onboarding`); await c.page.waitForURL('**/learn');
  await c.page.goto(`${baseURL}/onboarding?personalize=1`); await c.page.getByRole('heading', { name: 'Co se chceš naučit?', exact: true }).waitFor();
  await c.page.evaluate(() => { sessionStorage.setItem(Object.keys(sessionStorage).find((key) => key.startsWith('investi-personalization')), 'invalid json'); }); await c.page.reload();
  await c.page.getByRole('heading', { name: 'Co se chceš naučit?', exact: true }).waitFor();
  await c.page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('storage blocked'); }; });
  await c.page.locator('input[value="CONFIDENCE"]').check(); await next(c.page); await next(c.page);
  await c.page.getByRole('heading', { name: 'Jaké máš zkušenosti s investováním?', exact: true }).waitFor();
  console.log('PASS: skip persists neutral defaults, returning skipped learner is not re-gated, malformed/disabled storage does not block the flow.');

  const d = await account();
  execFileSync('node_modules/.bin/tsx', ['--tsconfig', 'scripts/tsconfig.persistence.json', 'scripts/personalization-browser-fixtures.mts'], { env: { ...process.env, PERSONALIZATION_QA_USER_ID: d.id }, stdio: 'pipe' });
  const financeD = await unchangedFinance(d.id);
  await d.page.goto(`${baseURL}/learn`); await d.page.getByRole('heading', { name: 'Přizpůsobit učení', exact: true }).waitFor();
  await d.page.goto(`${baseURL}/onboarding`); await d.page.waitForURL('**/learn');
  await d.page.goto(`${baseURL}/onboarding?personalize=1`); await preferences(d.page, { goal: 'QUANT', minutes: '30' }); await diagnostic(d.page, correct);
  assert.equal(await d.page.getByRole('link', { name: 'Začít doporučenou lekci', exact: true }).getAttribute('href'), '/learn/returns/what-is-a-return');
  await d.page.getByText('Výnosy tvoří základ pro pozdější práci s daty a analýzu rizika.', { exact: true }).waitFor();
  assert.deepEqual(await unchangedFinance(d.id), financeD);
  await layouts(d.page, 'plan-returning');
  console.log('PASS: existing learner retains lessons, rewards, capital and trades; plan uses completed prerequisites and recommends the actual Returns lesson.');

  await c.page.goto(`${baseURL}/onboarding?personalize=1`); await c.page.getByRole('heading', { name: 'Co se chceš naučit?', exact: true }).waitFor();
  async function tabTo(selector) {
    for (let i = 0; i < 40; i++) { if (await c.page.evaluate((selector) => document.activeElement?.matches(selector), selector)) return; await c.page.keyboard.press('Tab'); }
    throw new Error(`keyboard could not reach ${selector}`);
  }
  await tabTo('input[value="CONFIDENCE"]'); await c.page.keyboard.press('Space');
  assert.ok(await c.page.locator('input[value="CONFIDENCE"]').evaluate((element) => getComputedStyle(element.parentElement).outlineStyle !== 'none'));
  await tabTo('button[type="submit"]'); await c.page.keyboard.press('Enter');
  await tabTo('input[value="STOCKS"]'); await c.page.keyboard.press('Space'); await c.page.keyboard.press('Tab'); await c.page.keyboard.press('Space');
  for (const title of ['Jaké máš zkušenosti s investováním?', 'Kolik času chceš učení běžně věnovat?', 'Najdeme vhodný začátek']) { await tabTo('button[type="submit"]'); await c.page.keyboard.press('Enter'); await c.page.getByRole('heading', { name: title, exact: true }).waitFor(); }
  await tabTo('button[type="submit"]'); await c.page.keyboard.press('Enter');
  for (let i = 0; i < 5; i++) { await c.page.locator('input[type="radio"]').first().waitFor(); await tabTo('input[type="radio"]'); await c.page.keyboard.press('Space'); await c.page.keyboard.press('ArrowDown'); await tabTo('button[type="submit"]'); await c.page.keyboard.press('Enter'); if (i < 4) await c.page.getByRole('status').filter({ hasText: `Otázka ${i + 2} z 5` }).waitFor(); }
  await c.page.waitForURL('**/onboarding/plan');
  assert.deepEqual(errors, []);
  console.log(`PASS: keyboard-only completion, native radios/checkboxes, visible focus, reduced motion, loaded assets, touch targets, six responsive widths and 200% text. Screenshots: ${output}`);
} finally {
  await browser.close();
  for (const { id } of accounts) await sql`delete from "user" where id=${id}`;
  await sql.end();
}
