import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { finishOnboarding } from "./onboarding-helper.mjs";

const baseURL = process.env.CHECKUP_TEST_URL ?? "http://localhost:3154";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname));
assert.equal(new URL(process.env.DATABASE_URL).pathname, "/investi_artifacts_qa");
assert.equal(process.env.ARTIFACTS_QA_DISPOSABLE, "1");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const email = `checkup-${randomUUID()}@example.com`;
const lessonId = "before-investing-checkup";
const contract = JSON.parse(await readFile("src/features/lessons/published-lessons-v1.json", "utf8")).find((lesson) => lesson.id === lessonId);
const shots = process.env.CHECKUP_SCREENSHOT_DIR ?? "test-results/financial-checkup";
await mkdir(shots, { recursive: true });
let userId;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Prague" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const signup = await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Checkup learner", email, password: randomUUID() } });
  assert.ok(signup.ok(), await signup.text());
  [{ id: userId }] = await sql`select id from "user" where email=${email}`;
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  await page.goto(`${baseURL}/learn/before-investing/financial-checkup`);
  const next = () => page.getByRole("button", { name: "Pokračovat", exact: true });
  async function save(version) {
    await page.getByRole("checkbox", { name: /Souhlasím s uložením/ }).press("Space");
    await page.getByRole("button", { name: "Uložit výstup", exact: true }).press("Enter");
    await page.getByText(`Výstup je uložený. Verze ${version}.`, { exact: true }).waitFor();
  }
  async function reflow(step) {
    for (const width of [1440, 1024, 768, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${step}: ${width}px`);
      if ([1440, 390].includes(width)) await page.screenshot({ path: `${shots}/step-${step}-${width}.png`, fullPage: true });
    }
    await page.evaluate(() => document.documentElement.style.fontSize = "200%");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${step}: 200% at 320px`);
    await page.evaluate(() => document.documentElement.style.fontSize = "");
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  for (let position = 0; position < contract.steps.length; position++) {
    await page.locator('main[data-save-state="idle"]').waitFor();
    if (position === 0) {
      await page.getByRole("combobox").first().waitFor();
      assert.equal(await next().isDisabled(), true);
      const values = ["building", "plan_needed", "needs_review", "unknown", "needs_review"];
      for (const [index, value] of values.entries()) await page.getByRole("combobox").nth(index).selectOption(value);
      assert.equal(await page.getByRole("button", { name: "Uložit výstup", exact: true }).isDisabled(), true, "consent required");
      await save(1);
      await page.getByRole("heading", { name: "Nejdřív plán splácení drahého dluhu", exact: true }).waitFor();
      await page.reload();
      await page.getByText("Aktuální check-up je uložený.", { exact: true }).waitFor();
      assert.equal(await page.getByRole("combobox").nth(1).inputValue(), "plan_needed");
      const plan = await context.newPage();
      await plan.goto(`${baseURL}/lab/plan`);
      assert.equal(await plan.getByLabel("Pohotovostní rezerva", { exact: true }).inputValue(), "building");
      assert.equal(await plan.getByLabel("Drahý dluh", { exact: true }).inputValue(), "plan_needed");
      await plan.close();
      const learn = await context.newPage();
      await learn.goto(`${baseURL}/onboarding/plan`);
      await learn.getByText(/Podle uloženého check-upu/).waitFor();
      await learn.close();
    }
    const grading = contract.steps[position].grading[0];
    if (grading) {
      if (position === 1) {
        await page.getByRole("textbox", { name: "Tvoje odpověď", exact: true }).fill("20");
        await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).press("Enter");
        await page.getByRole("heading", { name: "Zkus to ještě jednou", exact: true }).waitFor();
        assert.equal(await page.getByRole("link", { name: "Zopakovat související téma" }).getAttribute("href"), "/learn/before-investing/budget");
        await page.getByRole("button", { name: "Zkusit znovu", exact: true }).press("Enter");
        await page.waitForFunction(() => [...document.querySelectorAll('main input[type="text"]')].every((input) => !input.disabled && !input.value));
      }
      if (grading.type === "numericQuestion") await page.getByRole("textbox", { name: "Tvoje odpověď", exact: true }).fill(String(grading.answer).replace(".", ","));
      else await page.locator(`input[type="radio"][value="${grading.correctOptionId}"]`).press("Space");
      await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).press("Enter");
      await page.getByRole("heading", { name: "Správně", exact: true }).waitFor();
    }
    if (position === 6) {
      await page.locator("textarea").fill("Každý měsíc prověřím rozpočet. Při změně příjmu znovu posoudím rezervu a plán splácení.");
      await page.getByRole("button", { name: "Odeslat a porovnat" }).click();
    }
    if (position === 7) {
      await page.getByText("Upravit check-up", { exact: true }).click();
      await page.getByRole("combobox").first().waitFor();
      await page.getByRole("combobox").nth(1).selectOption("none");
      await save(2);
      await page.getByRole("heading", { name: "Nejdřív dobudovat nebo prověřit rezervu", exact: true }).waitFor();
      await page.getByText("Upravit check-up", { exact: true }).click();
    }
    await reflow(position);
    if (position < contract.steps.length - 1) {
      await next().press("Enter");
      await page.locator('main[data-save-state="idle"]').waitFor();
      const [{ last_position }] = await sql`select last_position from lesson_progress where user_id=${userId} and lesson_id=${lessonId}`;
      assert.equal(last_position, position + 1);
      if (position === 3) await page.reload();
    }
  }
  await page.getByRole("button", { name: "Dokončit lekci", exact: true }).click();
  await page.getByRole("heading", { name: "Lekce dokončena", exact: true }).waitFor();
  const before = await sql`select * from lesson_progress where user_id=${userId} and lesson_id=${lessonId}`;
  const receipts = await sql`select * from lesson_award where user_id=${userId} and lesson_id=${lessonId}`;
  assert.equal(receipts.length, 1); assert.equal(Number(receipts[0].practice_capital_minor), 0);
  const exported = await (await page.request.get(`${baseURL}/api/account/export`)).json();
  assert.equal(exported.learnerArtifacts.filter((artifact) => artifact.kind === "financial_checkup").length, 2);
  assert.equal((await sql`select * from skill_attempt where user_id=${userId}`).length, 6);
  await page.goto(`${baseURL}/learn/before-investing/financial-checkup`);
  await page.getByRole("combobox").first().waitFor();
  assert.equal(await page.getByRole("combobox").nth(1).inputValue(), "none");
  await page.goto(`${baseURL}/settings`);
  await page.getByRole("link", { name: "Moje data", exact: true }).first().click();
  await page.getByRole("button", { name: "Smazat: Finanční check-up", exact: true }).click();
  await page.getByRole("button", { name: "Smazat všechny verze", exact: true }).click();
  await page.getByText("Finanční check-up: všechny verze jsou smazané.", { exact: true }).waitFor();
  assert.equal((await sql`select * from learner_artifact where user_id=${userId}`).length, 0);
  assert.deepEqual(await sql`select * from lesson_progress where user_id=${userId} and lesson_id=${lessonId}`, before);
  assert.deepEqual(await sql`select * from lesson_award where user_id=${userId} and lesson_id=${lessonId}`, receipts);
  assert.deepEqual(errors, []);
  console.log("PASS: financial check-up consent, save/edit/reload, deterministic advice, IPS prefill, incorrect/retry, mastery, completion/review, export/deletion and preserved receipts; six widths and 200% text.");
} finally {
  if (userId) await sql`delete from "user" where id=${userId}`;
  await browser.close(); await sql.end();
}
