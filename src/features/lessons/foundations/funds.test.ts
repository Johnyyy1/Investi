import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FundCostComparison } from "@/components/lesson/fund-cost-comparison";
import { getLessonPlacement } from "@/features/learning/curriculum";
import { validateCompletion, validateMove } from "@/features/progress/transition";
import { lessonReward } from "@/features/rewards/practice-capital";
import { progressionUnlocks } from "@/features/progression/unlocks";
import { getAuthoredLesson } from "../registry";
import { getGuidedSteps } from "../steps";
import { correctAnswers, wrongAnswers } from "../answer-keys";
import { evaluateQuestion, isQuestion } from "../question-evaluation";
import { block } from "../lesson-test-support";
import { compareFundCosts, fundValue } from "./fund-cost-model";

const lesson = getAuthoredLesson("investing-foundations", "funds")!;
const steps = getGuidedSteps(lesson);
const czk = (value: number) => new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.round(value)).replace(/\s/g, " ");

describe("funds lesson 1.1.8 (#162)", () => {
  it("publishes in Foundations after ETFs without changing the Lab unlock or the L1 reward", () => {
    expect(lesson).toMatchObject({ id: "foundations-funds", slug: "funds", position: 8 });
    expect(getLessonPlacement(lesson.id)).toMatchObject({ displayCode: "1.1.8", prerequisites: ["foundations-etfs-indexes"], required: "required" });
    expect(lessonReward(lesson.id).practiceCapitalMinor).toBe(0n);
    expect(progressionUnlocks.PORTFOLIO_LAB.prerequisiteLessonIds).not.toContain(lesson.id);
    expect(progressionUnlocks.PORTFOLIO_LAB.xpRequired).toBe(420);
  });

  it("grades at most one question per step, none on the final step, and gates every move on the server", () => {
    expect(steps.flatMap((step) => step.blocks.map((block) => block.id)).sort()).toEqual(lesson.blocks.map((block) => block.id).sort());
    for (const [position, step] of steps.entries()) {
      expect(step.blocks.filter(isQuestion).length).toBeLessThanOrEqual(1);
      for (const question of step.blocks.filter(isQuestion)) {
        expect(() => validateMove(lesson.id, position, position + 1, wrongAnswers(question))).toThrow();
        expect(() => validateMove(lesson.id, position, position + 1, correctAnswers(question))).not.toThrow();
      }
    }
    expect(steps.at(-1)!.blocks.some(isQuestion)).toBe(false);
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: steps.length - 1 })).not.toThrow();
  });

  it("recomputes the worked example from its inputs, rounded to whole Kč", () => {
    const [amount, gross, entryA, ongoingA, ongoingB, years] = [100_000, 0.06, 0.03, 0.019, 0.0022, 20];
    const fundA = amount * (1 - entryA) * (1 + gross - ongoingA) ** years;
    const etfB = amount * (1 + gross - ongoingB) ** years;
    expect([Math.round(fundA), Math.round(etfB), Math.round(etfB) - Math.round(fundA)]).toEqual([216_664, 307_660, 90_996]);
    const values = block(lesson, "cost-example", "workedExample").steps.map((step) => step.value);
    expect(values).toContain(`97 000 × 1,041²⁰ ≈ ${czk(fundA)} Kč`);
    expect(values).toContain(`100 000 × 1,0578²⁰ ≈ ${czk(etfB)} Kč`);
    expect(values).toContain(`307 660 − 216 664 ≈ ${czk(Math.round(etfB) - Math.round(fundA))} Kč`);
    // The calculator's lump-sum path is the same model as the worked example.
    expect(fundValue(3, 1.9, 6, 20, false)!.value).toBeCloseTo(fundA, 6);
    expect(fundValue(0, 0.22, 6, 20, false)!.value).toBeCloseTo(etfB, 6);
  });

  it("recomputes the numeric answers and accepts Czech notation", () => {
    const entry = block(lesson, "entry-fee", "numericQuestion");
    expect(entry.answer).toBe(50_000 * (1 - 0.03));
    expect(block(lesson, "mastery-regular-fee", "numericQuestion").answer).toBeCloseTo(2_000 * 0.03 * 12, 9);
    expect(evaluateQuestion(entry, { answer: "48500" })).toBe(true);
    expect(evaluateQuestion(entry, { answer: "48500,0" })).toBe(true);
    expect(evaluateQuestion(entry, { answer: "48501" })).toBe(false);
    expect(evaluateQuestion(entry, { answer: "50000" })).toBe(false);
    expect(evaluateQuestion(entry, { answer: "" })).toBeUndefined();
  });

  it("asks for exactly the entry and ongoing cost rows of the fictional KID", () => {
    const kid = block(lesson, "kid-costs", "documentTap");
    expect(kid.correctRowIds).toEqual(["entry", "ongoing"]);
    expect(kid.document.rows.find((row) => row.id === "entry")?.cells.value).toBe("3 % z investované částky");
    expect(kid.document.rows.find((row) => row.id === "ongoing")?.cells.value).toBe("1,9 % hodnoty ročně");
    expect(kid.document.eyebrow).toMatch(/^Modelový příklad/);
    expect(evaluateQuestion(kid, { selected: "entry" })).toBe(false);
    expect(evaluateQuestion(kid, { selected: "entry,ongoing,scenario" })).toBe(false);
  });

  it("renders a labelled model calculator with accessible inputs and no recommendation", () => {
    const html = renderToStaticMarkup(createElement(FundCostComparison));
    expect(html.match(/type="range"/g)).toHaveLength(4);
    expect(html).toContain("Způsob investování");
    expect(html).toContain("Výsledek porovnání nákladů fondu");
    expect(html).toContain("není předpověď ani doporučení");
  });
});

describe("fund cost model", () => {
  it("costs nothing when there are no fees", () => {
    for (const regular of [false, true]) expect(compareFundCosts(0, 0, 6, 20, regular)!.costImpact).toBe(0);
    expect(fundValue(0, 0, 0, 3, true)).toEqual({ contributed: 72_000, value: 72_000 });
  });

  it("takes the entry fee from every regular contribution and matches an annuity", () => {
    for (const fee of [0.1, 0.25, 1.3333]) expect(fundValue(fee, 0, 0, 2, true)!.value).toBeCloseTo(48_000 * (1 - fee / 100), 6);
    const monthly = 1.05 ** (1 / 12) - 1;
    expect(fundValue(0, 1, 6, 10, true)!.value).toBeCloseTo(2_000 * ((1 + monthly) ** 120 - 1) / monthly, 6);
  });

  it("grows the cost impact with time", () => {
    const impacts = [1, 10, 20, 40].map((years) => compareFundCosts(3, 1.9, 6, years, false)!.costImpact);
    for (let index = 1; index < impacts.length; index++) expect(impacts[index]).toBeGreaterThan(impacts[index - 1]);
  });

  it("rejects invalid inputs instead of producing a result", () => {
    for (const input of [[NaN, 1, 6, 20], [Infinity, 1, 6, 20], [-0.1, 1, 6, 20], [5.1, 1, 6, 20], [3, -0.1, 6, 20], [3, 3.1, 6, 20], [3, 1, -5.1, 20], [3, 1, 12.1, 20], [3, 1, 6, 0], [3, 1, 6, 41], [3, 1, 6, 1.5]]) {
      expect(compareFundCosts(...(input as [number, number, number, number]), false)).toBeNull();
    }
  });
});
