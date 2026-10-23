import { describe, expect, it } from "vitest";
import { availableLessons } from "@/features/learning/catalog";
import { getLessonPlacement, skillItems } from "@/features/learning/curriculum";
import { isQuestion } from "@/features/lessons/question-evaluation";
import { lessonSteps } from "@/features/progress/transition";
import { checkpointContext, checkpointModules, mixedCheckpoint, moduleSkills, REVIEW_DELAY_MS, skillLevel, type SkillAttempt } from "./domain";

const start = new Date("2026-10-01T10:00:00Z");
const at = (days: number) => new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
const attempt = (context: SkillAttempt["context"], correct: boolean, days = 0): SkillAttempt => ({ context, correct, attemptedAt: at(days) });

describe("skill level", () => {
  it("climbs Zkoušeno → Známé → Zvládnuté → Ovládnuté only with the matching evidence", () => {
    expect(skillLevel([])).toBe(0);
    expect(skillLevel([attempt("lesson", false)])).toBe(1);
    expect(skillLevel([attempt("lesson", false), attempt("lesson", true)])).toBe(2);
    expect(skillLevel([attempt("lesson", true), attempt("checkpoint", true, 1)])).toBe(3);
    // A review sooner than the delay does not prove retention.
    expect(skillLevel([attempt("checkpoint", true), attempt("review", true, 6)])).toBe(3);
    expect(skillLevel([attempt("checkpoint", true), attempt("review", true, 7)])).toBe(4);
    expect(REVIEW_DELAY_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("orders attempts by time, not by input order", () => {
    expect(skillLevel([attempt("review", true, 8), attempt("checkpoint", true, 0)])).toBe(4);
  });

  it("lowers one level after a wrong review and restarts the delay", () => {
    const mastered = [attempt("checkpoint", true), attempt("review", true, 7)];
    expect(skillLevel([...mastered, attempt("review", false, 9)])).toBe(3);
    expect(skillLevel([...mastered, attempt("review", false, 9), attempt("review", true, 10)])).toBe(3);
    expect(skillLevel([...mastered, attempt("review", false, 9), attempt("review", true, 16)])).toBe(4);
    expect(skillLevel([attempt("checkpoint", true), attempt("review", false, 8)])).toBe(2);
    expect(skillLevel([attempt("lesson", false), attempt("review", false, 1), attempt("review", false, 2)])).toBe(1);
  });

  it("does not lower the state for wrong lesson or checkpoint answers", () => {
    expect(skillLevel([attempt("checkpoint", true), attempt("lesson", false, 1), attempt("checkpoint", false, 2)])).toBe(3);
  });

  it("counts a completed lesson as Známé without any attempts", () => {
    expect(skillLevel([], true)).toBe(2);
    expect(skillLevel([attempt("checkpoint", true)], true)).toBe(3);
  });

  it("records a checkpoint answer on a mastered skill as a review", () => {
    expect(checkpointContext(2)).toBe("checkpoint");
    expect(checkpointContext(3)).toBe("review");
    expect(checkpointContext(4)).toBe("review");
  });
});

describe("item bank and mixed checkpoint", () => {
  it("points every item at a graded question of a published lesson that trains the skill", () => {
    expect(new Set(skillItems.map((item) => item.id)).size).toBe(skillItems.length);
    for (const item of skillItems) {
      expect(availableLessons.some((lesson) => lesson.id === item.lessonId), item.id).toBe(true);
      const block = lessonSteps(item.lessonId).flatMap((step) => step.blocks).find((entry) => entry.id === item.blockId);
      expect(block && isQuestion(block), item.id).toBe(true);
      expect(getLessonPlacement(item.lessonId)?.skills, item.id).toContain(item.skillId);
    }
  });

  it("offers the Foundations checkpoint", () => {
    expect(checkpointModules.map((entry) => entry.code)).toEqual(["1.1"]);
  });

  it("draws one item per skill from at least two lessons, interleaved, the same for the same seed", () => {
    for (const seed of ["a", "b", "user-1:2026-10-23", "user-2:2026-10-24"]) {
      const items = mixedCheckpoint("1.1", seed);
      expect(items.map((item) => item.skillId).sort()).toEqual(moduleSkills("1.1").sort());
      expect(new Set(items.map((item) => item.lessonId)).size).toBeGreaterThanOrEqual(2);
      for (let index = 1; index < items.length; index++) expect(items[index].lessonId, seed).not.toBe(items[index - 1].lessonId);
      expect(mixedCheckpoint("1.1", seed)).toEqual(items);
    }
    const draws = new Set(Array.from({ length: 20 }, (_, index) => mixedCheckpoint("1.1", `seed-${index}`).map((item) => item.id).join()));
    expect(draws.size).toBeGreaterThan(1);
  });
});
