import { describe, expect, it } from "vitest";
import { foundationsContent } from "./content";
import { block } from "../lesson-test-support";
import { evaluateQuestion } from "../question-evaluation";
import { lessonSteps, validateCompletion, validateMove } from "@/features/progress/transition";
import { skillItems } from "@/features/learning/curriculum";
import { lessonLink } from "@/features/learning/catalog";
import { factRegistry } from "@/features/facts/registry";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import originalLessons from "../published-lessons-v1.json";

const lesson = foundationsContent.find((lesson) => lesson.id === "foundations-markets")!;

describe("market quotes and their costs (#159)", () => {
  it("recomputes the spread and accepts Czech decimal notation", () => {
    const bid = 99.8, ask = 100.2;
    const question = block(lesson, "spread-practice", "numericQuestion");
    expect(question.answer).toBeCloseTo(ask - bid, 10);
    expect(question.tolerance).toBe(0.000001);
    expect(question.unit).toBe("Kč");
    expect(evaluateQuestion(question, { answer: (ask - bid).toFixed(2).replace(".", ",") })).toBe(true);
    expect(evaluateQuestion(question, { answer: "0,20" })).toBe(false);
    expect(evaluateQuestion(question, { answer: "" })).toBeUndefined();
    const copy = question.correctExplanation;
    const midpoint = (bid + ask) / 2;
    const czk = (value: number) => value.toFixed(2).replace(".", ",");
    expect(copy).toContain(`${czk(midpoint)} Kč`);
    expect(copy).toContain(`${czk(ask - midpoint)} Kč`);
    expect(copy).toContain(`${czk(midpoint - bid)} Kč`);
    expect(copy).toContain(`celý spread ${czk(ask - bid)} Kč`);
    expect(copy).toContain("Při nezměněné kotaci");
  });

  it("preserves every saved cursor, question identity and completion boundary", () => {
    const original = originalLessons.find((lesson) => lesson.id === "foundations-markets")!;
    const steps = lessonSteps(lesson.id);
    expect(lesson).toMatchObject({ moduleSlug: original.moduleSlug, slug: original.slug });
    expect(steps.map((step) => step.blocks.map((block) => block.id))).toEqual(original.steps.map((step) => step.blocks));
    expect(() => validateMove(lesson.id, 3, 4, { answer: "0,20" })).toThrow();
    expect(() => validateMove(lesson.id, 3, 4, { answer: "0,40" })).not.toThrow();
    for (const status of ["in_progress", "completed"] as const) {
      expect(() => validateCompletion(lesson.id, { status, lastPosition: steps.length - 1 })).not.toThrow();
    }
  });

  it("resolves dated Xetra hours and flags an overdue review", () => {
    const current = prepareLessonFacts(lesson, factRegistry, { today: "2026-10-24", published: true });
    const copy = block(current.lesson, "market-order", "conceptCallout").content;
    expect(copy).toContain("9:00 do 17:30");
    expect(copy).toContain("rozšířené obchodování");
    expect(copy).toContain("může být");
    expect(copy).not.toContain("{{");
    expect(current.notice).toEqual({ verifiedAt: "2026-10-24", staleFacts: [] });
    expect(current.facts[0].sources[0].url).toContain("deutsche-boerse.com");
    expect(prepareLessonFacts(lesson, factRegistry, { today: "2027-04-01", published: true }).notice?.staleFacts).toHaveLength(1);
  });

  it("includes the existing immediate-buy question in mixed review", () => {
    expect(skillItems).toContainEqual({ id: "foundations-markets/buy-side", lessonId: lesson.id, blockId: "buy-side", skillId: "bid-ask-spread" });
    const question = block(lesson, "buy-side", "multipleChoiceQuestion");
    expect(question.options.find((option) => option.id === question.correctOptionId)?.label).toBe("Ask · 100,20 Kč");
  });

  it("keeps both unpublished follow-ups out of the learner's links", () => {
    const bridge = block(lesson, "lab-bridge", "labBridge");
    expect(bridge.lessonLinks?.map((link) => link.lessonId)).toEqual(["costs-spread-and-fees", "first-plan-first-purchase"]);
    for (const link of bridge.lessonLinks!) expect(lessonLink(link.lessonId)).toBeNull();
    expect(bridge.content).toContain("rozpad nákladů");
  });
});
