import { describe, expect, it } from "vitest";
import { foundationsContent } from "./content";
import { block } from "../lesson-test-support";
import { lessonSteps, validateCompletion, validateMove } from "@/features/progress/transition";
import originalLessons from "../published-lessons-v1.json";

const lesson = foundationsContent.find((lesson) => lesson.id === "foundations-etfs-indexes")!;

describe("ETFs and indexes for a European investor (#157)", () => {
  it("adds one ungraded step before the unchanged final step", () => {
    const original = originalLessons.find((lesson) => lesson.id === "foundations-etfs-indexes")!;
    const steps = lessonSteps(lesson.id);
    const oldFinal = original.steps.length - 1;
    expect(lesson).toMatchObject({ slug: original.slug, moduleSlug: original.moduleSlug });
    expect(steps.map((step) => step.blocks.map((block) => block.id))).toEqual([...original.steps.slice(0, oldFinal).map((step) => step.blocks), ["ucits"], original.steps[oldFinal].blocks]);
    // A learner saved at the old final index now reads the card, then can move on and complete.
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: oldFinal })).toThrow();
    expect(() => validateMove(lesson.id, oldFinal, oldFinal + 1, {})).not.toThrow();
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: oldFinal + 1 })).not.toThrow();
  });

  it("explains UCITS and KID without claiming US ETFs can never be bought", () => {
    const card = block(lesson, "ucits", "conceptCallout").content;
    expect(card).toContain("Retailoví investoři v EU americká ETF běžně nekoupí, protože k nim chybí KID");
    expect(card).toContain("Stejný index přitom může sledovat více ETF s různými náklady");
    expect(card).toContain("plánovaná lekce 2.3.1");
    expect(`${card} ${block(lesson, "summary", "lessonSummary").content}`).not.toMatch(/nelze koupit|nemůžeš koupit|nikdy/i);
  });
});
