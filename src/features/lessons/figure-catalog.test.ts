import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authoredLessons } from "./registry";
import { lessonFigureCatalog } from "./figure-catalog";

describe("lesson figure authoring contract", () => {
  it("registers every authored figure and its accountable owner/model", () => {
    for (const lesson of authoredLessons) for (const block of lesson.blocks) if (block.type === "interactiveFigure") {
      expect(lessonFigureCatalog[block.figure], `${lesson.id}/${block.figure}`).toBeDefined();
    }
    for (const entry of Object.values(lessonFigureCatalog)) {
      expect(entry.owner).toBe("curriculum");
      expect(existsSync(entry.model)).toBe(true);
    }
  });
  it("has a lazy renderer for every catalog ID, without eager explorer imports", () => {
    const loader = readFileSync("src/components/lesson/lazy-blocks.tsx", "utf8");
    const rendererIds = [...loader.matchAll(/^  "([a-z-]+)": \{ preload:/gm)].map((match) => match[1]);
    expect(rendererIds.sort()).toEqual(Object.keys(lessonFigureCatalog).sort());
    expect(loader).not.toMatch(/from ["'][^"']*(?:explorers|calculator|scenario|portfolio-builder)["']/);
    expect(loader).toContain('lessonFigureCatalog[figure].data === "model"');
  });
  it("leaves provider-backed labels to the selected snapshot rather than declaring them historical", () => {
    for (const [id, entry] of Object.entries(lessonFigureCatalog)) {
      expect(entry.data).toBe(id.startsWith("historical-") ? "provider" : "model");
    }
  });
});
