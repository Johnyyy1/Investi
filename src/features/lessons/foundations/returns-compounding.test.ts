import { describe, expect, it } from "vitest";
import { foundationsContent } from "./content";
import { block } from "../lesson-test-support";
import originalLessons from "../published-lessons-v1.json";

const lesson = foundationsContent.find((lesson) => lesson.id === "foundations-risk-reward")!;

describe("returns and compounding in Foundations (#160)", () => {
  it("keeps the published identity and steps", () => {
    const original = originalLessons.find((lesson) => lesson.id === "foundations-risk-reward")!;
    expect(lesson).toMatchObject({ slug: "risk-vs-reward", moduleSlug: original.moduleSlug });
    expect(lesson.blocks.map((block) => block.id)).toEqual(original.steps.flatMap((step) => step.blocks));
  });

  it("labels every worked number as a model example", () => {
    for (const id of ["opening", "positive-return", "mastery-negative", "mastery-compound"]) {
      const question = lesson.blocks.find((item) => item.id === id);
      expect(question && "prompt" in question ? question.prompt : "").toMatch(/^Modelový příklad: /);
    }
    expect(block(lesson, "compounding", "interactiveFigure").title).toMatch(/^Modelový příklad · /);
  });

  it("states the returns are before costs, taxes and inflation", () => {
    expect(block(lesson, "summary", "lessonSummary").content).toContain("Čísla jsou před poplatky, daněmi a inflací; reálný výnos po nákladech spočítáš v lekci 3.1.5.");
  });
});
