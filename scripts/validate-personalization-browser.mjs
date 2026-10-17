import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
const baseURL = process.env.PERSONALIZATION_TEST_URL;
const local = (url) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
assert.ok(baseURL && local(baseURL));
assert.ok(process.env.DATABASE_URL && local(process.env.DATABASE_URL));
assert.equal(new URL(process.env.DATABASE_URL).pathname, "/investi_6a3a_qa");
assert.equal(process.env.PERSONALIZATION_QA_DISPOSABLE, "1");
assert.equal(process.env.MARKET_DATA_PROVIDER, "deterministic");
assert.equal(process.env.FX_DATA_PROVIDER, "deterministic");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--disable-gpu"] });
const output = process.env.PERSONALIZATION_SCREENSHOT_DIR ?? "/tmp/investi-6a3b-screenshots";
await mkdir(output, { recursive: true });
const ids = [], errors = [];
const correct = ["ten", "ninety_six", "forty", "ask", "count"];
const weak = ["one", "hundred", "twenty", "bid", "no_risk"];
async function account() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Prague", reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `personalization-browser-${randomUUID()}@example.com`;
  const signup = () => context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Jana", email, password: randomUUID() } });
  let response = await signup();
  if (response.status() === 429) { await new Promise((resolve) => setTimeout(resolve, 11000)); response = await signup(); }
  assert.ok(response.ok(), `signup returned ${response.status()}`);
  const [{ id }] = await sql`select id from "user" where email = ${email}`;
  ids.push(id);
  return { page, context, id };
}
async function matrix(page, name) {
  for (const width of [1440, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflow at ${width}`);
    await page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflow at 320/200%`);
  const clipped = await page.locator('button, input, label, h1, h2, [role="radiogroup"]').evaluateAll((elements) => elements.filter((element) => element.clientWidth && element.scrollWidth > element.clientWidth + 2).map((element) => element.textContent));
  assert.deepEqual(clipped, [], `${name} clipped essential text`);
  if (["01-goal", "02-interests", "03-experience"].includes(name)) {
    assert.equal(await page.locator("html").getAttribute("lang"), "cs");
    // Overflow checks alone miss arbitrary mid-word breaks. Inspect rendered words.
    const brokenWords = await page.locator("label > span:first-of-type").evaluateAll((labels) => {
      const failures = [];
      const segmenter = new Intl.Segmenter("cs", { granularity: "word" });
      for (const label of labels) {
        const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (const { segment, index, isWordLike } of segmenter.segment(node.textContent)) {
            if (!isWordLike) continue;
            const range = document.createRange();
            range.setStart(node, index); range.setEnd(node, index + segment.length);
            const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
            if (lines.size > 1) failures.push(segment);
          }
        }
      }
      return failures;
    });
    assert.deepEqual(brokenWords, [], `${name} splits option words at 320/200%`);
  }
  await page.screenshot({ path: `${output}/${name}-320-text-200.png`, fullPage: true, animations: "disabled" });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function next(page) { await page.getByRole("button", { name: "Pokračovat", exact: true }).click(); }
async function preferences(page, { goal = "LONG_TERM_ETF", experience = "BEGINNER", screenshots = false } = {}) {
  await page.getByRole("heading", { name: "Co se chceš naučit?" }).waitFor();
  await page.locator(`input[value="${goal}"]`).check();
  if (screenshots) await matrix(page, "01-goal");
  await next(page);
  await page.locator('input[value="ETFS"]').check();
  await page.locator('input[value="DATA"]').check();
  if (screenshots) {
    await page.reload();
    await page.getByRole("heading", { name: "Co tě zajímá nejvíc?" }).waitFor();
    assert.ok(await page.locator('input[value="ETFS"]').isChecked());
    assert.ok(await page.locator('input[value="DATA"]').isChecked());
    await matrix(page, "02-interests");
    await page.getByRole("button", { name: "Zpět", exact: true }).click();
    assert.ok(await page.locator(`input[value="${goal}"]`).isChecked()); await next(page);
  }
  await next(page);
  await page.locator(`input[value="${experience}"]`).check();
  if (screenshots) await matrix(page, "03-experience");
  await next(page);
  await page.locator('input[value="10"]').check();
  if (screenshots) await matrix(page, "04-pace");
  await next(page);
}
async function diagnostic(page, answers, screenshots = false, failureCheck) {
  let finalRequest;
  await page.getByText("Výsledek nic neodemkne ani nepřeskakuje.").waitFor();
  await page.getByRole("button", { name: "Začít diagnostiku", exact: true }).click();
  for (let i = 0; i < answers.length; i++) {
    await page.locator(`input[value="${answers[i]}"]`).check();
    assert.equal(await page.getByText("Správná odpověď", { exact: true }).count(), 0);
    if (screenshots && i === 0) await matrix(page, "05-diagnostic");
    if (failureCheck && i === 0) await matrix(page, "12-retake-question");
    if (screenshots && i === 2) {
      await page.reload(); await page.locator(`input[value="${answers[i]}"]`).waitFor();
      assert.ok(await page.locator(`input[value="${answers[i]}"]`).isChecked());
    }
    if (i === 4 && failureCheck) {
      await page.route("**/*", (route) => route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort("failed") : route.continue());
      await page.getByRole("button", { name: "Zobrazit můj plán", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Odpovědi tu zůstaly" }).waitFor();
      assert.ok(await page.locator(`input[value="${answers[i]}"]`).isChecked());
      await failureCheck();
      await page.unroute("**/*");
    }
    const submissionRequest = i === 4 ? page.waitForRequest((request) => request.method() === "POST" && Boolean(request.headers()["next-action"])) : null;
    await page.getByRole("button", { name: i === 4 ? "Zobrazit můj plán" : "Další otázka", exact: true }).click({ clickCount: i === 4 ? 2 : 1 });
    if (submissionRequest) finalRequest = await submissionRequest;
  }
  await page.waitForURL("**/onboarding/plan");
  await page.getByRole("heading", { name: "Tvůj plán", exact: true }).waitFor();
  return finalRequest;
}
async function snapshot(id) {
  const state = {};
  for (const table of ["lesson_progress", "lesson_award", "progression_unlock", "portfolio"]) state[table] = await sql.unsafe(`select * from ${table} where user_id = $1 order by 1, 2`, [id]);
  state.trades = await sql`select t.* from portfolio_trade t join portfolio p on p.id = t.portfolio_id where p.user_id = ${id} order by t.id`;
  return JSON.parse(JSON.stringify(state));
}
async function noRewards(id) {
  const state = await snapshot(id);
  for (const rows of Object.values(state)) assert.equal(rows.length, 0);
}
try {
  if (process.env.PERSONALIZATION_QA_FOCUS !== "settings") {
  const a = await account();
  const response = await a.page.goto(`${baseURL}/onboarding`);
  assert.ok(!(await response.text()).includes('correctAnswer'));
  await preferences(a.page, { screenshots: true });
  await diagnostic(a.page, weak, true);
  await noRewards(a.id);
  await matrix(a.page, "06-plan");
  await a.page.reload(); await a.page.getByRole("heading", { name: "Tvůj plán", exact: true }).waitFor();
  await a.page.getByRole("link", { name: "Začít doporučenou lekci" }).click();
  await a.page.waitForURL("**/learn/investing-foundations/why-invest");
  await a.page.goto(`${baseURL}/learn`); await matrix(a.page, "07-learn");
  assert.equal(await a.page.getByRole("heading", { name: "Přizpůsobit učení" }).count(), 0);
  await a.page.goto(`${baseURL}/lab/portfolio`); await a.page.getByText(/0 \/ 420 XP/).waitFor();
  console.log("PASS A: beginner, refresh/back recovery, result, recommended lesson, no award/unlock; responsive matrix.");

  for (const [label, answers, expected] of [["B", weak, "foundations_needed"], ["C", correct, "strong_foundations"]]) {
    const c = await account(); await c.page.goto(`${baseURL}/onboarding`);
    await preferences(c.page, { experience: "INVESTOR" }); await diagnostic(c.page, answers);
    assert.equal(await c.page.getByRole("link", { name: "Začít doporučenou lekci" }).getAttribute("href"), "/learn/investing-foundations/why-invest");
    const [profile] = await sql`select diagnostic_result from learning_profile where user_id = ${c.id}`;
    assert.equal(profile.diagnostic_result.level, expected); await noRewards(c.id);
    await c.page.getByText("Jak si rozvrhnout učení", { exact: true }).click();
    await c.page.getByText(label === "B" ? "Dopřej si čas na vysvětlení a procvičení každého kroku." : "Známá vysvětlení můžeš číst svižněji. Všechny úlohy a ověření zůstávají součástí lekce.").waitFor();
    console.log(`PASS ${label}: authoritative evidence, unchanged Foundations requirement, no rewards/unlock.`);
  }

  }
  const e = await account();
  execFileSync("node_modules/.bin/tsx", ["--tsconfig", "scripts/tsconfig.persistence.json", "scripts/personalization-browser-fixtures.mts"], { env: { ...process.env, PERSONALIZATION_QA_USER_ID: e.id }, stdio: "pipe" });
  const before = await snapshot(e.id);
  await e.page.goto(`${baseURL}/learn`);
  await e.page.getByRole("heading", { name: "Přizpůsobit učení", exact: true }).waitFor();
  await matrix(e.page, "08-existing-prompt");
  await e.page.getByRole("button", { name: "Teď ne", exact: true }).click(); await e.page.reload();
  await e.page.getByRole("heading", { name: "Přizpůsobit učení", exact: true }).waitFor({ state: "hidden" });
  for (const path of ["progress", "lab/portfolio", "settings"]) { await e.page.goto(`${baseURL}/${path}`); assert.equal(new URL(e.page.url()).pathname, `/${path}`); }
  await e.page.goto(`${baseURL}/onboarding?personalize=1`);
  await preferences(e.page, { goal: "QUANT", experience: "INVESTOR" }); const initialRequest = await diagnostic(e.page, correct);
  assert.deepEqual(await snapshot(e.id), before);
  assert.equal(await e.page.getByRole("link", { name: "Začít doporučenou lekci" }).getAttribute("href"), "/learn/returns/what-is-a-return");
  await e.page.getByText("Výnosy tvoří základ pro pozdější práci s daty a analýzu rizika.").waitFor();
  console.log("PASS D/E: existing progress/420 XP/capital/trade preserved; quant recommends published Returns.");

  await e.page.goto(`${baseURL}/settings?section=goal`);
  await e.page.getByRole("button", { name: "Změnit cíl nebo úroveň…", exact: true }).click();
  await matrix(e.page, "09-settings");
  const [profileBefore] = await sql`select * from learning_profile where user_id = ${e.id}`;
  await e.page.locator('input[value="COMPANIES"]').check();
  await e.page.locator('input[value="STOCKS"]').check();
  await e.page.locator('input[value="BASIC"]').check();
  await e.page.locator('input[value="30"]').check();
  await e.page.route("**/*", (route) => route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort("failed") : route.continue());
  await e.page.getByRole("button", { name: "Uložit předvolby", exact: true }).click();
  await e.page.getByRole("alert").filter({ hasText: "Změny se nepodařilo uložit" }).waitFor();
  async function retained() {
    for (const value of ["COMPANIES", "BASIC", "30", "STOCKS", "ETFS", "DATA"]) assert.ok(await e.page.locator(`input[value="${value}"]`).isChecked(), `retained ${value}`);
    assert.equal(await e.page.locator('input[name="preference-0"]:checked').count(), 1);
    assert.equal(await e.page.locator('input[name="preference-2"]:checked').count(), 1);
    assert.equal(await e.page.locator('input[name="preference-3"]:checked').count(), 1);
  }
  await retained();
  assert.deepEqual((await sql`select * from learning_profile where user_id = ${e.id}`)[0], profileBefore);
  assert.deepEqual(await snapshot(e.id), before);
  await matrix(e.page, "11-settings-failed");
  await e.page.unroute("**/*");
  // Send a malformed session length through the real action to exercise server validation.
  await e.page.route("**/*", (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      const body = JSON.parse(request.postData()); body[0].preferredSessionMinutes = 999;
      return route.continue({ postData: JSON.stringify(body) });
    }
    return route.continue();
  });
  await e.page.getByRole("button", { name: "Uložit předvolby", exact: true }).click();
  await e.page.getByRole("alert").filter({ hasText: "Zkontroluj odpovědi" }).waitFor();
  await retained();
  assert.deepEqual((await sql`select * from learning_profile where user_id = ${e.id}`)[0], profileBefore);
  assert.equal(await e.page.locator('fieldset[aria-describedby="preferences-message"]').count(), 4);
  await e.page.unroute("**/*");
  let releaseSave;
  const gate = new Promise((resolve) => { releaseSave = resolve; });
  await e.page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) await gate;
    await route.continue();
  });
  await e.page.getByRole("button", { name: "Uložit předvolby", exact: true }).click();
  await e.page.getByRole("button", { name: "Ukládám předvolby…", exact: true }).waitFor();
  assert.ok(await e.page.getByRole("button", { name: "Ukládám předvolby…", exact: true }).isDisabled());
  assert.equal(await e.page.locator("fieldset:disabled").count(), 4);
  releaseSave();
  await e.page.getByRole("status").filter({ hasText: "Tvoje předvolby učení jsou uložené." }).waitFor();
  await e.page.unroute("**/*");
  await retained();
  await e.page.reload(); await e.page.getByRole("heading", { name: "Můj cíl a tempo", exact: true }).waitFor();
  await e.page.getByRole("button", { name: "Změnit cíl nebo úroveň…", exact: true }).click(); await retained();
  const [edited] = await sql`select * from learning_profile where user_id = ${e.id}`;
  assert.deepEqual(edited.goals, ["COMPANIES"]); assert.ok(edited.interests.includes("STOCKS")); assert.equal(edited.daily_goal_minutes, 30);
  assert.equal(edited.experience_level, "BASIC");
  assert.deepEqual(edited.diagnostic_result, profileBefore.diagnostic_result);
  assert.deepEqual(edited.personalized_onboarding_completed_at, profileBefore.personalized_onboarding_completed_at);
  assert.deepEqual(await snapshot(e.id), before);
  // Replaying an earlier successful initial submit must not overwrite later Settings edits.
  assert.ok(initialRequest);
  const replay = await e.context.request.post(initialRequest.url(), { headers: await initialRequest.allHeaders(), data: initialRequest.postData() });
  assert.ok(replay.ok());
  assert.deepEqual((await sql`select * from learning_profile where user_id = ${e.id}`)[0], edited);
  await e.page.goto(`${baseURL}/learn`); await e.page.getByText("Práce s výnosy ti pomůže porovnávat investice do jednotlivých firem.").waitFor();
  await e.page.goto(`${baseURL}/settings?section=learning`); await e.page.getByRole("link", { name: "Zopakovat krátkou diagnostiku", exact: true }).click();
  await e.page.waitForURL("**/onboarding?retake=1");
  await e.page.goBack(); await e.page.waitForURL("**/settings?section=learning");
  await e.page.getByRole("link", { name: "Zopakovat krátkou diagnostiku", exact: true }).click();
  await matrix(e.page, "10-retake"); await diagnostic(e.page, weak, false, async () => {
    assert.deepEqual((await sql`select * from learning_profile where user_id = ${e.id}`)[0], edited);
    assert.deepEqual(await snapshot(e.id), before);
  });
  const [retaken] = await sql`select * from learning_profile where user_id = ${e.id}`;
  assert.equal(retaken.diagnostic_result.level, "foundations_needed");
  assert.deepEqual(retaken.personalized_onboarding_completed_at, profileBefore.personalized_onboarding_completed_at);
  assert.deepEqual(await snapshot(e.id), before);
  console.log("PASS F: Settings network/validation failures retain all values; saving/retry/refresh, stale initial replay, retake failure/retry and browser back preserve progression/accounting and completion marker.");

  await e.page.goto(`${baseURL}/learn`);
  assert.equal(await e.page.getByRole("heading", { name: "Přizpůsobit učení", exact: true }).count(), 0);
  assert.equal(await e.page.getByRole("region", { name: "Doporučeno pro tebe" }).getByRole("link", { name: "Pokračovat", exact: true }).getAttribute("href"), "/learn/returns/what-is-a-return");
  await e.page.goto(`${baseURL}/settings?section=goal`);
  await e.page.getByRole("button", { name: "Změnit cíl nebo úroveň…", exact: true }).click();
  await e.page.locator('input[value="LONG_TERM_ETF"]').check();
  await e.page.getByRole("button", { name: "Uložit předvolby", exact: true }).click();
  await e.page.getByRole("status").filter({ hasText: "Tvoje předvolby učení jsou uložené." }).waitFor();
  await e.page.goto(`${baseURL}/learn`);
  await e.page.getByText("Výnosy jsou základem pro porovnávání výkonnosti ETF.").waitFor();
  assert.deepEqual(await snapshot(e.id), before);
  for (const mode of ["first-return", "all-returns"]) {
    execFileSync("node_modules/.bin/tsx", ["--tsconfig", "scripts/tsconfig.persistence.json", "scripts/personalization-browser-fixtures.mts"], { env: { ...process.env, PERSONALIZATION_QA_USER_ID: e.id, PERSONALIZATION_QA_LESSONS: mode }, stdio: "pipe" });
    await e.page.reload();
    const recommended = e.page.getByRole("region", { name: "Doporučeno pro tebe" });
    if (mode === "first-return") assert.equal(await recommended.getByRole("link", { name: "Pokračovat", exact: true }).getAttribute("href"), "/learn/returns/simple-returns");
    else {
      await recommended.getByRole("heading", { name: "Kurikulum máš za sebou.", exact: true }).waitFor();
      const completeAction = recommended.getByRole("link", { name: "Vyzkoušet v Labu", exact: true });
      assert.equal(await completeAction.getAttribute("href"), "/lab");
      await completeAction.click(); await e.page.waitForURL("**/lab");
      await e.page.goto(`${baseURL}/learn`);
    }
  }
  console.log("PASS: Learn quant and ETF explanations, next incomplete published lesson, curriculum-complete fallback.");

  const keyboard = await account(); await keyboard.page.goto(`${baseURL}/onboarding`);
  // All choices and progression in this attempt use keyboard events, including native radio arrows.
  async function tabTo(selector) {
    for (let i = 0; i < 35; i++) {
      if (await keyboard.page.evaluate((selector) => document.activeElement?.matches(selector), selector)) return;
      await keyboard.page.keyboard.press("Tab");
    }
    throw new Error(`Keyboard could not reach ${selector}`);
  }
  await keyboard.page.getByRole("heading", { name: "Co se chceš naučit?" }).waitFor();
  await tabTo('input[value="CONFIDENCE"]'); await keyboard.page.keyboard.press("Space");
  assert.ok(await keyboard.page.locator('input[value="CONFIDENCE"]').evaluate((el) => getComputedStyle(el.parentElement).outlineStyle !== "none"));
  await tabTo('button[type="submit"]'); await keyboard.page.keyboard.press("Enter");
  await keyboard.page.getByRole("heading", { name: "Co tě zajímá nejvíc?" }).waitFor();
  await tabTo('input[value="STOCKS"]'); await keyboard.page.keyboard.press("Space");
  await keyboard.page.keyboard.press("Tab"); await keyboard.page.keyboard.press("Space");
  for (const title of ["Jaké máš zkušenosti s investováním?", "Kolik času chceš učení běžně věnovat?", "Najdeme vhodný začátek"]) {
    await tabTo('button[type="submit"]'); await keyboard.page.keyboard.press("Enter");
    await keyboard.page.getByRole("heading", { name: title, exact: true }).waitFor();
  }
  await tabTo('button[type="submit"]'); await keyboard.page.keyboard.press("Enter");
  for (let i = 0; i < 5; i++) {
    await keyboard.page.locator('input[type="radio"]').first().waitFor();
    await tabTo('input[type="radio"]'); await keyboard.page.keyboard.press("Space");
    await keyboard.page.keyboard.press("ArrowDown");
    await tabTo('button[type="submit"]'); await keyboard.page.keyboard.press("Enter");
    if (i < 4) await keyboard.page.getByRole("status").filter({ hasText: `Otázka ${i + 2} z 5` }).waitFor();
  }
  await keyboard.page.waitForURL("**/onboarding/plan"); await noRewards(keyboard.id);
  console.log("PASS: keyboard-only completion, visible focus, native radio arrows and multiple checkboxes.");

  const skip = await account(); await skip.page.goto(`${baseURL}/onboarding`);
  await skip.page.getByRole("button", { name: "Přeskočit personalizaci", exact: true }).click(); await skip.page.waitForURL("**/learn");
  const [skipped] = await sql`select * from learning_profile where user_id = ${skip.id}`;
  assert.equal(skipped.experience_level, "BEGINNER"); assert.deepEqual(skipped.goals, []); assert.equal(skipped.diagnostic_result, null);
  assert.deepEqual(skipped.interests, []); assert.equal(skipped.daily_goal_minutes, 10); assert.ok(skipped.onboarding_completed_at); assert.equal(skipped.personalized_onboarding_completed_at, null);
  await skip.page.getByRole("region", { name: "Doporučeno pro tebe" }).getByRole("link", { name: "Pokračovat", exact: true }).waitFor();
  assert.equal(await skip.page.getByRole("region", { name: "Doporučeno pro tebe" }).getByRole("link", { name: "Pokračovat", exact: true }).getAttribute("href"), "/learn/investing-foundations/why-invest");
  await skip.page.getByText("Jak si rozvrhnout učení", { exact: true }).click();
  await skip.page.getByText("Procházej lekce vlastním tempem a zkoušej jednotlivé úlohy.").waitFor();
  await noRewards(skip.id);
  assert.deepEqual(errors, []);
  console.log(`PASS: double-click final submissions, skip defaults, no browser exceptions. Screenshots: ${output}`);
} finally {
  await browser.close();
  for (const id of ids) await sql`delete from "user" where id = ${id}`;
  await sql.end();
}
