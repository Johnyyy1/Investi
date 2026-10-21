import { describe, expect, it } from "vitest";
import { foundationsContent, foundationsSteps } from "./content";
import { foundationsLessons } from "./manifest";
import { getGuidedSteps } from "../steps";

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
