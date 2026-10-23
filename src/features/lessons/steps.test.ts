import { describe, expect, it } from "vitest";
import { authoredLessons, emergencyFundLesson } from "./registry";
import { isQuestion } from "./question-evaluation";
import { availableLessons, isFocusedLesson } from "../learning/catalog";
import { getGuidedSteps, getStepDefinitions, moduleSteps } from "./steps";

describe("shared guided lessons", () => {
  it.each(authoredLessons)("preserves every authored block in $title", (lesson) => {
    const steps = getGuidedSteps(lesson);
    // The first Foundations lesson is the deliberately short mini-lesson that also opens onboarding.
    expect(steps.length).toBeGreaterThanOrEqual(lesson.id === "foundations-why-invest" ? 3 : 6);
    expect(steps.length).toBeLessThanOrEqual(12);
    expect(new Set(lesson.blocks.map((block) => block.id)).size).toBe(lesson.blocks.length);
    expect(steps.flatMap((step) => step.blocks)).toEqual(lesson.blocks);
    for (const step of steps) {
      const questions = step.blocks.filter(isQuestion);
      expect(questions.length).toBeLessThanOrEqual(1);
      if (questions.length) expect(step.blocks.at(-1)).toBe(questions[0]);
    }
    expect(steps.at(-1)?.blocks.some(isQuestion)).toBe(false);
  });
  it("only removes navigation for implemented lessons", () => {
    for (const lesson of authoredLessons) expect(isFocusedLesson(`/learn/${lesson.moduleSlug}/${lesson.slug}`)).toBe(true);
    expect(isFocusedLesson("/learn/checkpoint/1.1")).toBe(true);
    for (const route of ["/dashboard", "/learn", "/learn/returns", "/progress", "/learn/investing-foundations/foundations-checkpoint"]) expect(isFocusedLesson(route)).toBe(false);
    expect(() => getStepDefinitions("returns-log")).toThrow();
    expect(() => getStepDefinitions("constructor")).toThrow();
  });
  it("defines steps for the published lessons and the explicitly registered editorial drafts, each in one module", () => {
    const ids = moduleSteps.flatMap((steps) => Object.keys(steps));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual([...availableLessons.map((lesson) => lesson.id), emergencyFundLesson.id, "before-investing-scams"].sort());
  });
});
