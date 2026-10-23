/**
 * Generic walkthrough of every published lesson (#147): for each question a wrong answer, its feedback and a retry,
 * then the authored answer; continuation survives a reload; completion writes one receipt. Every step is checked for
 * horizontal overflow at 1440/390/320 px and with axe (WCAG 2.1 A/AA, serious and critical findings).
 * `LESSON_IDS=returns-simple-returns,before-investing-budget` walks only those lessons.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import axe from "axe-core";
import postgres from "postgres";
import { chromium, type Locator, type Page } from "playwright";
import { finishOnboarding } from "./onboarding-helper.mjs";
import { prepareLessonFacts } from "../src/features/facts/lesson-facts";
import { factRegistry } from "../src/features/facts/registry";
import { factToday } from "../src/features/facts/resolve";
import { availableLessons } from "../src/features/learning/catalog";
import { correctAnswers, wrongAnswers } from "../src/features/lessons/answer-keys";
import { isQuestion, type QuestionBlock } from "../src/features/lessons/question-evaluation";
import { getAuthoredLesson } from "../src/features/lessons/registry";
import { getGuidedSteps } from "../src/features/lessons/steps";

const baseURL = process.env.WALKTHROUGH_TEST_URL ?? "http://localhost:3187";
const screenshots = process.env.WALKTHROUGH_SCREENSHOT_DIR ?? "test-results/lesson-walkthrough";
const local = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(process.env.DATABASE_URL && local(new URL(process.env.DATABASE_URL).hostname) && local(new URL(baseURL).hostname), "Requires local app and QA database");

const requested = process.env.LESSON_IDS?.split(",").map((id) => id.trim()).filter(Boolean);
for (const id of requested ?? []) assert.ok(availableLessons.some((lesson) => lesson.id === id), `Unknown or unpublished lesson: ${id}`);
// The server renders lessons with today's facts; resolve them the same way so titles and labels match.
const lessons = availableLessons.filter((lesson) => !requested || requested.includes(lesson.id)).map((definition) => {
  const { lesson } = prepareLessonFacts(getAuthoredLesson(definition.moduleSlug, definition.slug)!, factRegistry, { today: factToday(), published: true });
  return { id: lesson.id, path: `/learn/${lesson.moduleSlug}/${lesson.slug}`, steps: getGuidedSteps(lesson) };
});

type Control = { radio: string; value: string } | { label: string; fill: string } | { label: string; select: string };
/** How the player takes an answer from `answer-keys`. A new graded kind in a published lesson needs a driver here. */
function controls(block: QuestionBlock, answers: Record<string, string>): Control[] {
  switch (block.type) {
    case "multipleChoiceQuestion": case "findErrorQuestion": return [{ radio: block.id, value: answers.answer }];
    case "numericQuestion": return [{ label: "Tvoje odpověď", fill: answers.answer }];
    case "multiNumericQuestion": return block.answers.map((field) => ({ label: field.label, fill: answers[field.id] }));
    case "fadedExample": return block.blank.input === "choice" ? [{ radio: block.id, value: answers.answer }] : [{ label: "Tvoje doplnění", fill: answers.answer }];
    case "documentSearchQuestion": return block.target.type === "region" ? [{ radio: block.id, value: answers.answer }] : [{ label: "Hodnota z dokumentu", fill: answers.answer }];
    case "categorizeQuestion": return block.items.map((item) => ({ label: item.label, select: answers[item.id] }));
    case "orderQuestion": return block.items.map((_, index) => ({ label: `${index + 1}. místo`, select: answers[String(index)] }));
    default: throw new Error(`No walkthrough driver for ${block.type} (${block.id})`);
  }
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const email = `walkthrough-${randomUUID()}@example.com`;
let userId: string | undefined;
let where = "sign-up";
await mkdir(screenshots, { recursive: true });
const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Prague" });
try {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(axe.source);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${where}: ${error.message}`));
  const signed = await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Walkthrough learner", email, password: randomUUID() } });
  assert.ok(signed.ok(), await signed.text());
  [{ id: userId }] = await sql<{ id: string }[]>`select id from "user" where email = ${email}`;
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);

  const button = (name: string) => page.getByRole("button", { name, exact: true });
  const idle = () => page.locator('main[data-save-state="idle"]').waitFor();
  async function audit(label: string, width: number) {
    for (const size of [1440, 390, 320]) {
      await page.setViewportSize({ width: size, height: 900 });
      await page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: horizontal overflow at ${size}px`);
    }
    await page.setViewportSize({ width, height: 900 });
    const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector("main")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`));
    assert.deepEqual(violations, [], `${label}: axe`);
  }
  async function answer(question: QuestionBlock, answers: Record<string, string>) {
    const card: Locator = page.locator(`section[aria-labelledby^="${question.id}-"]`);
    for (const control of controls(question, answers)) {
      if ("radio" in control) await page.locator(`input[type="radio"][name="${control.radio}"][value="${control.value}"]`).check();
      else if ("fill" in control) await card.getByLabel(control.label, { exact: true }).fill(control.fill);
      else await card.locator("label", { has: page.getByText(control.label, { exact: true }) }).locator("select").selectOption(control.select);
    }
    await button("Zkontrolovat odpověď").click();
  }

  for (const [lessonIndex, lesson] of lessons.entries()) {
    // Each lesson is answered at one width; every step is still audited at all three.
    const width = [1440, 390, 320][lessonIndex % 3];
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${baseURL}${lesson.path}`);
    for (const [index, step] of lesson.steps.entries()) {
      where = `${lesson.id} step ${index + 1} „${step.title}“`;
      await page.getByRole("heading", { level: 2, name: step.title, exact: true }).waitFor();
      await idle();
      await audit(where, width);
      const question = step.blocks.find(isQuestion);
      if (question) {
        await answer(question, wrongAnswers(question));
        await page.getByRole("heading", { name: "Zkus to ještě jednou", exact: true }).waitFor();
        await button("Zkusit znovu").click();
        // Retry focuses the first answer control a frame later; typing before that lands in the wrong field.
        await page.waitForFunction(() => document.activeElement?.matches("main input, main select"));
        await answer(question, correctAnswers(question, { decimalComma: true }));
        await page.getByRole("heading", { name: "Správně", exact: true }).waitFor();
        await audit(`${where} after feedback`, width);
      }
      for (const block of step.blocks) {
        if (block.type === "rubricSelfAssessment") throw new Error(`No walkthrough driver for a saved rubric (${block.id})`);
        if (block.type === "interactiveFigure" && block.figure === "goal-map") {
          await page.getByRole("checkbox", { name: "Zatím nemám konkrétní cíl", exact: true }).check();
          await page.getByRole("checkbox", { name: /Souhlasím s uložením/ }).check();
          await button("Uložit výstup").click();
          await page.getByText(/^Výstup je uložený\. Verze \d+\.$/).waitFor();
        }
      }
      if (index === lesson.steps.length - 1) break;
      await button("Pokračovat").click();
      await idle();
      if (index === 0) {
        // Continuation is persisted: a reload resumes on the second step.
        await page.reload();
        await page.getByRole("heading", { level: 2, name: lesson.steps[1].title, exact: true }).waitFor();
      }
    }
    where = `${lesson.id} completion`;
    await button("Dokončit lekci").click();
    await page.getByRole("heading", { name: "Lekce dokončena", exact: true }).waitFor();
    const progress: { status: string } | undefined = (await sql<{ status: string }[]>`select status from lesson_progress where user_id = ${userId} and lesson_id = ${lesson.id}`)[0];
    assert.equal(progress?.status, "completed", where);
    assert.equal((await sql<{ count: number }[]>`select count(*)::int as count from lesson_award where user_id = ${userId} and lesson_id = ${lesson.id}`)[0].count, 1, `${where}: one receipt`);
    console.log(`✓ ${lesson.id} (${lesson.steps.length} steps at ${width}px)`);
  }
  assert.deepEqual(errors, [], "no browser or hydration errors");
  console.log(`Lesson walkthrough: ${lessons.length} published lessons answered wrong then right, resumed, completed with one receipt; no overflow at 1440/390/320 px and no serious axe findings.`);
} catch (error) {
  await page.screenshot({ path: `${screenshots}/failure.png`, fullPage: true }).catch(() => {});
  console.error(`Failed at ${where}`);
  throw error;
} finally {
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await browser.close();
  await sql.end();
}

declare global { interface Window { axe: typeof axe } }
