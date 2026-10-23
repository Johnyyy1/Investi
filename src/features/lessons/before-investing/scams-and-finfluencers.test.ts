import { describe, expect, it } from "vitest";
import { scamsAndFinfluencersLesson as lesson } from "./scams-and-finfluencers";
import { getGuidedSteps } from "../steps";
import { correctAnswers, wrongAnswers } from "../answer-keys";
import { evaluateQuestion, isQuestion, serializeSelection } from "../question-evaluation";
import { validateMove, validateStepMove } from "@/features/progress/transition";
import { getLessonPlacement } from "@/features/learning/curriculum";
import { availableLessons, curriculumLessons } from "@/features/learning/catalog";
import { getAuthoredLesson } from "../registry";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import { checkPublishedFacts } from "@/features/facts/check-published";
import { factRegistry } from "@/features/facts/registry";

const today = "2026-10-23";
const steps = getGuidedSteps(lesson);

describe("scams and finfluencers 0.1.6", () => {
  it("reserves its stable route with no prerequisites and keeps unreviewed content unpublished", () => {
    expect(curriculumLessons.find((item) => item.id === lesson.id)).toMatchObject({ moduleId: "module-before-investing", slug: "scams-and-finfluencers", status: "planned" });
    expect(getLessonPlacement(lesson.id)).toMatchObject({ displayCode: "0.1.6", prerequisites: [], skills: ["scam-prevention"], required: "recommended" });
    expect(availableLessons.some((item) => item.id === lesson.id)).toBe(false);
    expect(getAuthoredLesson(lesson.moduleSlug, lesson.slug)).toBeUndefined();
    expect(() => validateMove(lesson.id, 0, 1)).toThrow(/unavailable/);
    expect(() => checkPublishedFacts(factRegistry, [lesson], [{ id: lesson.id, status: "available" }], today, [])).toThrow(/no expert review approval/);
  });

  it("covers every block once with one server-checked question per step and an ungraded ending", () => {
    expect(steps.flatMap((step) => step.blocks.map((block) => block.id)).sort()).toEqual(lesson.blocks.map((block) => block.id).sort());
    expect(new Set(lesson.blocks.map((block) => block.id)).size).toBe(lesson.blocks.length);
    for (let index = 0; index < steps.length - 1; index++) {
      const questions = steps[index].blocks.filter(isQuestion);
      expect(questions.length).toBeLessThanOrEqual(1);
      const question = questions[0];
      if (question) {
        expect(() => validateStepMove(steps, index, index + 1, wrongAnswers(question))).toThrow(/correctly/);
        expect(() => validateStepMove(steps, index, index + 1, correctAnswers(question))).not.toThrow();
      } else expect(() => validateStepMove(steps, index, index + 1)).not.toThrow();
    }
    expect(steps.at(-1)!.blocks.some(isQuestion)).toBe(false);
    expect(lesson.blocks.filter(isQuestion).map((block) => block.id)).toEqual(["red-flags", "offer-a", "offer-b", "offer-c", "influencer-check", "first-action", "recall"]);
  });

  it("requires all four warning signs and rejects the neutral row and missing signs", () => {
    const question = lesson.blocks.find((block) => block.id === "red-flags");
    if (question?.type !== "documentTap") throw new Error("Missing warning-sign exercise");
    expect(evaluateQuestion(question, correctAnswers(question))).toBe(true);
    for (const id of question.correctRowIds) {
      expect(evaluateQuestion(question, { selected: serializeSelection(question.correctRowIds.filter((item) => item !== id)) })).toBe(false);
    }
    expect(evaluateQuestion(question, { selected: serializeSelection([...question.correctRowIds, "neutral"]) })).toBe(false);
  });

  it("teaches distinct decisions without classifying a licence as a guaranteed investment", () => {
    for (const [id, answer] of Object.entries({ "offer-a": "verified", "offer-b": "stop", "offer-c": "verify", "influencer-check": "conflict", "first-action": "bank", recall: "register" })) {
      const block = lesson.blocks.find((block) => block.id === id);
      expect(block).toMatchObject({ type: "multipleChoiceQuestion", correctOptionId: answer });
      if (!block || !isQuestion(block)) throw new Error(`Missing ${id}`);
      expect(evaluateQuestion(block, { answer })).toBe(true);
    }
  });

  it("resolves the dated JERRS fact and exposes stale information without inventing a review", () => {
    const prepared = prepareLessonFacts(lesson, factRegistry, { today, published: false });
    expect(prepared.facts.map((fact) => fact.key)).toEqual(["cnb.jerrs"]);
    expect(prepared.notice?.verifiedAt).toBe("2026-10-21");
    expect(JSON.stringify(prepared.lesson)).not.toContain("{{");
    const stale = prepareLessonFacts(lesson, factRegistry.map((fact) => fact.key === "cnb.jerrs" ? { ...fact, nextReviewAt: "2026-08-01" } : fact), { today, published: false });
    expect(stale.notice?.staleFacts).toContain("Ověření subjektu u ČNB");
    expect(lesson.factContext?.kind).toBe("regulatory");
  });
});
