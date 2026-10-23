import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmergencyFundCalculator } from "@/components/lesson/emergency-fund-calculator";
import { getAuthoredLesson, emergencyFundLesson } from "../registry";
import { getGuidedSteps } from "../steps";
import { correctAnswers, wrongAnswers } from "../answer-keys";
import { evaluateQuestion, isQuestion } from "../question-evaluation";
import { validateMove, validateStepMove } from "@/features/progress/transition";
import { getLessonPlacement } from "@/features/learning/curriculum";
import { availableLessons, curriculumLessons, getModuleBySlug } from "@/features/learning/catalog";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import { factRegistry } from "@/features/facts/registry";
import { emergencyFundEstimate, parseEmergencyInput } from "./emergency-fund-model";

const today = "2026-10-23";
const prepared = () => prepareLessonFacts(emergencyFundLesson, factRegistry, { today, published: false });
const steps = getGuidedSteps(emergencyFundLesson);

describe("emergency fund lesson 0.1.3", () => {
  it("reserves identity and prerequisite without publishing before expert review", () => {
    expect(curriculumLessons.find((lesson) => lesson.id === emergencyFundLesson.id)).toMatchObject({ moduleId: "module-before-investing", moduleSlug: "before-investing", slug: "emergency-fund", status: "planned" });
    expect(availableLessons.some((lesson) => lesson.id === emergencyFundLesson.id)).toBe(false);
    expect(getAuthoredLesson("before-investing", "emergency-fund")).toBeUndefined();
    expect(() => validateMove(emergencyFundLesson.id, 0, 1, { answer: "reserve" })).toThrow(/unavailable/);
    expect(getModuleBySlug("before-investing")).toMatchObject({ lessonCount: 1, estimatedMinutes: 12 });
    expect(getLessonPlacement(emergencyFundLesson.id)).toMatchObject({ displayCode: "0.1.3", required: "recommended", prerequisites: ["before-investing-budget"] });
  });
  it("recomputes every numeric answer from the explicit example inputs", () => {
    const range = emergencyFundLesson.blocks.find((block) => block.id === "range");
    expect(range?.type).toBe("multiNumericQuestion");
    if (range?.type !== "multiNumericQuestion") throw new Error("Missing range question");
    expect(range.answers.map((field) => field.answer)).toEqual([30000 * 3, 30000 * 6]);
    expect(range.answers.map((field) => field.tolerance)).toEqual([0, 0]);
    expect(evaluateQuestion(range, { lower: "90000", upper: "90000" })).toBe(false);
    const question = emergencyFundLesson.blocks.find((block) => block.id === "real-question");
    const computed = ((1 + 3.5 / 100) / (1 + 2.5 / 100) - 1) * 100;
    expect(question).toMatchObject({ answer: Number(computed.toFixed(2)), tolerance: 0.01 });
    if (!question || !isQuestion(question)) throw new Error("Missing real return question");
    expect(evaluateQuestion(question, { answer: "0,98" })).toBe(true);
    expect(evaluateQuestion(question, { answer: "1,00" })).toBe(false);
    const numeric = emergencyFundLesson.blocks.filter((block) => block.type === "numericQuestion" || block.type === "multiNumericQuestion");
    expect(numeric.map((block) => block.id)).toEqual(["range", "real-question"]);
  });
  it("includes every block exactly once, at most one question per step and no final question", () => {
    expect(steps.flatMap((step) => step.blocks.map((block) => block.id)).sort()).toEqual(emergencyFundLesson.blocks.map((block) => block.id).sort());
    expect(new Set(emergencyFundLesson.blocks.map((block) => block.id)).size).toBe(emergencyFundLesson.blocks.length);
    for (let index = 0; index < steps.length - 1; index++) {
      const questions = steps[index].blocks.filter(isQuestion);
      expect(questions.length).toBeLessThanOrEqual(1);
      const question = questions[0];
      if (question) {
        expect(() => validateStepMove(steps, index, index + 1, wrongAnswers(question))).toThrow(/correctly/);
        expect(() => validateStepMove(steps, index, index + 1, correctAnswers(question, { decimalComma: true }))).not.toThrow();
      } else expect(() => validateStepMove(steps, index, index + 1)).not.toThrow();
    }
    expect(steps.at(-1)!.blocks.some(isQuestion)).toBe(false);
  });
  it("resolves typed calculator rates and scoped prose from the dated registry", () => {
    const result = prepared();
    expect(JSON.stringify(result.lesson)).not.toContain("{{");
    expect(result.facts.map((fact) => fact.key)).toEqual(expect.arrayContaining(["makro.inflace", "makro.repo", "dan.urok_srazka", "vklady.limit"]));
    expect(result.notice?.verifiedAt).toBe("2026-10-21");
    const block = result.lesson.blocks.find((block) => block.type === "interactiveFigure");
    if (block?.type !== "interactiveFigure") throw new Error("Missing calculator");
    expect(block.emergencyFundFacts).toMatchObject({ inflation: { rate: 0.025, period: expect.stringContaining("2026-09") }, tax: { rate: 0.15, verifiedAt: "2026-10-22" } });
    expect(renderToStaticMarkup(createElement(EmergencyFundCalculator, { facts: block.emergencyFundFacts }))).toContain("0,46 %");
    expect(renderToStaticMarkup(createElement(EmergencyFundCalculator))).toContain("nejsou dostupné");
    const modified = factRegistry.map((fact) => fact.key === "makro.inflace" ? { ...fact, value: { amount: 4, unit: "%" } } : fact);
    const changed = prepareLessonFacts(emergencyFundLesson, modified, { today, published: false }).lesson.blocks.find((item) => item.type === "interactiveFigure");
    expect(changed?.type === "interactiveFigure" && changed.emergencyFundFacts?.inflation.rate).toBe(0.04);
    const unverified = factRegistry.map((fact) => fact.key === "dan.urok_srazka" ? { ...fact, verificationStatus: "unverified" as const, verifiedAt: null } : fact);
    expect(() => prepareLessonFacts(emergencyFundLesson, unverified, { today, published: false })).toThrow(/verified numeric/);
    const stale = prepareLessonFacts(emergencyFundLesson, factRegistry.map((fact) => ({ ...fact, nextReviewAt: "2026-08-01" })), { today, published: false });
    expect(stale.notice?.staleFacts).toContain("Dvoutýdenní repo sazba ČNB");
    expect(emergencyFundLesson.blocks.find((item) => item.id === "calculator")).not.toHaveProperty("emergencyFundFacts");
  });
});

describe("educational reserve model", () => {
  it("calculates unrounded targets and one-year returns including decimal edge cases", () => {
    for (const expense of [0, 0.1, 0.25, 1.3333, 30000]) {
      const result = emergencyFundEstimate(expense, 6, 0.035, 0.025, 0.15);
      expect(result.target).toBe(expense * 6);
      expect(result.netNominal).toBeCloseTo(3.5 / 100 * (1 - 15 / 100), 14);
      expect(result.realBeforeTax).toBeCloseTo(1.035 / 1.025 - 1, 14);
      expect(result.realAfterTax).toBeCloseTo((1 + 0.035 * 0.85) / 1.025 - 1, 14);
    }
    expect(emergencyFundEstimate(25000, 6, 0, 0.025, 0.15).realAfterTax).toBeLessThan(0);
    expect(emergencyFundEstimate(0, 1, 0, 0, 0)).toEqual({ target: 0, netNominal: 0, realBeforeTax: 0, realAfterTax: 0 });
    expect(emergencyFundEstimate(30000, 3, 0.035, -0.01, 0.15).realAfterTax).toBeGreaterThan(0.035);
  });
  it("rejects invalid inputs rather than manufacturing zeroes or infinities", () => {
    for (const bad of [NaN, Infinity, -1, 1_000_000_001]) expect(() => emergencyFundEstimate(bad, 3, 0.035, 0.025, 0.15)).toThrow();
    for (const bad of [0, 37, NaN, Infinity]) expect(() => emergencyFundEstimate(30000, bad, 0.035, 0.025, 0.15)).toThrow();
    for (const bad of [-0.01, 1.01, NaN]) expect(() => emergencyFundEstimate(30000, 3, bad, 0.025, 0.15)).toThrow();
    for (const bad of [-1, 10.01, NaN]) expect(() => emergencyFundEstimate(30000, 3, 0.035, bad, 0.15)).toThrow();
    for (const bad of [-0.01, 1.01, NaN]) expect(() => emergencyFundEstimate(30000, 3, 0.035, 0.025, bad)).toThrow();
    for (const raw of ["", " ", "text", "1e309", "-1"]) expect(parseEmergencyInput(raw, 0, 36)).toBeNull();
    expect(parseEmergencyInput("1,3333", 0, 36)).toBe(1.3333);
    expect(parseEmergencyInput("0.25", 0, 36)).toBe(0.25);
  });
});
