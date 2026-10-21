// Local production acceptance: disposable learner, real lesson actions and reward receipts.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { finishOnboarding } from "./onboarding-helper.mjs";

const baseURL = process.env.RETURNS_TEST_URL ?? "http://localhost:3000";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Requires a local app/database.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Prague", extraHTTPHeaders: { "x-forwarded-for": "127.0.0.65" } });
const page = await context.newPage();
const screenshotDir = process.env.RETURNS_SCREENSHOT_DIR ?? "/tmp/investi-log-returns-qa";
await mkdir(screenshotDir, { recursive: true });
const email = `log-returns-${randomUUID()}@example.com`;
let userId;
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (["warning", "error"].includes(message.type())) errors.push(message.text()); });
const heading = (name) => page.getByRole("heading", { name, exact: true }).waitFor();
const button = (name) => page.getByRole("button", { name, exact: true });
const next = async (name) => { await button("Pokračovat").click(); await heading(name); };
const snapshot = async () => ({
  progress: Array.from(await sql`select * from lesson_progress where user_id = ${userId} order by lesson_id`),
  awards: Array.from(await sql`select * from lesson_award where user_id = ${userId} order by lesson_id`),
  grants: Array.from(await sql`select * from progression_unlock where user_id = ${userId} order by unlock_id`),
});
async function answer(index, correct = true) {
  await page.getByRole("radio").nth(index).check();
  await button("Zkontrolovat odpověď").click();
  await heading(correct ? "Správně" : "Zkus to ještě jednou");
}
async function layout(label, screenshots = false) {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => { window.scrollTo(0, 0); await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: overflow at ${width}`);
    assert.equal(await page.getByText("Tento vzorec se nepodařilo zobrazit.", { exact: true }).count(), 0);
    const action = button("Pokračovat").or(button("Zkontrolovat odpověď")).or(button("Dokončit lekci"));
    if (await action.count()) assert.ok((await action.first().boundingBox()).height >= 44, "primary action has a usable touch target");
    if (screenshots && [320, 390, 1440].includes(width)) await page.screenshot({ path: `${screenshotDir}/${label}-${width}.png`, fullPage: true, animations: "disabled" });
  }
}
const titles = ["Deset nahoru, deset dolů", "Proč jednoduché výnosy nesčítáme", "Seznam se s logaritmickým výnosem", "Převeď výnos tam a zpět", "Od násobení ke sčítání", "Blízko neznamená stejně", "Spoj dvě období správně", "Shrň si to"];
try {
  // Registration now ends onboarding; create the account directly, then onboard as a signed-in learner.
  assert.ok((await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Log returns QA", email, password: randomUUID() } })).ok());
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  [{ id: userId }] = await sql`select id from "user" where email = ${email}`;
  // Fixture: predecessors completed; L4 and L5 are completed through the UI below.
  const predecessors = await sql`select id from lesson where is_published and id not in ('returns-comparing', 'returns-log-returns')`;
  for (const { id } of predecessors) {
    await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, completed_at, updated_at) values (${userId}, ${id}, 'completed', 0, now() - interval '1 day', now() - interval '1 day')`;
    await sql`insert into lesson_award (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at) values (${userId}, ${id}, 60, 0, 2, current_date - 1, 'Europe/Prague', now() - interval '1 day')`;
  }
  await page.goto(`${baseURL}/learn/returns/comparing-investments`);
  await heading("Stejná cena, stejný výsledek?");
  await answer(1);
  await next("Co měří cenový výnos");
  await next("Připočti vyplacenou hotovost");
  await next("Celkový výnos potřebuje metodiku");
  await page.getByRole("textbox", { name: "Cenový výnos", exact: true }).fill("5");
  await page.getByRole("textbox", { name: "Zjednodušený výsledek včetně hotovosti", exact: true }).fill("7");
  await button("Zkontrolovat odpověď").click();
  await heading("Správně");
  await next("Porovnávej na společném základě");
  await next("Přečti výnos v Labu správně");
  await next("Stačí shodných osm procent?");
  await answer(1);
  await next("Shrň si to");
  await button("Dokončit lekci").click();
  await heading("Lekce dokončena");
  // Completing Foundations fixtures may unlock Lab; module path still publishes the next lesson. The fixture already completed the checkpoint.
  await page.getByRole("link", { name: "Zobrazit modul", exact: true }).click();
  await heading("Výnos a složené zhodnocení");
  assert.equal(await page.getByTestId("module-progress").textContent(), "5 / 6 lekcí dokončeno");
  const items = page.getByRole("listitem");
  assert.match((await items.allTextContents()).join("|"), /Cenový a celkový výnos.*\|.*Logaritmické výnosy.*\|.*Kontrola výnosů/s);
  assert.equal(await items.filter({ hasText: "Kontrola výnosů" }).getByRole("button", { name: "Zopakovat lekci" }).count(), 1, "the checkpoint is published and reviewable");
  const before = await snapshot();
  await items.filter({ hasText: "Logaritmické výnosy" }).getByRole("button", { name: "Začít lekci" }).click();
  await heading(titles[0]);
  assert.equal(await page.getByRole("navigation", { name: /^(Hlavní|Mobilní) navigace$/ }).count(), 0);
  await layout("prediction");
  // Keyboard selection, visible focus, incorrect feedback, retry and focus on Continue.
  await page.getByRole("radio").first().press("Space");
  await page.getByRole("radio").first().press("Tab");
  assert.equal(await button("Zkontrolovat odpověď").evaluate((el) => el === document.activeElement && el.matches(":focus-visible")), true);
  await button("Zkontrolovat odpověď").press("Enter");
  await heading("Zkus to ještě jednou");
  assert.equal((await sql`select last_position from lesson_progress where user_id = ${userId} and lesson_id = 'returns-log-returns'`)[0].last_position, 0);
  await button("Zkusit znovu").click();
  await page.getByRole("radio").first().press("Space");
  await page.getByRole("radio").first().press("ArrowDown");
  await page.getByRole("radio").nth(1).press("Tab");
  await button("Zkontrolovat odpověď").press("Enter");
  await heading("Správně");
  assert.equal(await button("Pokračovat").evaluate((el) => el === document.activeElement), true);
  await next(titles[1]);
  await layout("multiplication");
  await next(titles[2]);
  assert.equal(await page.locator("math").count(), 1);
  // KaTeX CSS is imported by the formula components, not the root layout: its rules must still apply here.
  assert.deepEqual(await page.locator(".katex").first().evaluate((el) => ({ font: getComputedStyle(el).fontFamily.split(",")[0], mathml: getComputedStyle(el.querySelector(".katex-mathml")).position })), { font: "KaTeX_Main", mathml: "absolute" });
  await layout("definition", true);
  // The step shows before its cursor is saved; reload once the save has landed.
  await page.locator('main[data-save-state="idle"]').waitFor();
  await page.reload();
  await heading(titles[2]);
  await button("Předchozí").click();
  await heading(titles[1]);
  await next(titles[2]);
  await page.getByRole("textbox", { name: "Tvoje odpověď", exact: true }).fill("10");
  await button("Zkontrolovat odpověď").click();
  await heading("Zkus to ještě jednou");
  await button("Zkusit znovu").click();
  await page.getByRole("textbox", { name: "Tvoje odpověď", exact: true }).fill("9,531");
  await button("Zkontrolovat odpověď").click();
  await heading("Správně");
  await next(titles[3]);
  assert.equal(await page.locator("math").count(), 2);
  await layout("conversion", true);
  await next(titles[4]);
  assert.equal(await page.locator("math").count(), 1);
  await layout("addition", true);
  await next(titles[5]);
  await layout("small-moves");
  await answer(0, false);
  await button("Zkusit znovu").click();
  await answer(1);
  await next(titles[6]);
  await layout("comparison", true);
  await answer(1, false);
  await button("Zkusit znovu").click();
  await answer(2);
  await next(titles[7]);
  await layout("summary", true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "summary reflows with 200% text");
  await page.evaluate(() => document.documentElement.style.fontSize = "");
  await button("Dokončit lekci").click();
  await heading("Lekce dokončena");
  assert.equal(await page.getByLabel("Získáno 60 XP", { exact: true }).count(), 1);
  assert.match(await page.getByTestId("completion-progress").textContent(), /: 6 /);
  const completed = await snapshot();
  const receipt = completed.awards.find((award) => award.lesson_id === "returns-log-returns");
  assert.equal(receipt.xp, 60);
  assert.equal(receipt.reward_policy_version, 4);
  assert.equal(BigInt(receipt.practice_capital_minor), 200_000n);
  assert.deepEqual(completed.awards.filter((award) => award.lesson_id !== "returns-log-returns"), before.awards);
  assert.deepEqual(completed.progress.filter((row) => row.lesson_id !== "returns-log-returns"), before.progress);
  assert.deepEqual(completed.grants, before.grants);
  await button("Prozkoumat Lab").click();
  await page.waitForURL("**/lab");
  await page.goto(`${baseURL}/learn/returns`);
  await heading("Výnos a složené zhodnocení");
  assert.equal(await page.getByTestId("module-progress").textContent(), "6 / 6 lekcí dokončeno");
  await items.filter({ hasText: "Logaritmické výnosy" }).getByRole("button", { name: "Zopakovat lekci" }).click();
  for (let step = 0; step < titles.length; step++) {
    await heading(titles[step]);
    await page.setViewportSize({ width: 768, height: 1000 });
    await page.evaluate(() => document.documentElement.style.fontSize = "200%");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `step ${step + 1} reflows with 200% text`);
    await page.evaluate(() => document.documentElement.style.fontSize = "");
    if (step === 2) {
      await page.getByRole("textbox", { name: "Tvoje odpověď", exact: true }).fill("9,531");
      await button("Zkontrolovat odpověď").click();
      await heading("Správně");
    }
    if ([0, 5, 6].includes(step)) await answer({ 0: 1, 5: 1, 6: 2 }[step]);
    if (step < titles.length - 1) await next(titles[step + 1]);
  }
  await button("Dokončit opakování").click();
  await heading("Opakování dokončeno");
  assert.equal(await page.getByLabel("Získáno 60 XP", { exact: true }).count(), 0);
  assert.deepEqual(await snapshot(), completed, "full replay preserves all receipts and persisted progress");
  await page.goto(`${baseURL}/learn/investing-foundations/foundations-checkpoint`);
  // Next streams notFound with HTTP 200 after headers have been sent.
  await heading("Tahle lekce zatím není k dispozici");
  assert.ok(await page.locator('meta[name="robots"][content="noindex"]').count() >= 1);
  assert.equal(await page.locator("#step-title").count(), 0);
  assert.equal((await sql`select * from lesson_progress where user_id = ${userId} and lesson_id = 'foundations-checkpoint'`).length, 0);
  const actionable = errors.filter((message) => !message.startsWith("You have Reduced Motion enabled on your device.") && !message.includes("404 (Not Found)"));
  assert.deepEqual(actionable, []);
  console.log(`PASS: L4→L5 path, all eight steps at six widths, formulas, keyboard/retry/focus, resume/Previous, 200% text, reduced motion, 60 XP once, full review preservation, Lab navigation and planned not-found. Screenshots: ${screenshotDir}`);
} finally {
  await browser.close();
  if (userId) await sql`delete from "user" where id = ${userId} and email = ${email}`;
  await sql.end();
}
