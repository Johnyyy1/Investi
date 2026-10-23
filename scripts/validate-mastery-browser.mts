/**
 * Skill mastery in the browser (#122): a lesson Check records lesson evidence; the Foundations mixed checkpoint
 * interleaves lessons, survives a failed save, records one server-evaluated attempt per question and moves the
 * skills shown in Progress, without touching lesson progress or rewards.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import axe from "axe-core";
import postgres from "postgres";
import { chromium, type Page } from "playwright";
import { availableLessons } from "../src/features/learning/catalog";
import { skills } from "../src/features/learning/curriculum";
import { correctAnswers } from "../src/features/lessons/answer-keys";
import { isQuestion, type QuestionBlock } from "../src/features/lessons/question-evaluation";
import { mixedCheckpoint } from "../src/features/mastery/domain";
import { lessonSteps } from "../src/features/progress/transition";

const baseURL = process.env.MASTERY_TEST_URL ?? process.env.BETTER_AUTH_URL!;
assert.equal(process.env.MASTERY_QA_DISPOSABLE, "1");
for (const value of [baseURL, process.env.DATABASE_URL!]) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname));
const output = process.env.MASTERY_SCREENSHOT_DIR ?? "test-results/mastery"; await mkdir(output, { recursive: true });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const ids: string[] = []; const errors: string[] = [];
const axeViolations = (page: Page) => page.evaluate(async () => (await (window as unknown as { axe: typeof axe }).axe.run(document.querySelector("main")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations
  .filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => violation.id));
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const block = (lessonId: string, blockId: string) => lessonSteps(lessonId).flatMap((step) => step.blocks).find((entry): entry is QuestionBlock => entry.id === blockId && isQuestion(entry))!;
/** Foundations items are multiple choice or numeric; `wrong` picks another option or another number. */
async function answer(page: Page, question: QuestionBlock, wrong = false) {
  const value = correctAnswers(question).answer;
  if (question.type === "multipleChoiceQuestion") await page.locator(`input[type="radio"][name="${question.id}"][value="${wrong ? question.options.find((option) => option.id !== value)!.id : value}"]`).check();
  else await page.getByLabel("Tvoje odpověď").fill(wrong ? `${Number(value) + 1}` : value);
}
const skillRow = (page: Page, skillId: keyof typeof skills) => page.locator("dl > div").filter({ has: page.getByText(skills[skillId], { exact: true }) }).locator("dd");

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage(); page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(axe.source);
  const signup = await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Mastery QA", email: `mastery-${randomUUID()}@example.com`, password: randomUUID() } });
  assert.ok(signup.ok(), await signup.text()); const owner = (await signup.json()).user as { id: string }; ids.push(owner.id);
  await sql`insert into learning_profile(user_id,experience_level,goals,interests,daily_goal_minutes,time_zone,onboarding_completed_at) values (${owner.id},'BEGINNER','{}','{}',10,'Europe/Prague',now())`;
  await sql`insert into lesson_progress(user_id,lesson_id,status,last_position,completed_at,updated_at) values (${owner.id},'foundations-markets','completed',0,now(),now())`;
  const attempts = () => sql`select item_id, correct, context from skill_attempt where user_id=${owner.id} order by attempted_at, request_id`.then((rows) => [...rows]);

  // A lesson Check records lesson evidence, server-evaluated.
  await page.goto(`${baseURL}/learn/investing-foundations/why-invest`);
  await page.getByRole("button", { name: "Pokračovat", exact: true }).click();
  await answer(page, block("foundations-why-invest", "envelope-question"), true);
  await page.getByRole("button", { name: "Zkontrolovat odpověď" }).click();
  await page.getByRole("button", { name: "Zkusit znovu" }).waitFor();
  for (let tries = 0; (await attempts()).length === 0; tries++) { assert.ok(tries < 50, "lesson attempt not recorded"); await page.waitForTimeout(100); }
  assert.deepEqual(await attempts(), [{ item_id: "foundations-why-invest/envelope-question", correct: false, context: "lesson" }]);
  await page.locator('main[data-save-state="idle"]').waitFor();
  console.log("PASS: a wrong lesson Check records one lesson attempt.");

  // Progress shows derived states: a completed lesson counts as Známé, one wrong attempt as Zkoušeno.
  await page.goto(`${baseURL}/progress`);
  await page.getByRole("heading", { name: "Investiční základy", exact: true }).waitFor();
  assert.equal(await skillRow(page, "bid-ask-spread").innerText(), "Známé");
  assert.equal(await skillRow(page, "inflation").innerText(), "Zkoušeno");
  assert.equal(await skillRow(page, "position-value").innerText(), "Nezkoušeno");
  const protectedRows = async () => ({ progress: [...await sql`select * from lesson_progress where user_id=${owner.id} order by lesson_id`], awards: [...await sql`select * from lesson_award where user_id=${owner.id}`] });
  const before = await protectedRows();
  await page.getByRole("link", { name: /Smíšený checkpoint · 10 otázek/ }).click();
  await page.waitForURL("**/learn/checkpoint/1.1");

  const items = mixedCheckpoint("1.1", `${owner.id}:${new Date().toISOString().slice(0, 10)}`);
  assert.ok(new Set(items.map((item) => item.lessonId)).size >= 2);
  for (const [index, item] of items.entries()) {
    const question = block(item.lessonId, item.blockId);
    await page.getByRole("heading", { name: `Z lekce ${availableLessons.find((lesson) => lesson.id === item.lessonId)!.title}` }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id ?? ""), index === 0 ? "" : "step-title", "focus moves to the new question");
    await answer(page, question, index === 0);
    if (index === 0) {
      // A failed save keeps the question open; the retry records it once.
      await page.route("**/learn/checkpoint/1.1", (route) => route.request().method() === "POST" ? route.abort() : route.continue());
      await page.getByRole("button", { name: "Zkontrolovat odpověď" }).click();
      await page.getByRole("alert").filter({ hasText: "Odpověď se nepodařilo uložit" }).waitFor();
      await page.unroute("**/learn/checkpoint/1.1");
      assert.deepEqual(await axeViolations(page), [], "checkpoint question: axe");
      for (const width of [390, 320]) { await page.setViewportSize({ width, height: 900 }); assert.equal(await overflow(page), false, `overflow at ${width}`); }
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      assert.equal(await overflow(page), false, "overflow at 320 px / 200 % text");
      await page.screenshot({ path: `${output}/checkpoint-320-200.png`, fullPage: true });
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    await page.getByRole("button", { name: "Zkontrolovat odpověď" }).click();
    await page.getByRole("button", { name: index === items.length - 1 ? "Dokončit checkpoint" : "Další otázka" }).click();
  }
  await page.getByRole("heading", { name: "Checkpoint hotový" }).waitFor();
  assert.ok(await page.getByText(`Správně ${items.length - 1} z ${items.length}.`).isVisible());
  assert.deepEqual(await axeViolations(page), [], "checkpoint summary: axe");
  const recorded = (await attempts()).slice(1);
  assert.deepEqual(recorded.map((row) => row.item_id), items.map((item) => item.id), "one attempt per question, in the interleaved order");
  assert.deepEqual(recorded.map((row) => [row.correct, row.context]), items.map((_, index) => [index !== 0, "checkpoint"]));
  assert.deepEqual(await protectedRows(), before, "the checkpoint writes no lesson progress or reward");
  console.log("PASS: mixed checkpoint interleaves lessons, survives a failed save, records one server-evaluated attempt per question, no rewards.");

  await page.getByRole("button", { name: "Zobrazit dovednosti" }).click();
  await page.waitForURL("**/progress");
  const missed = items[0].skillId;
  assert.equal(await skillRow(page, missed).innerText(), missed === "bid-ask-spread" ? "Známé" : "Zkoušeno");
  for (const item of items.slice(1)) assert.equal(await skillRow(page, item.skillId).innerText(), "Zvládnuté", item.skillId);
  assert.deepEqual(errors, []);
  console.log("PASS: Progress shows Zvládnuté for correct checkpoint answers and keeps the missed skill below it.");
} finally {
  if (ids.length) await sql`delete from "user" where id in ${sql(ids)}`;
  await browser.close(); await sql.end();
}
