import { describe, expect, it } from "vitest";
import { platformTypesLesson as lesson } from "./platform-types";
import { getGuidedSteps } from "../steps";
import { block } from "../lesson-test-support";
import { correctAnswers, wrongAnswers } from "../answer-keys";
import { evaluateQuestion, isQuestion } from "../question-evaluation";
import { authoredLessons, draftLessons, getAuthoredLesson } from "../registry";
import { validateMove, validateStepMove } from "@/features/progress/transition";
import { getLessonPlacement } from "@/features/learning/curriculum";
import { availableLessons, curriculumLessons, moduleCatalog } from "@/features/learning/catalog";
import { lessonReward } from "@/features/rewards/practice-capital";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import { checkPublishedFacts } from "@/features/facts/check-published";
import { factRegistry } from "@/features/facts/registry";

const today = "2026-10-24";
const steps = getGuidedSteps(lesson);

describe("platform types 2.1.1", () => {
  it("reserves stable identity and L2 placement while keeping the regulatory draft unpublished", () => {
    expect(curriculumLessons.find((entry) => entry.id === lesson.id)).toMatchObject({ id: "broker-platform-types", moduleId: "module-broker-and-account", moduleSlug: "broker-and-account", slug: "platform-types", status: "planned" });
    expect(moduleCatalog.find((entry) => entry.slug === lesson.moduleSlug)?.status).toBe("planned");
    expect(draftLessons).toContain(lesson);
    expect(authoredLessons).not.toContain(lesson);
    expect(availableLessons.some((entry) => entry.id === lesson.id)).toBe(false);
    expect(getAuthoredLesson("broker-and-account", "platform-types")).toBeUndefined();
    expect(() => validateMove(lesson.id, 0, 1, { answer: "service" })).toThrow(/unavailable/);
    expect(getLessonPlacement(lesson.id)).toMatchObject({ displayCode: "2.1.1", prerequisites: ["foundations-funds"], required: "required", skills: ["platform-types"] });
    expect(lessonReward(lesson.id)).toEqual({ practiceCapitalMinor: 200000n, rewardPolicyVersion: 4 });
    expect(lesson.factContext?.kind).toBe("regulatory");
    expect(() => checkPublishedFacts(factRegistry, [lesson], [{ id: lesson.id, status: "available" }], today, [])).toThrow(/no expert review approval/);
  });

  it("covers every block once with one server-checked question per step and an ungraded ending", () => {
    expect(steps.flatMap((step) => step.blocks.map((entry) => entry.id)).sort()).toEqual(lesson.blocks.map((entry) => entry.id).sort());
    expect(new Set(lesson.blocks.map((entry) => entry.id)).size).toBe(lesson.blocks.length);
    for (let index = 0; index < steps.length - 1; index++) {
      const questions = steps[index].blocks.filter(isQuestion);
      expect(questions.length).toBeLessThanOrEqual(1);
      if (questions[0]) {
        expect(steps[index].blocks.at(-1)).toBe(questions[0]);
        expect(() => validateStepMove(steps, index, index + 1, wrongAnswers(questions[0]))).toThrow(/correctly/);
        expect(() => validateStepMove(steps, index, index + 1, correctAnswers(questions[0]))).not.toThrow();
      } else expect(() => validateStepMove(steps, index, index + 1)).not.toThrow();
    }
    expect(steps.at(-1)!.blocks.some(isQuestion)).toBe(false);
  });

  it("sorts eight fictional offers, two per platform type, and rejects a swapped pair", () => {
    const sorting = block(lesson, "sorting", "categorizeQuestion");
    expect(sorting.items).toHaveLength(8);
    for (const category of sorting.categories) expect(sorting.items.filter((item) => item.categoryId === category.id)).toHaveLength(2);
    // Invented letters avoid collisions with real broker brands.
    for (const item of sorting.items) expect(item.label).toMatch(/^Nabídka [A-H] · /);
    const swapped = { ...correctAnswers(sorting), "offer-b": "broker", "offer-a": "managed" };
    expect(evaluateQuestion(sorting, swapped)).toBe(false);
  });

  it("teaches who decides and matches the persona to managed portfolios", () => {
    expect(block(lesson, "decides", "multipleChoiceQuestion").correctOptionId).toBe("managed");
    expect(block(lesson, "persona", "multipleChoiceQuestion").correctOptionId).toBe("managed");
    expect(block(lesson, "persona", "multipleChoiceQuestion").correctExplanation).toMatch(/celkové roční náklady/);
    expect(block(lesson, "passport-check", "multipleChoiceQuestion").correctOptionId).toBe("home");
    expect(block(lesson, "recall", "multipleChoiceQuestion").correctOptionId).toBe("decision");
  });

  it("recomputes the fee comparison: a percentage markup wins monthly, a fixed fee wins one-off", () => {
    const markup = 0.005, fixedFee = 30, monthly = 3000, oneOff = 300000;
    const intro = block(lesson, "plan-compare", "workedExample");
    expect(intro.introduction).toContain("0,5\u00a0%"); // Non-breaking: the unit never wraps away from its number.
    expect(intro.introduction).toContain(`${fixedFee}\u00a0Kč za pokyn`);
    expect(intro.steps.map((step) => step.value)).toEqual([`${monthly * markup}\u00a0Kč za nákup`, `${fixedFee}\u00a0Kč za nákup`, "Nabídka A"]);
    expect(monthly * markup).toBeLessThan(fixedFee);
    const question = block(lesson, "one-off", "numericQuestion");
    expect(question.answer).toBe(oneOff * markup);
    expect(question.answer).toBeGreaterThan(fixedFee);
    expect(question.prompt).toContain("300\u00a0000\u00a0Kč");
    expect(evaluateQuestion(question, { answer: String(oneOff * markup) })).toBe(true);
    expect(evaluateQuestion(question, { answer: String(monthly * markup) })).toBe(false);
  });

  it("shows the dated ČNB register fact without inventing a review", () => {
    const prepared = prepareLessonFacts(lesson, factRegistry, { today, published: false });
    expect(prepared.facts.map((fact) => fact.key)).toEqual(["cnb.jerrs"]);
    expect(JSON.stringify(prepared.lesson)).not.toContain("{{");
  });
});
