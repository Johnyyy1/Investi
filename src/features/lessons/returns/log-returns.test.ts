import { describe, expect, it } from "vitest";
import katex from "katex";
import { cumulativeReturn, logReturn, simpleReturn, simpleReturnFromLog } from "@/features/finance/returns";
import { validateCompletion, validateMove } from "@/features/progress/transition";
import { evaluateQuestion, isQuestion } from "../question-evaluation";
import { comparingInvestmentsLesson } from "./comparing-investments";
import { getGuidedSteps } from "./guided-flow";
import { logReturnsLesson as lesson } from "./log-returns";
import { returnsLessons } from "./manifest";

describe("log returns lesson", () => {
  it("publishes L5 after L4 with eight steps and an assessed opening prediction", () => {
    const steps = getGuidedSteps(lesson);
    expect(steps).toHaveLength(8);
    expect(steps[0].blocks).toHaveLength(1);
    expect(steps[0].blocks[0]).toMatchObject({ id: "prediction", type: "multipleChoiceQuestion" });
    expect(returnsLessons.map((item) => item.status)).toEqual(["available", "available", "available", "available", "available", "available"]);
    expect(returnsLessons.slice(3).map((item) => item.id)).toEqual(["returns-comparing", "returns-log-returns", "returns-checkpoint"]);
    expect(comparingInvestmentsLesson.navigation?.next?.href).toBe(`/learn/returns/${lesson.slug}`);
    expect(lesson.navigation?.previous?.href).toBe("/learn/returns/comparing-investments");
    expect(lesson.navigation?.next?.href).toBe("/learn/returns/returns-checkpoint");
  });

  it.each([
    { step: 0, wrong: "zero", correct: "loss" },
    { step: 5, wrong: "identical", correct: "close" },
    { step: 6, wrong: "log-is-gain", correct: "compound-or-convert" },
  ])("gates step $step with retryable conceptual feedback", ({ step, wrong, correct }) => {
    const question = getGuidedSteps(lesson)[step].blocks.find(isQuestion)!;
    expect(evaluateQuestion(question, { answer: wrong })).toBe(false);
    expect(() => validateMove(lesson.id, step, step + 1, { answer: wrong })).toThrow();
    expect(evaluateQuestion(question, { answer: correct })).toBe(true);
    expect(() => validateMove(lesson.id, step, step + 1, { answer: correct })).not.toThrow();
  });

  it("assesses a calculated one-period log return without accepting the simple return", () => {
    const question = lesson.blocks.find((block) => block.id === "log-calculation")!;
    if (!isQuestion(question)) throw new Error("Expected a question");
    expect(question).toMatchObject({ answer: expect.closeTo(logReturn(100, 110) * 100, 3) });
    expect(evaluateQuestion(question, { answer: "9,531" })).toBe(true);
    expect(() => validateMove(lesson.id, 2, 3, { answer: "10" })).toThrow();
    expect(() => validateMove(lesson.id, 2, 3, { answer: "9,531" })).not.toThrow();
  });

  it("requires persisted continuation through the final step before completion", () => {
    expect(() => validateMove(lesson.id, 0, 7)).toThrow();
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: 6 })).toThrow();
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: 7 })).not.toThrow();
  });

  it("uses valid KaTeX for all authored formulas", () => {
    for (const block of lesson.blocks) {
      if (block.type === "formula") expect(() => katex.renderToString(block.latex ?? block.expression, { throwOnError: true, strict: "error" })).not.toThrow();
    }
  });

  it.each([[100, 110, 99, -1], [100, 105, 110, 10]])("keeps endpoint, compounded and converted results consistent for %d → %d → %d", (start, middle, end, percent) => {
    const simple = [simpleReturn(start, middle), simpleReturn(middle, end)];
    const logSum = logReturn(start, middle) + logReturn(middle, end);
    expect(cumulativeReturn(simple) * 100).toBeCloseTo(percent, 12);
    expect(simpleReturnFromLog(logSum) * 100).toBeCloseTo(percent, 12);
    expect(logSum).toBeCloseTo(logReturn(start, end), 12);
    expect(simple.reduce((sum, value) => sum + value, 0)).not.toBeCloseTo(simpleReturn(start, end), 4);
  });
});
