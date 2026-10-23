import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StateSupportCalculator } from "@/components/lesson/state-support-calculator";
import { getAuthoredLesson, pensionAndDipLesson as lesson } from "../registry";
import { getGuidedSteps } from "../steps";
import { correctAnswers, wrongAnswers } from "../answer-keys";
import { evaluateQuestion, isQuestion } from "../question-evaluation";
import { validateMove, validateStepMove } from "@/features/progress/transition";
import { getLessonPlacement } from "@/features/learning/curriculum";
import { availableLessons, curriculumLessons } from "@/features/learning/catalog";
import { lessonReward } from "@/features/rewards/practice-capital";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import { factRegistry } from "@/features/facts/registry";
import { formatFactValue } from "@/features/facts/resolve";
import { annualDeduction, parseWholeKc, pensionRules, stateContribution, taxSaving } from "./pension-model";

const steps = getGuidedSteps(lesson);
const block = (id: string) => lesson.blocks.find((entry) => entry.id === id)!;
const kc = (value: number) => `${value.toLocaleString("cs-CZ").replaceAll(" ", " ")} Kč`;
const versions = (key: string) => factRegistry.filter((fact) => fact.key === key);

describe("pension and DIP lesson 0.1.5", () => {
  it("reserves identity and prerequisite without publishing before expert review", () => {
    expect(curriculumLessons.find((entry) => entry.id === lesson.id)).toMatchObject({ id: "before-investing-retirement-products", moduleId: "module-before-investing", moduleSlug: "before-investing", slug: "pension-and-dip", status: "planned" });
    expect(availableLessons.some((entry) => entry.id === lesson.id)).toBe(false);
    expect(getAuthoredLesson("before-investing", "pension-and-dip")).toBeUndefined();
    expect(() => validateMove(lesson.id, 0, 1, { answer: "cap" })).toThrow(/unavailable/);
    expect(getLessonPlacement(lesson.id)).toMatchObject({ displayCode: "0.1.5", required: "recommended", prerequisites: ["before-investing-goals"] });
    expect(lessonReward(lesson.id)).toEqual({ practiceCapitalMinor: 0n, rewardPolicyVersion: 4 });
  });

  it("includes every block exactly once, at most one question per step and no final question", () => {
    expect(steps.flatMap((step) => step.blocks.map((entry) => entry.id)).sort()).toEqual(lesson.blocks.map((entry) => entry.id).sort());
    expect(new Set(lesson.blocks.map((entry) => entry.id)).size).toBe(lesson.blocks.length);
    for (let index = 0; index < steps.length - 1; index++) {
      const questions = steps[index].blocks.filter(isQuestion);
      expect(questions.length).toBeLessThanOrEqual(1);
      if (questions[0]) {
        expect(steps[index].blocks.at(-1)).toBe(questions[0]);
        expect(() => validateStepMove(steps, index, index + 1, wrongAnswers(questions[0]))).toThrow(/correctly/);
        expect(() => validateStepMove(steps, index, index + 1, correctAnswers(questions[0], { decimalComma: true }))).not.toThrow();
      } else expect(() => validateStepMove(steps, index, index + 1)).not.toThrow();
    }
    expect(steps.at(-1)!.blocks.some(isQuestion)).toBe(false);
  });

  it("pins the rules model to every registry version of the facts it encodes", () => {
    const state = versions("dps.statni_prispevek");
    expect(state.length).toBeGreaterThan(0);
    for (const fact of state) for (const amount of [pensionRules.minMonthly, pensionRules.capMonthly, pensionRules.capMonthly * pensionRules.statePercent / 100]) expect(formatFactValue(fact.value).replaceAll(" ", " ")).toContain(kc(amount));
    for (const fact of versions("dps.odpocet")) expect(fact.value).toEqual({ amount: pensionRules.sharedDeductionAnnual, unit: "Kč ročně" });
    for (const fact of versions("zam.prispevek")) expect(fact.value.amount).toBe(50000);
    for (const fact of versions("dip.podminky")) expect(fact.value.amount).toMatch(/120 měsíců.*60 let/);
  });

  it("recomputes every numeric answer and worked value from the stated inputs", () => {
    const [rate, cap, min] = [20 / 100, 1700, 500];
    const contribution = block("contribution");
    expect(contribution).toMatchObject({ answer: 1200 * rate, tolerance: 0 });
    expect(block("cap")).toMatchObject({ answer: cap * rate, tolerance: 0 });
    const deduction = block("deduction-question");
    if (deduction.type !== "multiNumericQuestion") throw new Error("Missing deduction question");
    expect(deduction.answers.map((field) => [field.answer, field.tolerance])).toEqual([[(3000 - cap) * 12, 0], [(3000 - cap) * 12 * 0.15, 0]]);
    expect(evaluateQuestion(deduction, { deduction: "15600", saving: "15600" })).toBe(false);
    const capQuestion = block("cap");
    if (!isQuestion(capQuestion)) throw new Error("Missing cap question");
    expect(evaluateQuestion(capQuestion, { answer: "500" })).toBe(false);
    const shared = block("shared");
    const naive = 48000 + (3000 - cap) * 12;
    expect(shared).toMatchObject({ correctOptionId: "48", options: [{ label: kc(Math.min(naive, 48000)) }, { label: kc(naive) }, { label: kc(48000 * 2) }] });
    const values = (id: string) => { const entry = block(id); if (entry.type !== "workedExample") throw new Error(id); return entry.steps.map((step) => step.value); };
    expect(values("dps-example")).toEqual([kc(800 * rate), kc(cap * rate), kc(cap * rate)]);
    expect(values("deduction-example")).toEqual([`${kc(2500 - cap)} měsíčně`, `${kc((2500 - cap) * 12)} ročně`, `${kc((2500 - cap) * 12 * 0.15)} ročně`, `${kc(48000 / 12 + cap)} měsíčně`]);
    expect(values("eva")).toEqual([kc(cap * rate), kc(cap * rate * 12), kc(0)]);
    expect(stateContribution(min - 1)).toBe(0);
  });

  it("keeps content honest: tokens resolve, no stale threshold, no brands or unapproved proposals", () => {
    const result = prepareLessonFacts(lesson, factRegistry, { today: "2026-10-23", published: false });
    const text = JSON.stringify(result.lesson).replaceAll(" ", " ");
    expect(text).not.toContain("{{");
    expect(result.facts.map((fact) => fact.key).sort()).toEqual(["dip.podminky", "dps.odpocet", "dps.statni_prispevek", "zam.prispevek"]);
    expect(result.notice?.verifiedAt).toBeDefined();
    expect(text).not.toMatch(/(?<![\d ])1 000 Kč/);
    expect(text).not.toMatch(/kolébk|401\(k\)|IRA\b/i);
    expect(() => prepareLessonFacts(lesson, factRegistry, { today: "2026-10-23", published: true })).toThrow(/blocked/);
  });
});

describe("state support model", () => {
  it("applies the minimum, cap and shared limit in whole Kč", () => {
    expect([0, 499, 500, 1200, 1700, 2500].map(stateContribution)).toEqual([0, 0, 100, 240, 340, 340]);
    expect(annualDeduction(1700)).toBe(0);
    expect(annualDeduction(2500)).toBe(9600);
    expect(annualDeduction(5700)).toBe(48000);
    expect(annualDeduction(10000)).toBe(48000);
    expect(annualDeduction(3000, 48000)).toBe(48000);
    expect(annualDeduction(0, 20000)).toBe(20000);
    expect(taxSaving(9600)).toBe(1440);
    expect(taxSaving(48000)).toBe(7200);
  });
  it("rejects blank, fractional and out-of-range input rather than treating it as zero", () => {
    for (const raw of ["", " ", "text", "-1", "0,25", "1,3333", "10000001"]) expect(parseWholeKc(raw)).toBeNull();
    expect(parseWholeKc("1700")).toBe(1700);
    expect(parseWholeKc("0")).toBe(0);
  });
  it("renders the calculator's defaults without storage or a form", () => {
    const html = renderToStaticMarkup(createElement(StateSupportCalculator)).replaceAll(" ", " ");
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toContain("340 Kč");
    expect(text).toContain("4 080 Kč");
    expect(html).not.toContain("<form");
  });
});
