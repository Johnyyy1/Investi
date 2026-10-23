import { describe, expect, it } from "vitest";
import { foundationsContent } from "./content";
import { block } from "../lesson-test-support";
import { evaluateQuestion } from "../question-evaluation";
import { lessonSteps, validateCompletion, validateMove } from "@/features/progress/transition";
import originalLessons from "../published-lessons-v1.json";

const lesson = foundationsContent.find((lesson) => lesson.id === "foundations-stocks")!;

describe("stocks in a Czech investor's currency (#156)", () => {
  it.each([
    ["position-practice", 3, 150, 1],
    ["mastery-position", 3, 120, 1],
    ["position-czk", 3, 150, 20],
  ] as const)("recomputes %s from quantity, price and CZK exchange rate", (id, quantity, price, rate) => {
    const question = block(lesson, id, "numericQuestion");
    const expected = quantity * price * rate;
    expect(question.answer).toBe(expected);
    expect(question.unit).toBe("Kč");
    expect(question.tolerance).toBe(0.000001);
    expect(evaluateQuestion(question, { answer: `${expected},00` })).toBe(true);
    expect(evaluateQuestion(question, { answer: String(expected + 0.01) })).toBe(false);
    expect(evaluateQuestion(question, { answer: "" })).toBeUndefined();
  });

  it("recomputes the worked example and the loss caused only by FX", () => {
    const quantity = 3, priceUsd = 150, initialRate = 22, finalRate = 20;
    const usdValue = quantity * priceUsd;
    const initialCzk = usdValue * initialRate, finalCzk = usdValue * finalRate;
    const format = (value: number) => new Intl.NumberFormat("cs-CZ").format(value).replaceAll("\u00a0", " ");
    const example = block(lesson, "fx-example", "workedExample");
    expect(example.title).toContain("Modelový příklad");
    expect(example.steps[0].value).toContain(`${format(usdValue)} USD`);
    expect(example.steps[1].value).toContain(`${format(initialCzk)} Kč`);
    const question = block(lesson, "position-czk", "numericQuestion");
    expect(question.answer).toBe(finalCzk);
    expect(question.correctExplanation).toContain(`${format(initialCzk - finalCzk)} Kč méně jen kvůli kurzu`);
    expect(evaluateQuestion(question, { answer: String(usdValue) })).toBe(false);
    expect(question.incorrectExplanation).toContain("450 je hodnota v USD, ne v Kč");
  });

  it("maps every old cursor identically and requires the new question at the old final boundary", () => {
    const original = originalLessons.find((lesson) => lesson.id === "foundations-stocks")!;
    const steps = lessonSteps(lesson.id);
    const oldFinal = original.steps.length - 1;
    expect(steps).toHaveLength(original.steps.length + 1);
    expect(lesson).toMatchObject({ moduleSlug: original.moduleSlug, slug: original.slug });
    for (let position = 0; position < oldFinal; position++) {
      expect(steps[position].blocks.map((block) => block.id)).toEqual(original.steps[position].blocks);
    }
    expect(steps[oldFinal].title).toBe("Akcie v jiné měně");
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: oldFinal })).toThrow();
    for (const answer of [undefined, "450", "9900"]) {
      expect(() => validateMove(lesson.id, oldFinal, oldFinal + 1, answer ? { answer } : {})).toThrow();
    }
    expect(() => validateMove(lesson.id, oldFinal, oldFinal + 1, { answer: String(3 * 150 * 20) })).not.toThrow();
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: oldFinal + 1 })).not.toThrow();
    expect(() => validateCompletion(lesson.id, { status: "completed", lastPosition: oldFinal })).not.toThrow();
    expect(steps.at(-1)!.blocks.map((block) => block.id)).toEqual(original.steps.at(-1)!.blocks);
  });
});
