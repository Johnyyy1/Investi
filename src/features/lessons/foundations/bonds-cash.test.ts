import { describe, expect, it } from "vitest";
import { foundationsContent } from "./content";
import { block } from "../lesson-test-support";
import originalLessons from "../published-lessons-v1.json";

const lesson = foundationsContent.find((lesson) => lesson.id === "foundations-bonds-cash")!;

describe("cash and bonds for a Czech investor (#158)", () => {
  it("keeps the published identity and steps", () => {
    const original = originalLessons.find((lesson) => lesson.id === "foundations-bonds-cash")!;
    expect(lesson).toMatchObject({ slug: "bonds-and-cash", moduleSlug: original.moduleSlug });
    expect(lesson.blocks.map((block) => block.id)).toEqual(original.steps.flatMap((step) => step.blocks));
  });

  it("derives the worked coupon from principal and rate", () => {
    const example = block(lesson, "bond-terms", "workedExample");
    expect(example.title).toMatch(/^Modelový příklad · /);
    const [principal, rate] = [1000, 0.05];
    expect(example.steps.find((step) => step.label === "Roční kupón")?.value).toBe(`${principal * rate} Kč`);
    expect(block(lesson, "mastery-rates", "multipleChoiceQuestion").prompt).toMatch(/^Modelový příklad: /);
  });

  it("mentions Czech retail state bonds without naming a live offer or calling them insured deposits", () => {
    const text = block(lesson, "bond", "paragraph").content;
    expect(text).toContain("Dluhopisy vydává i Česká republika");
    expect(text).toContain("aktuální nabídku ověř na webu Ministerstva financí (MF ČR)");
    expect(text).toContain("není vkladem pojištěným");
    expect(text).not.toMatch(/Dluhopis Republiky|Flexi|\d+ ?%/);
  });

  it("distinguishes a bond fund from a bond and links the planned lessons", () => {
    const text = block(lesson, "summary", "lessonSummary").content;
    expect(text).toContain("Dluhopisový fond nemá jedno datum splatnosti");
    expect(text).toMatch(/plánovaná lekce 2\.3\.5.*plánovaná lekce 3\.4\.4/);
  });
});
