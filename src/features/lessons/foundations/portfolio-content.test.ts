import { describe, expect, it } from "vitest";
import { foundationsContent, foundationsSteps } from "./content";
import { foundationsLessons } from "./manifest";
import { getGuidedSteps } from "../steps";
import { validateCompletion, validateMove } from "@/features/progress/transition";

describe("Foundations learning experience integrity", () => {
  it("keeps the seven stable published lesson IDs and the target sequence", () => {
    expect(foundationsContent.map((lesson) => lesson.id)).toEqual(foundationsLessons.filter((lesson) => lesson.status === "available").map((lesson) => lesson.id));
    expect(foundationsContent.map((lesson) => lesson.title)).toEqual([
      "Spoření vs. investování",
      "Akcie a vlastnictví firmy",
      "ETF a indexy",
      "Hotovost a dluhopisy",
      "Jak funguje trh: bid, ask a spread",
      "Výnos a složené zhodnocení",
      "Portfolio, váhy a diverzifikace",
    ]);
  });

  it("keeps the first lesson to one concept, one question and a summary", () => {
    const lesson = foundationsContent[0];
    const steps = getGuidedSteps(lesson);
    expect(lesson.id).toBe("foundations-why-invest");
    expect(steps).toHaveLength(3);
    expect(steps.flatMap((step) => step.blocks)).toEqual(lesson.blocks);
    expect(lesson.blocks.filter((block) => block.type === "multipleChoiceQuestion")).toHaveLength(1);
    expect(lesson.blocks.filter((block) => block.type === "lessonSummary")).toHaveLength(1);
    expect(foundationsSteps[lesson.id]).toHaveLength(3);
    expect(lesson).toMatchObject({ moduleSlug: "investing-foundations", slug: "why-invest", estimatedMinutes: 5 });
    expect(steps.map((step) => step.blocks.map((block) => block.id))).toEqual([
      ["saving", "investing", "inflation"], ["envelope", "envelope-question"], ["summary"],
    ]);
    expect(lesson.blocks.find((block) => block.id === "envelope")).toMatchObject({ content: expect.stringMatching(/^Modelový příklad:.*10 000 Kč/) });
    expect(lesson.blocks.find((block) => block.id === "summary")).toMatchObject({ content: expect.stringContaining("Než začneš investovat, měj rezervu a žádný drahý dluh.") });
  });

  it("preserves the envelope answer IDs and server-validated continuation", () => {
    const id = "foundations-why-invest";
    expect(foundationsContent[0].blocks.find((block) => block.id === "envelope-question")).toMatchObject({
      correctOptionId: "1", options: [{ id: "0" }, { id: "1" }, { id: "2" }],
    });
    expect(() => validateMove(id, 0, 1)).not.toThrow();
    expect(() => validateMove(id, 1, 2)).toThrow(/correctly/);
    for (const answer of ["0", "2"]) {
      expect(() => validateMove(id, 1, 2, { answer })).toThrow(/correctly/);
    }
    expect(() => validateMove(id, 1, 2, { answer: "1" })).not.toThrow();
    expect(() => validateCompletion(id, { status: "in_progress", lastPosition: 1 })).toThrow();
    expect(() => validateCompletion(id, { status: "in_progress", lastPosition: 2 })).not.toThrow();
  });

  it.each(foundationsContent.slice(1).map((lesson) => [lesson.id, lesson] as const))("gives %s two mastery checks, a Lab bridge, and a summary", (id, lesson) => {
    const steps = getGuidedSteps(lesson);
    expect(steps.flatMap((step) => step.blocks)).toEqual(lesson.blocks);
    expect(steps.filter((step) => step.kind === "mastery")).toHaveLength(2);
    expect(lesson.blocks.filter((block) => block.type === "labBridge")).toHaveLength(1);
    expect(lesson.blocks.filter((block) => block.type === "lessonSummary")).toHaveLength(1);
    expect(foundationsSteps[id]).toHaveLength(steps.length);
  });

  it("teaches the required portfolio math and concentration safeguards", () => {
    const lesson = foundationsContent.at(-1)!;
    expect(lesson.blocks.find((block) => block.id === "weight-formula")).toMatchObject({ type: "formula", latex: "w_i = \\frac{V_i}{V_p}" });
    expect(lesson.blocks.find((block) => block.id === "weight-practice")).toMatchObject({ type: "numericQuestion", answer: 40 });
    expect(lesson.blocks.find((block) => block.id === "contribution-practice")).toMatchObject({ type: "numericQuestion", answer: 2 });
    const copy = lesson.blocks.map((block) => JSON.stringify(block)).join(" ");
    expect(copy).toContain("stále záleží na vahách a společných rizicích");
    expect(copy).toContain("Hotovost a aktuální hodnota všech pozic");
  });
});
