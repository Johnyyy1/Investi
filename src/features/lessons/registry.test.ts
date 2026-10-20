import { describe, expect, it } from "vitest";
import { getAuthoredLesson } from "./registry";
import { returnsLessons } from "./returns/manifest";

describe("authored lesson registry", () => {
  it("registers the first Returns lesson against the published manifest", () => {
    const lesson = getAuthoredLesson("returns", "what-is-a-return");
    expect(lesson).toMatchObject({ id: returnsLessons[0].id, title: "Co je výnos?" });
  });

  it("registers all six published Returns lessons, the checkpoint last", () => {
    expect(getAuthoredLesson("returns", "simple-returns")).toMatchObject({ title: "Jednoduché výnosy" });
    expect(getAuthoredLesson("returns", "compounding-and-cumulative-returns")).toMatchObject({ title: "Složené a kumulativní výnosy" });
    expect(getAuthoredLesson("returns", "comparing-investments")).toMatchObject({ id: "returns-comparing", position: 4, estimatedMinutes: 14 });
    expect(getAuthoredLesson("returns", "returns-checkpoint")).toMatchObject({ id: "returns-checkpoint", position: 6, estimatedMinutes: 10 });
    expect(getAuthoredLesson("returns", "log-returns")).toMatchObject({ id: "returns-log-returns", position: 5, estimatedMinutes: 10 });
  });
});

describe("published curriculum integrity", () => {
  it("has exactly one authored lesson per available manifest entry", async () => {
    const { availableLessons, curriculumLessons } = await import("../learning/catalog");
    const { authoredLessons } = await import("./registry");
    expect(new Set(authoredLessons.map((lesson) => lesson.id)).size).toBe(authoredLessons.length);
    expect(authoredLessons.map((lesson) => lesson.id).sort()).toEqual(availableLessons.map((lesson) => lesson.id).sort());
    for (const definition of availableLessons) {
      expect(getAuthoredLesson(definition.moduleSlug, definition.slug)).toMatchObject({ id: definition.id, title: definition.title, estimatedMinutes: definition.estimatedMinutes });
    }
    for (const definition of curriculumLessons.filter((lesson) => lesson.status === "planned")) {
      expect(getAuthoredLesson(definition.moduleSlug, definition.slug)).toBeUndefined();
    }
  });
});
