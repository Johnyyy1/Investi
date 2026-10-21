import { describe, expect, it } from "vitest";
import katex from "katex";
import { simpleReturn } from "@/features/finance/returns";
import { getModuleBySlug, getModuleLessons } from "@/features/learning/catalog";
import { metricLessonLink } from "@/features/learning/metric-glossary";
import { pearsonCorrelation, returnCorrelation } from "@/features/instruments/correlation";
import { validateCompletion, validateMove } from "@/features/progress/transition";
import { lessonReward, LESSON_PRACTICE_CAPITAL_MINOR, MODULE_REWARD_POLICY_VERSION } from "@/features/rewards/practice-capital";
import { lessonUsesRiskHistory } from "../real-history/load";
import { evaluateQuestion, isQuestion } from "../question-evaluation";
import { getAuthoredLesson } from "../registry";
import { getGuidedSteps } from "../steps";
import { block, correctAnswers, numericAnswer, wrongAnswers } from "../lesson-test-support";
import { correlationInCrisesLesson } from "./correlation-in-crises";
import { correlationRealDataLesson } from "./correlation-real-data";
import { correlationLessons, CORRELATION_MODULE_ID } from "./manifest";
import { commonFactor, commonFactorReturns, correlationOf, correlationPairs, correlationSteps, crisisWindow } from "./model";
import { notCausationLesson } from "./not-causation";
import { whatIsCorrelationLesson } from "./what-is-correlation";

const lessons = [whatIsCorrelationLesson, notCausationLesson, correlationInCrisesLesson, correlationRealDataLesson];

describe("Correlation module", () => {
  it("publishes four lessons as one available module", () => {
    expect(correlationLessons.map((lesson) => lesson.status)).toEqual(Array(4).fill("available"));
    expect(getModuleBySlug("correlation")).toMatchObject({ status: "available", lessonCount: 4, estimatedMinutes: 42 });
    expect(getModuleLessons("correlation").map((lesson) => lesson.moduleId)).toEqual(Array(4).fill(CORRELATION_MODULE_ID));
    for (const [index, lesson] of lessons.entries()) {
      expect(getAuthoredLesson("correlation", correlationLessons[index].slug)).toBe(lesson);
      expect(lesson).toMatchObject({ id: correlationLessons[index].id, position: index + 1, moduleSlug: "correlation" });
    }
  });

  it("chains the lessons in curriculum order", () => {
    for (const [index, lesson] of lessons.entries()) {
      expect(lesson.navigation?.previous?.href).toBe(index === 0 ? undefined : `/learn/correlation/${correlationLessons[index - 1].slug}`);
      expect(lesson.navigation?.next?.href).toBe(index === lessons.length - 1 ? undefined : `/learn/correlation/${correlationLessons[index + 1].slug}`);
    }
  });

  it("rewards each first completion with 2,000 Kč of Practice Capital under policy v3", () => {
    for (const lesson of correlationLessons) expect(lessonReward(lesson.id)).toEqual({ practiceCapitalMinor: LESSON_PRACTICE_CAPITAL_MINOR, rewardPolicyVersion: MODULE_REWARD_POLICY_VERSION });
  });

  it.each(lessons)("$title opens with a question, has an interactive task and at least four questions", (lesson) => {
    expect(getGuidedSteps(lesson)[0].blocks.some(isQuestion)).toBe(true);
    expect(lesson.blocks.filter(isQuestion).length).toBeGreaterThanOrEqual(4);
    expect(lesson.blocks.some((item) => item.type === "interactiveFigure")).toBe(true);
  });

  it.each(lessons)("$title gates every question step and accepts the authored answer", (lesson) => {
    for (const [index, step] of getGuidedSteps(lesson).entries()) {
      const question = step.blocks.find(isQuestion);
      if (!question) continue;
      expect(evaluateQuestion(question, wrongAnswers(question))).toBe(false);
      expect(() => validateMove(lesson.id, index, index + 1, wrongAnswers(question))).toThrow();
      expect(evaluateQuestion(question, correctAnswers(question))).toBe(true);
      expect(() => validateMove(lesson.id, index, index + 1, correctAnswers(question))).not.toThrow();
    }
  });

  it.each(lessons)("$title shows every authored block once, never repeats a step title and completes only from the last step", (lesson) => {
    const steps = getGuidedSteps(lesson);
    expect(steps.flatMap((step) => step.blocks.map((item) => item.id)).sort()).toEqual(lesson.blocks.map((item) => item.id).sort());
    for (const step of steps) for (const item of step.blocks) if ("title" in item) expect(item.title).not.toBe(step.title);
    const last = steps.length - 1;
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: last - 1 })).toThrow();
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: last })).not.toThrow();
  });

  it.each(lessons)("$title uses valid KaTeX", (lesson) => {
    for (const item of lesson.blocks) if (item.type === "formula") expect(() => katex.renderToString(item.latex ?? item.expression, { throwOnError: true, strict: "error" })).not.toThrow();
  });

  it("loads the shared real-history year only for the real-data lesson", () => {
    expect(lessons.map(lessonUsesRiskHistory)).toEqual([false, false, false, true]);
  });

  it("links the Lab's correlation metric to the first lesson", () => {
    expect(metricLessonLink("correlation")?.href).toBe(`/learn/correlation/${correlationLessons[0].slug}`);
  });
});

describe("Correlation answers follow the Lab's arithmetic", () => {
  it("uses the same Pearson function as the comparison", () => {
    // returnCorrelation of closes and pearsonCorrelation of the returns between them agree.
    const first = [100, 103, 101, 105, 104, 108, 106, 110, 109, 113, 111, 115, 114, 118, 116, 120, 119, 123, 121, 125, 124, 128];
    const second = first.map((close, index) => close + (index % 3 === 0 ? 2 : -1));
    const dated = (closes: number[]) => closes.map((close, index) => ({ date: new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10), close }));
    const returns = (closes: number[]) => closes.slice(1).map((close, index) => simpleReturn(closes[index], close));
    const lab = returnCorrelation(dated(first), dated(second));
    expect(lab.status).toBe("ok");
    expect(lab.coefficient).toBeCloseTo(correlationOf(returns(first), returns(second))!, 12);
  });

  it("What is correlation: the prediction, the worked example and the practice", () => {
    expect(correlationOf(correlationPairs[3].first, correlationPairs[3].second)).toBeCloseTo(1, 12);
    expect(block(whatIsCorrelationLesson, "prediction", "multipleChoiceQuestion").correctOptionId).toBe("one");
    expect(correlationSteps([1, -1, 2, -2], [2, -2, 1, -1])).toMatchObject({ sumOfProducts: 8, sumOfSquaresFirst: 10, sumOfSquaresSecond: 10, coefficient: 0.8 });
    const practice = correlationSteps([3, 1, -1, -3], [1, 3, -3, -1]);
    expect(practice).toMatchObject({ sumOfProducts: 12, sumOfSquaresFirst: 20, sumOfSquaresSecond: 20 });
    expect(numericAnswer(whatIsCorrelationLesson, "practice")).toBeCloseTo(practice.coefficient!, 12);
  });

  it("What is correlation: the explorer's pairs read together, opposite, independent and scaled", () => {
    const coefficients = correlationPairs.map((pair) => correlationOf(pair.first, pair.second)!);
    expect(coefficients[0]).toBeGreaterThan(0.9);
    expect(coefficients[1]).toBeLessThan(-0.9);
    expect(coefficients[2]).toBeCloseTo(0, 12);
    expect(coefficients[3]).toBeCloseTo(1, 12);
  });

  it("Not causation: two firms with no link correlate only through the shared market move", () => {
    const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);
    // Mutually orthogonal, zero-mean series: the shared share alone sets the coefficient.
    for (const series of Object.values(commonFactor)) expect(series.reduce((sum, value) => sum + value, 0)).toBe(0);
    expect([dot(commonFactor.market, commonFactor.ownFirst), dot(commonFactor.market, commonFactor.ownSecond), dot(commonFactor.ownFirst, commonFactor.ownSecond)]).toEqual([0, 0, 0]);
    expect(commonFactorReturns(0).coefficient).toBeCloseTo(0, 12);
    expect(commonFactorReturns(0.5).coefficient).toBeCloseTo(104 / 144, 12);
    expect(commonFactorReturns(1).coefficient).toBeCloseTo(1, 12);
    // The lesson quotes 0,72 for a 50 % share.
    expect(block(notCausationLesson, "factor-check", "multipleChoiceQuestion").correctExplanation).toContain("0,72");
    expect(() => commonFactorReturns(1.5)).toThrow(RangeError);
  });

  it("Crises: calm 0,24, crisis 0,99 and the quoted worst months", () => {
    const calm = crisisWindow("calm"), crisis = crisisWindow("crisis");
    expect(calm.coefficient!).toBeCloseTo(0.24, 2);
    expect(crisis.coefficient!).toBeCloseTo(0.99, 2);
    expect(calm.worst).toEqual({ first: -2, second: -2, halfAndHalf: -1.5 });
    expect(crisis.worst).toEqual({ first: -12, second: -10, halfAndHalf: -11 });
    expect(numericAnswer(correlationInCrisesLesson, "explorer-check")).toBe(crisis.worst.halfAndHalf);
    expect(crisisWindow("all").first).toHaveLength(18);
  });

  it("Real data: the four-month calculation", () => {
    expect(numericAnswer(correlationRealDataLesson, "calc-check")).toBeCloseTo(pearsonCorrelation([4, -2, 0, -2], [2, 0, -2, 0])!, 2);
  });

  it("returns no coefficient for a series without variation, never 0", () => {
    expect(pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(pearsonCorrelation([1], [2])).toBeNull();
    expect(() => pearsonCorrelation([1, 2], [1])).toThrow(RangeError);
  });
});
