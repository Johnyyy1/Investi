import { describe, expect, it } from "vitest";
import katex from "katex";
import { recoveryReturn, simpleReturn } from "@/features/finance/returns";
import { getModuleBySlug, getModuleLessons } from "@/features/learning/catalog";
import { calculateMaxDrawdown } from "@/features/lab/backtest";
import { priceMetrics } from "@/features/instruments/price-metrics";
import { metricsFor } from "@/features/instruments/price-metrics-presentation";
import { validateCompletion, validateMove } from "@/features/progress/transition";
import { lessonReward, LESSON_PRACTICE_CAPITAL_MINOR, REWARD_POLICY_VERSION } from "@/features/rewards/practice-capital";
import { evaluateQuestion, isQuestion, type QuestionBlock } from "../question-evaluation";
import { getAuthoredLesson } from "../registry";
import { getGuidedSteps } from "../steps";
import type { AuthoredLesson, LessonBlock } from "../types";
import { annualisingVolatilityLesson } from "./annualising-volatility";
import { volatilityLessons, VOLATILITY_MODULE_ID } from "./manifest";
import { maxDrawdownLesson } from "./max-drawdown";
import { annualiseVolatility, drawdownPath, periodStandardDeviation } from "./model";
import { standardDeviationLesson } from "./standard-deviation";
import { volatilityCheckpointLesson } from "./volatility-checkpoint";
import { whatIsVolatilityLesson } from "./what-is-volatility";

const lessons = [whatIsVolatilityLesson, standardDeviationLesson, annualisingVolatilityLesson, maxDrawdownLesson, volatilityCheckpointLesson];

function block<T extends LessonBlock["type"]>(lesson: AuthoredLesson, id: string, type: T) {
  const found = lesson.blocks.find((item) => item.id === id);
  if (!found || found.type !== type) throw new Error(`Missing ${type} ${id}`);
  return found as Extract<LessonBlock, { type: T }>;
}
const numeric = (lesson: AuthoredLesson, id: string) => block(lesson, id, "numericQuestion").answer;
const multi = (lesson: AuthoredLesson, id: string) => Object.fromEntries(block(lesson, id, "multiNumericQuestion").answers.map((answer) => [answer.id, answer.answer]));

function correctAnswers(question: QuestionBlock): Record<string, string> {
  if (question.type === "multipleChoiceQuestion") return { answer: question.correctOptionId };
  if (question.type === "numericQuestion") return { answer: String(question.answer).replace(".", ",") };
  return Object.fromEntries(question.answers.map((answer) => [answer.id, String(answer.answer)]));
}
function wrongAnswers(question: QuestionBlock): Record<string, string> {
  if (question.type === "multipleChoiceQuestion") return { answer: question.options.find((option) => option.id !== question.correctOptionId)!.id };
  if (question.type === "numericQuestion") return { answer: String(question.answer + question.tolerance * 10 + 1) };
  return Object.fromEntries(question.answers.map((answer) => [answer.id, String(answer.answer + answer.tolerance * 10 + 1)]));
}

describe("Volatility module", () => {
  it("publishes five lessons as one available module of 55 minutes", () => {
    expect(volatilityLessons.map((lesson) => lesson.status)).toEqual(["available", "available", "available", "available", "available"]);
    expect(getModuleBySlug("volatility")).toMatchObject({ status: "available", lessonCount: 5, estimatedMinutes: 55 });
    expect(getModuleLessons("volatility").map((lesson) => lesson.moduleId)).toEqual(Array(5).fill(VOLATILITY_MODULE_ID));
    for (const [index, lesson] of lessons.entries()) {
      expect(getAuthoredLesson("volatility", volatilityLessons[index].slug)).toBe(lesson);
      expect(lesson).toMatchObject({ id: volatilityLessons[index].id, position: index + 1, moduleSlug: "volatility" });
    }
  });

  it("chains the lessons in curriculum order", () => {
    for (const [index, lesson] of lessons.entries()) {
      expect(lesson.navigation?.previous?.href).toBe(index === 0 ? undefined : `/learn/volatility/${volatilityLessons[index - 1].slug}`);
      expect(lesson.navigation?.next?.href).toBe(index === lessons.length - 1 ? undefined : `/learn/volatility/${volatilityLessons[index + 1].slug}`);
    }
  });

  it("rewards each first completion with 2,000 Kč of Practice Capital under policy v4", () => {
    for (const lesson of volatilityLessons) {
      expect(lessonReward(lesson.id)).toEqual({ practiceCapitalMinor: LESSON_PRACTICE_CAPITAL_MINOR, rewardPolicyVersion: REWARD_POLICY_VERSION });
    }
    expect(LESSON_PRACTICE_CAPITAL_MINOR).toBe(BigInt(200_000));
  });

  it.each(lessons)("$title opens with a prediction or a scenario and has an interactive task", (lesson) => {
    const steps = getGuidedSteps(lesson);
    expect(steps[0].blocks.some(isQuestion)).toBe(true);
    expect(lesson.blocks.filter(isQuestion).length).toBeGreaterThanOrEqual(3);
    if (lesson !== volatilityCheckpointLesson) expect(lesson.blocks.some((item) => item.type === "interactiveFigure")).toBe(true);
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

  it.each(lessons)("$title never repeats a step title as a block heading", (lesson) => {
    for (const step of getGuidedSteps(lesson)) {
      for (const item of step.blocks) if ("title" in item) expect(item.title).not.toBe(step.title);
    }
  });

  it.each(lessons)("$title completes only from the final step", (lesson) => {
    const last = getGuidedSteps(lesson).length - 1;
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: last - 1 })).toThrow();
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: last })).not.toThrow();
  });

  it.each(lessons)("$title uses valid KaTeX", (lesson) => {
    for (const item of lesson.blocks) {
      if (item.type === "formula") expect(() => katex.renderToString(item.latex ?? item.expression, { throwOnError: true, strict: "error" })).not.toThrow();
    }
  });
});

describe("Volatility answers follow the Lab's conventions", () => {
  it("What is volatility: selling the swinging fund early", () => {
    expect(numeric(whatIsVolatilityLesson, "swing-return")).toBeCloseTo(simpleReturn(100, 95) * 100, 10);
  });

  it("Standard deviation: the sample (n − 1) deviation of the practice series", () => {
    const answers = multi(standardDeviationLesson, "sd-practice");
    expect(answers.mean).toBe(1);
    expect(answers.deviation).toBeCloseTo(periodStandardDeviation([0.02, -0.01, 0.03, 0]) * 100, 2);
    // The worked example: series Y, 2,94 %.
    expect(periodStandardDeviation([0.04, -0.02, 0.03, -0.01]) * 100).toBeCloseTo(2.944, 3);
    // A learner dividing by n gets 1,58 %, which the tolerance rejects.
    const sd = block(standardDeviationLesson, "sd-practice", "multiNumericQuestion");
    expect(evaluateQuestion(sd, { mean: "1", deviation: "1,58" })).toBe(false);
  });

  it("Annualising: √12 for monthly data, and annualise before comparing frequencies", () => {
    expect(numeric(annualisingVolatilityLesson, "monthly-practice")).toBeCloseTo(annualiseVolatility(0.05, "monthly") * 100, 2);
    expect(annualiseVolatility(0.01, "daily") * 100).toBeCloseTo(15.87, 2);
    expect(annualiseVolatility(0.008, "daily") * 100).toBeCloseTo(12.70, 2);
    expect(annualiseVolatility(0.04, "monthly") * 100).toBeCloseTo(13.86, 2);
    expect(block(annualisingVolatilityLesson, "compare-check", "multipleChoiceQuestion").correctOptionId).toBe("b");
  });

  it("Max drawdown: the prediction path, the practice and the recovery", () => {
    const prediction = [100, 120, 90, 110, 80, 130];
    expect(drawdownPath(prediction).maxDrawdown?.depth).toBeCloseTo(-1 / 3, 12);
    expect(calculateMaxDrawdown(prediction)).toBeCloseTo(1 / 3, 12);
    expect(numeric(maxDrawdownLesson, "depth-practice")).toBeCloseTo(simpleReturn(250, 175) * 100, 10);
    expect(numeric(maxDrawdownLesson, "recovery-practice")).toBeCloseTo(recoveryReturn(0.3) * 100, 2);
  });

  it("Max drawdown: order changes the drawdown but not the deviation or the end value", () => {
    const values = (returns: number[]) => returns.reduce((path, value) => [...path, path[path.length - 1] * (1 + value)], [100]);
    const alternating = [0.1, -0.1, 0.1, -0.1], clustered = [0.1, 0.1, -0.1, -0.1];
    expect(periodStandardDeviation(alternating)).toBeCloseTo(periodStandardDeviation(clustered), 12);
    expect(values(alternating).at(-1)).toBeCloseTo(98.01, 10);
    expect(values(clustered).at(-1)).toBeCloseTo(98.01, 10);
    expect(drawdownPath(values(alternating)).maxDrawdown?.depth).toBeCloseTo(-0.109, 12);
    expect(drawdownPath(values(clustered)).maxDrawdown?.depth).toBeCloseTo(-0.19, 12);
  });

  it("Checkpoint: deviation, weekly annualisation, drawdown and recovery", () => {
    const sd = multi(volatilityCheckpointLesson, "sd-check");
    expect(sd.mean).toBe(1);
    expect(sd.deviation).toBeCloseTo(periodStandardDeviation([0.03, -0.01, 0.01, 0.01]) * 100, 2);
    expect(numeric(volatilityCheckpointLesson, "annualise-check")).toBeCloseTo(annualiseVolatility(0.02, "weekly") * 100, 2);
    expect(numeric(volatilityCheckpointLesson, "drawdown-check")).toBeCloseTo(drawdownPath([50, 60, 45, 70, 56]).maxDrawdown!.depth * 100, 10);
    expect(numeric(volatilityCheckpointLesson, "recovery-check")).toBeCloseTo(recoveryReturn(0.25) * 100, 2);
  });

  it("matches the instrument detail's max drawdown on the same closes", () => {
    const closes = [100, 120, 90, 110, 80, 130];
    const metrics = priceMetrics(closes.map((close, index) => ({ date: `2024-01-0${index + 1}`, close })))!;
    expect(metrics.maxDrawdown?.depth).toBeCloseTo(drawdownPath(closes).maxDrawdown!.depth, 12);
  });
});

describe("Lab metrics lead to the Volatility lessons", () => {
  it("links Volatility and Největší propad to authored lessons", () => {
    const metrics = metricsFor(priceMetrics([{ date: "2024-01-02", close: 100 }, { date: "2024-01-03", close: 90 }])!);
    const lessonOf = (id: string) => metrics.find((metric) => metric.id === id)?.lesson;
    expect(lessonOf("volatility")).toEqual({ href: "/learn/volatility/what-is-volatility", label: `Lekce: ${volatilityLessons[0].title}` });
    expect(lessonOf("max-drawdown")).toEqual({ href: "/learn/volatility/max-drawdown", label: `Lekce: ${volatilityLessons[3].title}` });
    expect(lessonOf("simple-return")?.href).toBe("/learn/returns/what-is-a-return");
  });
});
