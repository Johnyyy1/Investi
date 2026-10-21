import { describe, expect, it } from "vitest";
import katex from "katex";
import { block, correctAnswers, wrongAnswers } from "@/features/lessons/lesson-test-support";
import { evaluateQuestion, isQuestion } from "@/features/lessons/question-evaluation";
import { exampleDefinition, exampleLesson, exampleSteps } from "./lesson";

// Vitest hledá testy v src. Postup je v docs/education/lesson-standard.md.
// Po publikaci spusť i registry, curriculum a transition testy; tato lokální
// strukturální kontrola sama neověřuje zapojení do serverového průchodu.
const steps = exampleSteps[exampleLesson.id].map((step) => ({
  ...step,
  blocks: step.blocks.map((id) => {
    const found = exampleLesson.blocks.find((item) => item.id === id);
    if (!found) throw new Error(`Missing authored block: ${id}`);
    return found;
  }),
}));

describe("autorský vzor: struktura a vyhodnocení", () => {
  it("souhlasí s definicí a má jedinečná ID bloků a sekcí", () => {
    expect(exampleLesson).toMatchObject({
      id: exampleDefinition.id, slug: exampleDefinition.slug,
      title: exampleDefinition.title, estimatedMinutes: exampleDefinition.estimatedMinutes,
    });
    expect(new Set(exampleLesson.blocks.map((item) => item.id)).size).toBe(exampleLesson.blocks.length);
    expect(new Set(exampleLesson.sections.map((section) => section.id)).size).toBe(exampleLesson.sections.length);
  });

  it("zobrazí každý blok právě jednou, nejvýše jednu otázku na krok a žádnou v závěru", () => {
    const shownIds = steps.flatMap((step) => step.blocks.map((item) => item.id));
    expect([...shownIds].sort()).toEqual(exampleLesson.blocks.map((item) => item.id).sort());
    expect(steps.length).toBeGreaterThan(1);
    for (const step of steps) {
      expect(step.blocks.length).toBeGreaterThan(0);
      expect(step.blocks.filter(isQuestion).length).toBeLessThanOrEqual(1);
    }
    expect(steps.at(-1)!.blocks.some(isQuestion)).toBe(false);
    expect(steps.at(-1)!.blocks.some((item) => item.type === "lessonSummary")).toBe(true);
    expect(steps.some((step) => step.kind === "mastery" && step.blocks.some(isQuestion))).toBe(true);
  });

  it("má platné možnosti, konečné hodnoty a přijímá správné, odmítá chybné a prázdné odpovědi", () => {
    for (const question of exampleLesson.blocks.filter(isQuestion)) {
      if (question.type === "multipleChoiceQuestion") {
        expect(question.options.length).toBeGreaterThan(1);
        expect(new Set(question.options.map((option) => option.id)).size).toBe(question.options.length);
        expect(question.options.filter((option) => option.id === question.correctOptionId)).toHaveLength(1);
      } else {
        const fields = question.type === "multiNumericQuestion" ? question.answers : [question];
        expect(fields.length).toBeGreaterThan(0);
        if (question.type === "multiNumericQuestion") {
          expect(new Set(question.answers.map((field) => field.id)).size).toBe(question.answers.length);
        }
        for (const field of fields) {
          expect(Number.isFinite(field.answer)).toBe(true);
          expect(Number.isFinite(field.tolerance)).toBe(true);
          expect(field.tolerance).toBeGreaterThanOrEqual(0);
          expect(field.unit).toBe("Kč");
        }
      }
      expect(evaluateQuestion(question, {})).not.toBe(true);
      expect(evaluateQuestion(question, wrongAnswers(question))).toBe(false);
      expect(evaluateQuestion(question, correctAnswers(question))).toBe(true);
    }
  });

  it("používá platný KaTeX", () => {
    for (const item of exampleLesson.blocks) {
      if (item.type === "formula") {
        expect(() => katex.renderToString(item.latex ?? item.expression, { throwOnError: true, strict: "error" })).not.toThrow();
      }
    }
  });
});

describe("autorský vzor: odpovědi přepočtené z původních vstupů", () => {
  // Vstupy zde opisuj ze zadání, nikoli z uložených odpovědí nebo pomocné
  // konstanty s výsledkem. Při změně textu reviewer ověří shodu vstupů.
  it("přepočítá úvodní porovnání i všechny hodnoty řešeného příkladu", () => {
    const purchaseCzk = 10_000, percentageRate = 0.25, fixedFeeCzk = 40;
    const decimalRate = percentageRate / 100;
    const percentageFeeCzk = purchaseCzk * decimalRate;
    const format = (value: number) => new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 4 }).format(value);
    const worked = block(exampleLesson, "worked-example", "workedExample");
    expect(worked.steps.map((step) => step.value)).toEqual([
      `${format(percentageRate)} ÷ 100 = ${format(decimalRate)}`,
      `10 000 × ${format(decimalRate)} = ${format(percentageFeeCzk)} Kč`,
      `40 − ${format(percentageFeeCzk)} = ${format(fixedFeeCzk - percentageFeeCzk)} Kč`,
    ]);
    expect(block(exampleLesson, "prediction", "multipleChoiceQuestion").correctOptionId)
      .toBe(percentageFeeCzk < fixedFeeCzk ? "percentage" : percentageFeeCzk > fixedFeeCzk ? "fixed" : "equal");
  });

  it("přepočítá částečně řešenou úlohu a ověří český zápis a toleranci", () => {
    const purchaseCzk = 20_000, percentageRate = 0.25;
    const expectedFeeCzk = purchaseCzk * percentageRate / 100;
    const question = block(exampleLesson, "guided-fee", "numericQuestion");
    expect(question.answer).toBeCloseTo(expectedFeeCzk, 10);
    expect(question.tolerance).toBe(0.01);
    expect(evaluateQuestion(question, { answer: expectedFeeCzk.toFixed(2).replace(".", ",") })).toBe(true);
    expect(evaluateQuestion(question, { answer: String(expectedFeeCzk + 0.02) })).toBe(false);
    expect(evaluateQuestion(question, { answer: String(percentageRate) })).toBe(false);
    expect(evaluateQuestion(question, { answer: " " })).not.toBe(true);
  });

  it("přepočítá každé pole samostatné úlohy a nestačí mu jediná správná část", () => {
    const purchaseCzk = 6_000, percentageRate = 0.25, fixedFeeCzk = 40;
    const expected = { fixed: purchaseCzk + fixedFeeCzk, percentage: purchaseCzk * (1 + percentageRate / 100) };
    const question = block(exampleLesson, "independent-totals", "multiNumericQuestion");
    expect(question.answers.map((field) => field.id).sort()).toEqual(Object.keys(expected).sort());
    for (const field of question.answers) {
      expect(field.answer).toBeCloseTo(expected[field.id as keyof typeof expected], 10);
      expect(field.tolerance).toBe(0.01);
    }
    const answers = Object.fromEntries(Object.entries(expected).map(([id, value]) => [id, value.toFixed(2).replace(".", ",")]));
    expect(evaluateQuestion(question, answers)).toBe(true);
    for (const id of Object.keys(expected)) {
      expect(evaluateQuestion(question, { ...answers, [id]: "" })).not.toBe(true);
      expect(evaluateQuestion(question, { ...answers, [id]: String(purchaseCzk) })).toBe(false);
    }
  });
});
