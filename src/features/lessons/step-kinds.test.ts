import { describe, expect, it } from "vitest";
import { correctAnswers, wrongAnswers } from "./answer-keys";
import { evaluateQuestion, feedbackFor, isQuestion, parseSelection, serializeSelection } from "./question-evaluation";
import { lessonFactKeys, stepWidth } from "./step-kinds";
import { timeTestSpecimens as spec } from "./specimens/time-test";
import type { DocumentRow, LessonBlock } from "./types";

const blocks = Object.values(spec) as LessonBlock[];
const questions = blocks.filter(isQuestion);

/** Czech securities time test as the specimens model it: exempt from the day after the third anniversary of the purchase. */
function exemptFrom(purchase: string) {
  const [d, m, y] = purchase.split(". ").map(Number);
  return new Date(Date.UTC(y + 3, m - 1, d + 1));
}
const parse = (date: string) => { const [d, m, y] = date.split(". ").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const days = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86_400_000);

describe("graded step kinds", () => {
  it("treats faded examples, documents and find-the-error as questions, the rest as content", () => {
    expect(questions.map((block) => block.type).sort()).toEqual(["documentTap", "fadedExample", "findError", "multipleChoiceQuestion"]);
    for (const block of blocks.filter((item) => !isQuestion(item))) expect(["personaDecision", "labMission", "factNotice", "writtenReflection"]).toContain(block.type);
  });

  it.each(questions)("accepts the answer key, refuses a wrong answer and waits for a blank one ($type)", (block) => {
    expect(evaluateQuestion(block, correctAnswers(block))).toBe(true);
    expect(evaluateQuestion(block, wrongAnswers(block))).toBe(false);
    expect(evaluateQuestion(block, {})).toBeUndefined();
  });

  it("keeps every answer inside the saved-answer contract (≤ 10 keys, ≤ 100 characters)", () => {
    for (const block of questions) for (const answers of [correctAnswers(block), wrongAnswers(block)]) {
      expect(Object.keys(answers).length).toBeLessThanOrEqual(10);
      for (const [key, value] of Object.entries(answers)) { expect(key.length).toBeLessThanOrEqual(100); expect(value.length).toBeLessThanOrEqual(100); }
    }
  });

  it("grades a document selection as a set and ignores unknown or unselectable rows", () => {
    const block = spec.documentTap;
    expect(evaluateQuestion(block, { selected: "b3,b1,b2" })).toBe(true);
    expect(evaluateQuestion(block, { selected: "b1,b2" })).toBe(false);
    expect(evaluateQuestion(block, { selected: "b1,b2,b3,s1" })).toBeUndefined();
    expect(evaluateQuestion(block, { selected: "b1,nope" })).toBeUndefined();
    expect(parseSelection(serializeSelection(["b1", "b1", "b2"]))).toEqual(["b1", "b2"]);
  });

  it("needs both the wrong row and its fix in find-the-error", () => {
    const block = spec.findError;
    expect(evaluateQuestion(block, { row: "r2" })).toBeUndefined();
    expect(evaluateQuestion(block, { row: "r1", fix: "own-date" })).toBe(false);
    expect(evaluateQuestion(block, { row: "r2", fix: "own-date" })).toBe(true);
  });

  it("accepts a Czech decimal comma in a numeric blank", () => {
    const block = { ...spec.fadedExample, blank: { label: "Počet dní", input: "number", answer: 69.5, tolerance: 0, unit: "dní" } } as const satisfies LessonBlock;
    expect(evaluateQuestion(block, { answer: "69,5" })).toBe(true);
    expect(evaluateQuestion(block, { answer: "70" })).toBe(false);
    expect(evaluateQuestion(block, { answer: "abc" })).toBeUndefined();
  });

  it("explains the chosen misconception, falling back to the shared explanation", () => {
    expect(feedbackFor(spec.choice, { answer: "none" }, false)).toEqual({ explanation: spec.choice.options[2].explanation, misconception: "prodej jako jeden celek" });
    expect(feedbackFor(spec.choice, { answer: "first" }, true)).toEqual({ explanation: spec.choice.correctExplanation });
    expect(feedbackFor(spec.findError, { row: "r1", fix: "fee" }, false)).toEqual({ explanation: spec.findError.incorrectExplanation, misconception: undefined });
    expect(feedbackFor(spec.findError, { row: "r2", fix: "fee" }, false).explanation).toBe(spec.findError.fixes[1].explanation);
  });
});

describe("reference specimens", () => {
  it("mark exactly the purchases that pass the time test on the sale date", () => {
    const sale = parse("15. 6. 2025");
    const rows: readonly DocumentRow[] = spec.documentTap.document.rows;
    const passing = rows.filter((row) => row.selectable !== false && exemptFrom(row.cells.date) <= sale).map((row) => row.id);
    expect(passing).toEqual([...spec.documentTap.correctRowIds]);
    const bought = rows.filter((row) => row.selectable !== false).reduce((sum, row) => sum + Number.parseInt(row.cells.qty), 0);
    expect(`${bought} ks`).toBe(rows.find((row) => row.id === "s1")!.cells.qty);
  });

  it("compute the faded example and the find-the-error rows from their inputs", () => {
    expect(days(parse("12. 3. 2025"), parse("20. 5. 2025"))).toBe(69);
    expect(exemptFrom("12. 3. 2022") <= parse("20. 5. 2025")).toBe(true);
    expect(exemptFrom("9. 5. 2023").toISOString().slice(0, 10)).toBe("2026-05-10");
    expect(10 * (2110 - 1820)).toBe(2900);
  });

  it("keep the persona's consequences consistent with her purchases (15 % illustrative rate)", () => {
    const today = parse("20. 10. 2026");
    expect(days(today, exemptFrom("14. 11. 2023"))).toBe(26);
    expect(days(today, exemptFrom("2. 9. 2024"))).toBe(318);
    expect(38 * 1600).toBe(60_800);
    expect([38 * (1600 - 1450), Math.round(38 * (1600 - 1450) * 0.15)]).toEqual([5700, 855]);
    expect([38 * (1600 - 1180), Math.round(38 * (1600 - 1180) * 0.15)]).toEqual([15_960, 2394]);
    expect(70_000 + 60_800).toBeGreaterThan(100_000);
  });

  it("count the mission's sample days from 20. 10. 2026", () => {
    const today = parse("20. 10. 2026");
    for (const row of spec.labMission.analysis.rows) {
      const purchase = row.start!;
      expect(row.end).toBe(`osvobození od ${exemptFrom(purchase).getUTCDate()}. ${exemptFrom(purchase).getUTCMonth() + 1}. ${exemptFrom(purchase).getUTCFullYear()}`);
      expect(row.status.replace(/\s/g, "")).toContain(`${days(today, exemptFrom(purchase))}dní`);
    }
  });
});

describe("step kind helpers", () => {
  it("widens the desktop column only for two-column kinds and figures", () => {
    for (const block of [spec.documentTap, spec.findError, spec.personaDecision, spec.labMission]) expect(stepWidth([block])).toBe("max-w-[1240px]");
    expect(stepWidth([{ id: "f", type: "interactiveFigure", figure: "return-calculator", title: "", description: "" }])).toBe("max-w-[1040px]");
    for (const block of [spec.fadedExample, spec.choice, spec.factNotice, spec.writtenReflection]) expect(stepWidth([block])).toBe("max-w-[760px]");
  });
  it("collects a lesson's facts once, in order", () => {
    expect(lessonFactKeys({ blocks: [spec.factNotice, spec.factNotice, spec.choice] })).toEqual(["cz.tax.securities.time_test", "cz.tax.securities.value_test"]);
  });
});
