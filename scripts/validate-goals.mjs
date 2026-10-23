import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { finishOnboarding } from "./onboarding-helper.mjs";

const baseURL = process.env.GOALS_TEST_URL ?? "http://localhost:3151";
const screenshots = process.env.GOALS_SCREENSHOT_DIR ?? "test-results/goals";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(process.env.DATABASE_URL && local(new URL(process.env.DATABASE_URL).hostname) && local(new URL(baseURL).hostname));
assert.equal(new URL(process.env.DATABASE_URL).pathname, "/investi_artifacts_qa");
assert.equal(process.env.ARTIFACTS_QA_DISPOSABLE, "1");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const email = `goals-${randomUUID()}@example.com`;
const lessonId = "before-investing-goals";
const contract = JSON.parse(await readFile("src/features/lessons/published-lessons-v1.json", "utf8")).find((lesson) => lesson.id === lessonId);
let userId;
await mkdir(screenshots, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Prague" });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const signed = await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Goals learner", email, password: randomUUID() } });
  assert.ok(signed.ok(), await signed.text());
  [{ id: userId }] = await sql`select id from "user" where email=${email}`;
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  await page.locator('details[data-level="L0"] > summary:visible').click();
  await page.getByRole("link", { name: /0.1.4.*Cíle a investiční horizont/ }).click();
  const next = () => page.getByRole("button", { name: "Pokračovat", exact: true });
  async function check() {
    await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).press("Enter");
    await page.getByRole("heading", { name: "Správně", exact: true }).waitFor();
  }
  async function reflow(step) {
    for (const width of [1440, 1024, 768, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${step} at ${width}px`);
      if (width === 390 || width === 1440) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.screenshot({ path: `${screenshots}/step-${String(step).padStart(2, "0")}-${width}.png`, fullPage: true });
      }
    }
    await page.evaluate(() => document.documentElement.style.fontSize = "200%");
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      await page.screenshot({ path: `${screenshots}/overflow-${step}.png`, fullPage: true });
      console.log(await page.evaluate(() => [...document.querySelectorAll("main *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(-12).map(el => ({tag:el.tagName,text:el.textContent?.slice(0,90),cls:el.className,box:el.getBoundingClientRect().toJSON()}))));
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${step}: 200% text at 320px`);
    await page.evaluate(() => document.documentElement.style.fontSize = "");
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  for (let position = 0; position < contract.steps.length; position++) {
    await page.locator('main[data-save-state="idle"]').waitFor();
    const grading = contract.steps[position].grading[0];
    if (grading) {
      if (grading.type === "categorizeQuestion") {
        for (const [item, category] of Object.entries(grading.answerKey)) await page.locator(`select`).nth(Object.keys(grading.answerKey).indexOf(item)).selectOption(category);
      } else {
        if (position === 4) {
          await page.locator('input[type="radio"][value="etf"]').press("Space");
          await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).press("Enter");
          await page.getByRole("heading", { name: "Zkus to ještě jednou", exact: true }).waitFor();
          await page.getByText(/V simulaci propad o 30 % snížil/).waitFor();
          await page.getByRole("button", { name: "Zkusit znovu", exact: true }).press("Enter");
        }
        await page.locator(`input[type="radio"][value="${grading.correctOptionId ?? grading.answerKey.answer}"]`).press("Space");
      }
      await check();
    }
    if (position === 8) {
      await page.locator("textarea").fill("S termínem zbývá méně času na zotavení. Nutný cíl nemohu odložit. Každý rok prověřím dostupnost peněz.");
      await page.getByRole("button", { name: "Odeslat a porovnat" }).click();
    }
    if (position === 9) {
      await page.getByRole("region", { name: "Vlastní mapa cílů", exact: true }).waitFor();
      assert.equal(await next().isDisabled(), true, "empty map cannot continue");
      await page.getByRole("checkbox", { name: "Zatím nemám konkrétní cíl", exact: true }).press("Space");
      await page.getByRole("checkbox", { name: /Souhlasím s uložením/ }).press("Space");
      await page.getByRole("button", { name: "Uložit výstup", exact: true }).press("Enter");
      await page.getByText("Výstup je uložený. Verze 1.", { exact: true }).waitFor();
      const emptyPlan = await page.context().newPage();
      await emptyPlan.goto(`${baseURL}/lab/plan`);
      assert.equal(await emptyPlan.getByLabel("Název cíle 1", { exact: true }).inputValue(), "");
      await emptyPlan.close();
      await page.getByRole("checkbox", { name: "Zatím nemám konkrétní cíl", exact: true }).uncheck();
      const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Prague" }).format(new Date()));
      await page.getByLabel("Název cíle 1", { exact: true }).fill("Modelové bydlení");
      await page.getByLabel("Částka cíle 1 (nepovinná)", { exact: true }).fill("300000,25");
      await page.getByLabel("Rok použití peněz pro cíl 1", { exact: true }).fill(String(year + 7));
      await page.getByLabel("Účel cíle 1", { exact: true }).selectOption("housing");
      assert.equal(await page.getByRole("button", { name: "Uložit výstup", exact: true }).isDisabled(), true);
      await page.getByRole("checkbox", { name: /Souhlasím s uložením/ }).press("Space");
      await page.getByRole("button", { name: "Uložit výstup", exact: true }).press("Enter");
      await page.getByText("Výstup je uložený. Verze 2.", { exact: true }).waitFor();
      await page.reload();
      await page.getByLabel("Název cíle 1", { exact: true }).waitFor();
      assert.equal(await page.getByLabel("Částka cíle 1 (nepovinná)", { exact: true }).inputValue(), "300000,25");
      await page.getByLabel("Název cíle 1", { exact: true }).focus();
      await page.keyboard.press("Tab");
      assert.equal(await page.getByLabel("Částka cíle 1 (nepovinná)", { exact: true }).evaluate((element) => element === document.activeElement), true);
      assert.notEqual(await page.getByLabel("Částka cíle 1 (nepovinná)", { exact: true }).evaluate((element) => getComputedStyle(element.parentElement).outlineStyle), "none");
      await page.getByLabel("Název cíle 1", { exact: true }).fill("Modelové bydlení upravené");
      await page.getByRole("checkbox", { name: /Souhlasím s uložením/ }).check();
      await page.getByRole("button", { name: "Uložit výstup", exact: true }).click();
      await page.getByText("Výstup je uložený. Verze 3.", { exact: true }).waitFor();
      for (let i = 2; i <= 5; i++) {
        await page.getByRole("button", { name: "Přidat cíl", exact: true }).click();
        await page.getByLabel(`Název cíle ${i}`, { exact: true }).fill(`Modelový cíl ${i}`);
        await page.getByLabel(`Rok použití peněz pro cíl ${i}`, { exact: true }).fill(String(year + i));
      }
      assert.equal(await page.getByRole("button", { name: "Přidat cíl", exact: true }).isDisabled(), true);
      for (let i = 5; i >= 2; i--) await page.getByRole("button", { name: `Odebrat cíl ${i}`, exact: true }).click();
      const planPage = await page.context().newPage();
      await planPage.goto(`${baseURL}/lab/plan`);
      assert.equal(await planPage.getByLabel("Název cíle 1", { exact: true }).inputValue(), "Modelové bydlení upravené");
      await planPage.close();
      const exported = await (await page.request.get(`${baseURL}/api/account/export`)).json();
      assert.equal(exported.learnerArtifacts.filter((entry) => entry.kind === "goal_map").length, 3);
      assert.equal(exported.learnerArtifacts.find((entry) => entry.kind === "goal_map" && entry.payload.goals.length).payload.goals[0].amountMinor, "30000025");
    }
    await reflow(position + 1);
    if (position < contract.steps.length - 1) {
      await next().click();
      await page.locator('main[data-save-state="idle"]').waitFor();
      const [{ last_position }] = await sql`select last_position from lesson_progress where user_id=${userId} and lesson_id=${lessonId}`;
      assert.equal(last_position, position + 1);
      if (position === 4) await page.reload();
    }
  }
  await page.getByRole("button", { name: "Dokončit lekci", exact: true }).click();
  await page.getByRole("heading", { name: "Lekce dokončena", exact: true }).waitFor();
  const before = await sql`select * from lesson_progress where user_id=${userId} and lesson_id=${lessonId}`;
  await page.goto(`${baseURL}/settings`);
  await page.getByRole("link", { name: "Moje data", exact: true }).first().click();
  await page.getByRole("button", { name: "Smazat: Mapa cílů", exact: true }).click();
  await page.getByRole("button", { name: "Smazat všechny verze", exact: true }).click();
  await page.getByText("Mapa cílů: všechny verze jsou smazané.", { exact: true }).waitFor();
  assert.equal((await sql`select * from learner_artifact where user_id=${userId}`).length, 0);
  assert.deepEqual(await sql`select * from lesson_progress where user_id=${userId} and lesson_id=${lessonId}`, before);
  assert.equal((await sql`select * from lesson_award where user_id=${userId} and lesson_id=${lessonId}`).length, 1);
  assert.deepEqual(errors, []);
  console.log("PASS: goals lesson complete/retry/resume, exact save/edit/reload, consent, IPS prefill, export/deletion, lifetime progress, keyboard/focus, six widths and 200% text; all steps captured.");
} finally {
  if (userId) await sql`delete from "user" where id=${userId}`;
  await browser.close();
  await sql.end();
}
