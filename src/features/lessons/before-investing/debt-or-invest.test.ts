import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DebtVsInvestCalculator } from "@/components/lesson/debt-vs-invest-calculator";
import { getAuthoredLesson } from "../registry";
import { getGuidedSteps } from "../steps";
import { correctAnswers, wrongAnswers } from "../answer-keys";
import { isQuestion } from "../question-evaluation";
import { getLessonPlacement } from "@/features/learning/curriculum";
import { validateMove, validateCompletion } from "@/features/progress/transition";
import { lessonReward } from "@/features/rewards/practice-capital";
import { debtOrInvestLesson as lesson } from "./debt-or-invest";
import { compareDebtAndInvest } from "./debt-model";

const steps = getGuidedSteps(lesson);
describe("debt lesson 0.1.2", () => {
  it("publishes its stable identity after budget without changing the L0 reward policy", () => {
    expect(getAuthoredLesson("before-investing", "debt-or-invest")).toBe(lesson);
    expect(getLessonPlacement(lesson.id)).toMatchObject({ displayCode: "0.1.2", prerequisites: ["before-investing-budget"], required: "recommended" });
    expect(lessonReward(lesson.id).practiceCapitalMinor).toBe(0n);
  });
  it("recomputes the numeric answer and includes exactly one graded question per step", () => {
    const numeric = lesson.blocks.filter((block) => block.type === "numericQuestion");
    expect(numeric).toHaveLength(1);
    expect(numeric[0]).toMatchObject({ id: "cost", answer: 25_000 * 24 / 100, tolerance: 50 });
    expect(steps.flatMap((step) => step.blocks.map((block) => block.id)).sort()).toEqual(lesson.blocks.map((block) => block.id).sort());
    for (const [position, step] of steps.entries()) {
      expect(step.blocks.filter(isQuestion).length).toBeLessThanOrEqual(1);
      for (const question of step.blocks.filter(isQuestion)) {
        expect(step.blocks.at(-1)).toBe(question);
        expect(() => validateMove(lesson.id, position, position + 1, wrongAnswers(question))).toThrow();
        expect(() => validateMove(lesson.id, position, position + 1, correctAnswers(question))).not.toThrow();
      }
    }
    expect(steps.at(-1)!.blocks.some(isQuestion)).toBe(false);
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: steps.length - 1 })).not.toThrow();
  });
  it("renders a labeled simulation with assumptions and three accessible sliders", () => {
    const html = renderToStaticMarkup(createElement(DebtVsInvestCalculator));
    expect(html).toContain("Tvůj předpoklad, ne slib");
    expect(html.match(/type="range"/g)).toHaveLength(3);
    expect(html).toContain("investice minus dluh");
    expect(html).toContain("bez daní a investičních nákladů");
  });
});

describe("debt comparison model", () => {
  it("keeps both zero-rate paths equal and accounts for all contributions", () => {
    const result = compareDebtAndInvest(0, 0, 3)!;
    expect(result.repayFirst).toBe(1000 * 12 * 3);
    expect(result.investFirst - result.remainingDebt).toBe(result.repayFirst);
    expect(result.costs).toBe(0);
    expect(result.difference).toBe(0);
  });
  it("agrees with an independent annual-rate annuity and debt recurrence", () => {
    for (const rate of [0.1, 0.25, 1.3333, 5, 24]) {
      const result = compareDebtAndInvest(rate, rate, 1)!;
      const monthly = (1 + rate / 100) ** (1 / 12) - 1;
      const annuity = 1000 * ((1 + monthly) ** 12 - 1) / monthly;
      expect(result.repayFirst).toBeCloseTo(annuity, 6);
      expect(result.remainingDebt).toBeCloseTo(25000 * (1 + rate / 100) - annuity, 6);
      expect(result.difference).toBeCloseTo(0, 6);
      expect(result.costs).toBeCloseTo(result.remainingDebt - 25000 + 12000, 6);
    }
  });
  it("shows the cost of expensive debt and permits uncertain negative returns", () => {
    expect(compareDebtAndInvest(24, 5, 3)!.difference).toBeGreaterThan(0);
    expect(compareDebtAndInvest(0, 5, 3)!.difference).toBeLessThan(0);
    expect(compareDebtAndInvest(24, -30, 3)!.difference).toBeGreaterThan(0);
    const paid = compareDebtAndInvest(24, 0, 10)!;
    expect(paid.remainingDebt).toBe(0);
    expect(paid.difference).toBeCloseTo(paid.costs, 6);
  });
  it("rejects invalid inputs without manufacturing results", () => {
    for (const input of [[NaN, 5, 3], [Infinity, 5, 3], [-1, 5, 3], [41, 5, 3], [24, -51, 3], [24, 31, 3], [24, 5, 0], [24, 5, 11], [24, 5, 1.5]]) {
      expect(compareDebtAndInvest(...input as [number, number, number])).toBeNull();
    }
  });
});
