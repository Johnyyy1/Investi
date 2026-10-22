import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { finishOnboarding } from "./onboarding-helper.mjs";

const baseURL = process.env.BUDGET_TEST_URL ?? "http://localhost:3148";
const screenshots = process.env.BUDGET_SCREENSHOT_DIR ?? "test-results/budget";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(process.env.DATABASE_URL && local(new URL(process.env.DATABASE_URL).hostname) && local(new URL(baseURL).hostname), "Requires local app and QA database");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const email = `budget-${randomUUID()}@example.com`;
let userId;
const titles = ["Kolik může Petra investovat?", "Sečti příjmy a výdaje", "Spočítej míru úspor", "Nezapomeň na roční platby", "Oprav Petřin rozpočet", "Rozliš druhy výdajů", "Zařaď výdaje", "Rozhodni o přebytku", "Vyzkoušej vlastní rozpočet", "Vybav si postup", "Vysvětli změnu a zvol pojistku", "Co si odneseš"];
const path = "/learn/before-investing/budget";
await mkdir(screenshots, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Prague" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  const posts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.method() === "POST") posts.push(request.postData() ?? ""); });
  const signed = await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Budget learner", email, password: randomUUID() } });
  assert.ok(signed.ok(), await signed.text());
  [{ id: userId }] = await sql`select id from "user" where email = ${email}`;
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  await page.locator('details[data-level="L0"] > summary').click();
  await page.getByRole("link", { name: /0.1.1.*Kolik ti zbývá/ }).click();

  async function check() {
    await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
    await page.getByRole("heading", { name: "Správně", exact: true }).waitFor();
  }
  async function wrongNumber(wrong, feedback, right) {
    const input = page.getByLabel("Tvoje odpověď", { exact: true });
    await input.fill(wrong);
    await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).press("Enter");
    await page.getByRole("heading", { name: "Zkus to ještě jednou", exact: true }).waitFor();
    await page.getByText(feedback, { exact: false }).waitFor();
    await page.getByRole("button", { name: "Zkusit znovu", exact: true }).press("Enter");
    await input.fill(right);
    await check();
  }
  async function reflow(step) {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${step} at ${width}px`);
      if (width !== 320) await page.screenshot({ path: `${screenshots}/step-${step}-${width}.png`, fullPage: step !== 3 });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  for (let index = 0; index < titles.length; index++) {
    await page.getByRole("heading", { level: 2, name: titles[index], exact: true }).waitFor();
    await page.locator('main[data-save-state="idle"]').waitFor();
    await reflow(index + 1);
    if (index === 0) {
      const answer = page.getByLabel("Kolik jí zbývá po všech výdajích, včetně ročních plateb.", { exact: true });
      await answer.press("Space");
      await check();
    } else if (index === 2) {
      await wrongNumber("26,7", "Míru úspor dělíme příjmem, ne výdaji", "21,1");
    } else if (index === 3) {
      await wrongNumber("7200", "7 200 Kč je roční součet", "600");
    } else if (index === 6) {
      const categories = { "Měsíční nájem": "fixed", "Měsíční předplatné filmů": "fixed", "Dárky k Vánocům": "irregular", "Nákup potravin": "variable", "STK": "irregular", "Měsíční splátka hypotéky": "fixed", "Nečekaná oprava pračky": "irregular", "Jednotlivá jízdenka": "variable" };
      for (const [label, category] of Object.entries(categories)) await page.getByRole("combobox", { name: new RegExp(label) }).selectOption(category);
      await check();
    } else if (index === 7) {
      await page.getByLabel("Zjistit, které výdaje chybí v rozpočtu, a zastavit další čerpání karty.", { exact: true }).check();
      await check();
    } else if (index === 8) {
      const calculator = page.getByRole("region", { name: "Kalkulačka rozpočtu", exact: true });
      const result = page.getByRole("region", { name: "Výsledek rozpočtu", exact: true });
      assert.match(await result.innerText(), /19,5 %/);
      const currency = calculator.locator("span").filter({ hasText: /^Kč$/ }).first();
      assert.equal(await currency.evaluate((element) => getComputedStyle(element).whiteSpace), "nowrap", "currency suffix never splits across lines");
      await calculator.getByRole("button", { name: "Vyplnit vlastní rozpočet", exact: true }).click();
      assert.equal(await result.count(), 0, "blank input has no stale result");
      const income = page.getByLabel("Čistý měsíční příjem", { exact: true });
      await income.fill("41237,25");
      await page.getByLabel("Fixní měsíční výdaje", { exact: true }).fill("17123,1");
      await page.getByLabel("Variabilní měsíční výdaje", { exact: true }).fill("9361,25");
      await page.getByLabel("Nepravidelné výdaje za rok", { exact: true }).fill("5137,33");
      assert.equal(await result.count(), 1);
      await income.focus();
      await income.press("Tab");
      assert.equal(await page.getByLabel("Fixní měsíční výdaje", { exact: true }).evaluate((element) => element === document.activeElement), true, "native keyboard order");
      const focusedOutline = await page.getByLabel("Fixní měsíční výdaje", { exact: true }).evaluate((element) => getComputedStyle(element.parentElement).outlineStyle);
      assert.notEqual(focusedOutline, "none", "visible keyboard focus");
      await income.fill("bad");
      assert.equal(await income.getAttribute("aria-invalid"), "true");
      assert.equal(await result.count(), 0);
      await income.fill("0");
      assert.match(await result.innerText(), /Nelze určit při nulovém příjmu/);
      assert.match(await result.innerText(), /Měsíční schodek/);
      await income.fill("41237,25");
      await page.setViewportSize({ width: 320, height: 900 });
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "calculator reflows at 320px and 200% text");
      await page.screenshot({ path: `${screenshots}/calculator-320-200.png`, fullPage: true });
      await page.evaluate(() => { document.querySelectorAll("style").forEach((style) => { if (style.textContent.includes("font-size: 200%")) style.remove(); }); });
      await page.setViewportSize({ width: 1440, height: 900 });
      assert.equal(posts.some((post) => /41237|17123|9361|5137/.test(post)), false, "personal budget drafts never reach the network");
      assert.equal(await page.evaluate(() => /41237|17123|9361|5137/.test(JSON.stringify({ ...localStorage, ...sessionStorage }))), false, "budget drafts never enter browser storage");
    } else if (index === 9) {
      await page.getByLabel("Dělím přebytek čistým příjmem, zahrnu i roční platby a ověřím dluhy, rezervu a cíle.", { exact: true }).check();
      await check();
    } else if (index === 10) {
      await page.getByLabel("Tvoje odpověď", { exact: true }).fill("Roční platby zvýšily měsíční výdaje. Přebytek proto klesl. Vytvořím si seznam ročních plateb.");
      await page.getByRole("button", { name: "Odeslat a porovnat", exact: true }).click();
      await page.getByRole("complementary", { name: "Ukázková odpověď", exact: true }).waitFor();
    }
    if (index < titles.length - 1) {
      await page.getByRole("button", { name: "Pokračovat", exact: true }).click();
      await page.locator('main[data-save-state="idle"]').waitFor();
      if (index === 8) {
        await page.getByRole("heading", { level: 2, name: titles[9], exact: true }).waitFor();
        await page.getByRole("button", { name: "Předchozí", exact: true }).click();
        await page.getByRole("heading", { level: 2, name: titles[8], exact: true }).waitFor();
        assert.equal(await page.getByLabel("Čistý měsíční příjem", { exact: true }).inputValue(), "38000", "leaving the calculator clears personal drafts");
        await page.getByRole("button", { name: "Pokračovat", exact: true }).click();
        await page.locator('main[data-save-state="idle"]').waitFor();
      }
      if (index === 2) {
        await page.reload();
        assert.equal((await sql`select last_position from lesson_progress where user_id = ${userId} and lesson_id = 'before-investing-budget'`)[0].last_position, 3);
      }
    }
  }
  await page.getByRole("button", { name: "Dokončit lekci", exact: true }).click();
  await page.getByRole("heading", { name: "Lekce dokončena", exact: true }).waitFor();
  const receipts = await sql`select xp, practice_capital_minor::text, reward_policy_version from lesson_award where user_id = ${userId} and lesson_id = 'before-investing-budget'`;
  assert.deepEqual(receipts.map((row) => ({ ...row })), [{ xp: 60, practice_capital_minor: "0", reward_policy_version: 4 }]);
  assert.equal((await sql`select * from progression_unlock where user_id = ${userId}`).length, 0, "L0 completion does not unlock Lab");
  assert.equal(posts.some((post) => /41237|17123|9361|5137/.test(post)), false, "continuation and completion do not submit personal budget values");
  await page.goto(`${baseURL}${path}`);
  await page.getByRole("heading", { level: 2, name: titles[0], exact: true }).waitFor();
  assert.equal((await sql`select count(*)::int as count from lesson_award where user_id = ${userId} and lesson_id = 'before-investing-budget'`)[0].count, 1);
  assert.deepEqual(errors, [], "no browser or hydration errors");
  console.log("Budget lesson: complete/retry/resume, all eight categories, private calculator, XP-only receipt, keyboard, 320/390/1440px and 200% text passed.");
} finally {
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await browser.close();
  await sql.end();
}
