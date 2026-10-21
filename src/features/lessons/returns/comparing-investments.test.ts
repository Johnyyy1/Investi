import { describe, expect, it } from "vitest";
import { simpleReturn } from "@/features/finance/returns";
import { validateMove } from "@/features/progress/transition";
import { evaluateQuestion, isQuestion } from "../question-evaluation";
import { comparingInvestmentsLesson as lesson } from "./comparing-investments";
import { compoundingAndCumulativeReturnsLesson } from "./compounding-and-cumulative-returns";
import { getGuidedSteps } from "../steps";

const questions = lesson.blocks.filter(isQuestion);

describe("price return and fair comparison lesson", () => {
  it("opens with an assessed prediction and connects L3 to L4 and L4 to the published L5", () => {
    const steps = getGuidedSteps(lesson);
    expect(steps).toHaveLength(8);
    expect(steps[0].blocks).toEqual([questions[0]]);
    expect(compoundingAndCumulativeReturnsLesson.navigation?.next?.href).toBe(`/learn/returns/${lesson.slug}`);
    expect(lesson.navigation?.previous?.href).toBe("/learn/returns/compounding-and-cumulative-returns");
    expect(lesson.navigation?.next?.href).toBe("/learn/returns/log-returns");
  });

  it("keeps the 5% price return separate from the scoped 7% cash-inclusive result", () => {
    const question = questions.find((block) => block.id === "return-definitions")!;
    if (question.type !== "multiNumericQuestion") throw new Error("Expected paired numeric answers");
    expect(question.answers.find((answer) => answer.id === "price")?.answer).toBeCloseTo(simpleReturn(100, 105) * 100, 12);
    expect(question.answers.find((answer) => answer.id === "cash")?.answer).toBeCloseTo((105 - 100 + 2) / 100 * 100, 12);
    expect(evaluateQuestion(question, { price: "5", cash: "7" })).toBe(true);
    expect(evaluateQuestion(question, { price: "7", cash: "5" })).toBe(false);
    expect(evaluateQuestion(question, { price: "5", cash: "5" })).toBe(false);
  });

  it.each([
    { step: 0, correct: "cash-matters", wrong: "same-price" },
    { step: 6, correct: "different-basis", wrong: "same-number" },
  ])("requires the core conceptual answer before leaving step $step", ({ step, correct, wrong }) => {
    expect(() => validateMove(lesson.id, step, step + 1, { answer: wrong })).toThrow();
    expect(() => validateMove(lesson.id, step, step + 1, { answer: correct })).not.toThrow();
  });
});
