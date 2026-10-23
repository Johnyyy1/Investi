import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import katex from "katex";
import { BudgetBuilder } from "@/components/lesson/budget-builder";
import { getModuleBySlug, getModuleLessons } from "@/features/learning/catalog";
import { getLessonPlacement } from "@/features/learning/curriculum";
import { validateCompletion, validateMove } from "@/features/progress/transition";
import { lessonReward, REWARD_POLICY_VERSION } from "@/features/rewards/practice-capital";
import { budgetLesson } from "./budget";
import { monthlyBudget, parseBudgetAmount } from "./model";
import { getGuidedSteps } from "../steps";
import { correctAnswers, wrongAnswers } from "../answer-keys";
import { evaluateQuestion, isQuestion } from "../question-evaluation";

const steps = getGuidedSteps(budgetLesson);
describe("budget lesson 0.1.1", () => {
  it("registers the stable route, recommended placement and existing XP-only level policy", () => {
    expect(getModuleBySlug("before-investing")).toMatchObject({ lessonCount: 4, estimatedMinutes: 43, status: "available" });
    expect(getModuleLessons("before-investing")[0]).toMatchObject({ id: budgetLesson.id, moduleId: "module-before-investing", slug: "budget" });
    expect(getLessonPlacement(budgetLesson.id)).toMatchObject({ displayCode: "0.1.1", required: "recommended", prerequisites: [] });
    expect(lessonReward(budgetLesson.id)).toEqual({ practiceCapitalMinor: 0n, rewardPolicyVersion: REWARD_POLICY_VERSION });
  });
  it("recomputes every numeric answer from the stated inputs and uses the requested tolerances", () => {
    const regularExpenses = [14500, 6000, 1500, 800, 700, 3500, 3000].reduce((a, b) => a + b, 0);
    expect(regularExpenses).toBe(30000);
    const expected: Record<string, { answer: number; tolerance: number }> = {
      rate: { answer: Math.round((38000 - regularExpenses) / 38000 * 1000) / 10, tolerance: 0.1 },
      monthly: { answer: (6000 + 1200) / 12, tolerance: 0 },
    };
    const questions = budgetLesson.blocks.filter((block) => block.type === "numericQuestion");
    expect(questions.map((block) => block.id).sort()).toEqual(Object.keys(expected).sort());
    for (const question of questions) {
      expect(question).toMatchObject(expected[question.id]);
      expect(evaluateQuestion(question, { answer: "26,7" })).toBe(false);
    }
    const corrected = monthlyBudget(38000, 16000, 14000, 6000 + 1200);
    expect(corrected.surplus).toBe(7400);
    expect(Number((corrected.savingsRate! * 100).toFixed(1))).toBe(19.5);
  });
  it("includes all blocks once, one question per step and an ungraded final step", () => {
    expect(steps.flatMap((step) => step.blocks.map((block) => block.id)).sort()).toEqual(budgetLesson.blocks.map((block) => block.id).sort());
    expect(new Set(budgetLesson.blocks.map((block) => block.id)).size).toBe(budgetLesson.blocks.length);
    for (const [index, step] of steps.entries()) {
      const questions = step.blocks.filter(isQuestion);
      expect(questions.length).toBeLessThanOrEqual(1);
      if (questions.length) {
        const question = questions[0];
        expect(step.blocks.at(-1)).toBe(question);
        expect(evaluateQuestion(question, {})).toBeUndefined();
        expect(() => validateMove(budgetLesson.id, index, index + 1, wrongAnswers(question))).toThrow();
        expect(() => validateMove(budgetLesson.id, index, index + 1, correctAnswers(question, { decimalComma: true }))).not.toThrow();
      }
    }
    expect(steps.at(-1)!.blocks.some(isQuestion)).toBe(false);
    expect(() => validateCompletion(budgetLesson.id, { status: "in_progress", lastPosition: steps.length - 2 })).toThrow();
    expect(() => validateCompletion(budgetLesson.id, { status: "in_progress", lastPosition: steps.length - 1 })).not.toThrow();
  });
  it("checks all eight classifications, including an unexpected repair", () => {
    const sorting = budgetLesson.blocks.find((block) => block.type === "categorizeQuestion")!;
    expect(sorting.items).toHaveLength(8);
    expect(sorting.items.find((item) => item.id === "repair")?.categoryId).toBe("irregular");
    for (const item of sorting.items) {
      const wrong = sorting.categories.find((category) => category.id !== item.categoryId)!.id;
      expect(evaluateQuestion(sorting, { ...correctAnswers(sorting), [item.id]: wrong })).toBe(false);
    }
  });
  it("uses renderable formulas and private labeled calculator controls", () => {
    for (const block of budgetLesson.blocks) if (block.type === "formula") expect(() => katex.renderToString(block.latex ?? block.expression, { throwOnError: true, strict: "error" })).not.toThrow();
    const html = renderToStaticMarkup(createElement(BudgetBuilder));
    expect(html).toContain("Neodesílají se na server");
    expect(html).toContain("Výsledek rozpočtu");
    expect(html).toContain('aria-live="polite"');
    expect(html.match(/<label /g)).toHaveLength(4);
    expect(html).not.toContain("<form");
  });
});

describe("private budget estimate", () => {
  it("spreads annual costs without rounding or double-counting", () => {
    expect(monthlyBudget(38000, 16000, 14000, 7200)).toEqual({ monthlyIrregular: 600, expenses: 30600, surplus: 7400, savingsRate: 7400 / 38000 });
    const decimal = monthlyBudget(1.3333, 0.1, 0.25, 1);
    expect(decimal.monthlyIrregular).toBe(1 / 12);
    expect(decimal.surplus).toBeCloseTo(1.3333 - 0.1 - 0.25 - 1 / 12, 12);
  });
  it("preserves deficits and zero rather than fabricating a savings rate", () => {
    expect(monthlyBudget(0, 0, 0, 0)).toMatchObject({ surplus: 0, savingsRate: null });
    expect(monthlyBudget(0, 100, 0, 0)).toMatchObject({ surplus: -100, savingsRate: null });
    expect(monthlyBudget(100, 200, 0, 0)).toMatchObject({ surplus: -100, savingsRate: -1 });
  });
  it.each([NaN, Infinity, -1, 1_000_000_001])("rejects invalid input %s in every position", (value) => {
    for (let index = 0; index < 4; index++) {
      const values: [number, number, number, number] = [1, 0, 0, 0];
      values[index] = value;
      expect(() => monthlyBudget(...values)).toThrow();
    }
  });
  it.each(["", " ", "invalid", "1,2,3", "Infinity", "-1", "1000000001"])("keeps an invalid draft unavailable: %s", (raw) => expect(parseBudgetAmount(raw)).toBeNull());
  it.each([["0,1", 0.1], ["0.25", 0.25], ["1,3333", 1.3333], ["0", 0], ["1000000000", 1_000_000_000]] as const)("accepts %s without rounding", (raw, value) => expect(parseBudgetAmount(raw)).toBe(value));
});
