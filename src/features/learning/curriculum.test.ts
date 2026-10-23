import { describe, expect, it } from "vitest";
import { availableLessons, curriculumLessons } from "./catalog";
import { curriculumLevels, displayModules, getDisplayModulePlacements, getLessonPlacement, lessonPlacements, milestones, skills } from "./curriculum";

const lessonIndex = (id: string) => curriculumLessons.findIndex((lesson) => lesson.id === id);

/** The lesson IDs on one prerequisite cycle, or null. */
function findPrerequisiteCycle(graph: ReadonlyMap<string, readonly string[]>) {
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string, path: string[]): string[] | null => {
    if (state.get(id) === "done") return null;
    if (state.get(id) === "visiting") return [...path.slice(path.indexOf(id)), id];
    state.set(id, "visiting");
    for (const prerequisite of graph.get(id) ?? []) {
      const cycle = visit(prerequisite, [...path, id]);
      if (cycle) return cycle;
    }
    state.set(id, "done");
    return null;
  };
  for (const id of graph.keys()) {
    const cycle = visit(id, []);
    if (cycle) return cycle;
  }
  return null;
}

describe("curriculum registry", () => {
  it("has nine levels and 25 display modules with unique codes and display order", () => {
    expect(curriculumLevels.map((level) => level.code)).toEqual(["0", "1", "2", "B", "3", "4", "5", "6", "V"]);
    expect(curriculumLevels.map((level) => level.milestone)).toEqual(["A", "A", "A", "B", "B", "C", "C", "D", null]);
    expect(Object.keys(milestones)).toEqual(["A", "B", "C", "D"]);
    expect(displayModules).toHaveLength(25);
    expect(new Set(displayModules.map((entry) => entry.code)).size).toBe(25);
    expect(displayModules.map((entry) => entry.order)).toEqual(displayModules.map((_, index) => index + 1));
    for (const level of curriculumLevels) {
      const modules = displayModules.filter((entry) => entry.levelId === level.id);
      expect(modules.length, level.id).toBeGreaterThan(0);
      for (const entry of modules) expect(entry.code.split(".")[0]).toBe(level.code);
    }
    // Levels appear in display order, so a level's modules are contiguous.
    expect(displayModules.map((entry) => entry.levelId).filter((id, index, all) => id !== all[index - 1])).toEqual(curriculumLevels.map((level) => level.id));
  });

  it("puts every optional-track module on the analyst or quant track", () => {
    for (const entry of displayModules) {
      if (entry.required === "optional-track") expect(["analyst", "quant"], entry.code).toContain(entry.track);
      else if (entry.required === "optional") expect("track" in entry, entry.code).toBe(false);
      else expect(entry.track, entry.code).toBe("investor");
    }
  });

  it("places every published lesson exactly once and only lessons from the manifests", () => {
    expect(lessonPlacements.filter((placement) => availableLessons.some((lesson) => lesson.id === placement.lessonId)).map((placement) => placement.lessonId).sort()).toEqual(availableLessons.map((lesson) => lesson.id).sort());
    expect(lessonPlacements).toHaveLength(31);
    expect(getLessonPlacement("before-investing-budget")).toMatchObject({ displayCode: "0.1.1", required: "recommended", prerequisites: [] });
  });

  it("derives a unique display code from the display module and order", () => {
    for (const placement of lessonPlacements) {
      expect(displayModules.some((entry) => entry.code === placement.displayModule), placement.lessonId).toBe(true);
      expect(placement.displayCode).toBe(`${placement.displayModule}.${placement.order}`);
    }
    expect(new Set(lessonPlacements.map((placement) => placement.displayCode)).size).toBe(lessonPlacements.length);
  });

  it("moves existing lessons by metadata only", () => {
    expect(getLessonPlacement("foundations-why-invest")?.displayCode).toBe("1.1.1");
    expect(getLessonPlacement("foundations-portfolio")?.displayCode).toBe("1.1.7");
    expect(getLessonPlacement("returns-checkpoint")?.displayCode).toBe("3.1.8");
    expect(getLessonPlacement("returns-log-returns")).toMatchObject({ displayCode: "6.1.1", required: "optional-track" });
    expect(getLessonPlacement("correlation-not-causation")?.displayCode).toBe("B.1.8");
    expect(getLessonPlacement("correlation-real-data")).toMatchObject({ displayCode: "6.2.5", required: "optional-track" });
    expect(getLessonPlacement("diversification-scenario")?.displayCode).toBe("3.3.7");
    expect(getLessonPlacement("foundations-checkpoint")).toBeUndefined();
  });

  it("lets one display module combine lessons from two storage modules", () => {
    const lessons = getDisplayModulePlacements("3.3").map((placement) => curriculumLessons.find((lesson) => lesson.id === placement.lessonId)!);
    expect(lessons.map((lesson) => lesson.id)).toEqual(["correlation-what-is-correlation", "correlation-in-crises", "diversification-concentration", "diversification-sectors-countries", "diversification-etf-look-through", "diversification-correlation-risk", "diversification-scenario"]);
    expect(new Set(lessons.map((lesson) => lesson.moduleSlug))).toEqual(new Set(["correlation", "diversification"]));
  });

  it("only requires distinct, published lessons that come earlier in the storage order", () => {
    for (const placement of lessonPlacements) {
      expect(new Set(placement.prerequisites).size, placement.lessonId).toBe(placement.prerequisites.length);
      for (const prerequisite of placement.prerequisites) {
        expect(availableLessons.some((lesson) => lesson.id === prerequisite), `${placement.lessonId} → ${prerequisite}`).toBe(true);
        // Keeps the recommended sequence: the first unfinished lesson always has its prerequisites done.
        expect(lessonIndex(prerequisite), `${placement.lessonId} → ${prerequisite}`).toBeLessThan(lessonIndex(placement.lessonId));
      }
    }
  });

  it("has no prerequisite cycles", () => {
    expect(findPrerequisiteCycle(new Map(lessonPlacements.map((placement) => [placement.lessonId, placement.prerequisites])))).toBeNull();
    expect(findPrerequisiteCycle(new Map([["a", ["b"]], ["b", ["c"]], ["c", ["a"]]]))).toEqual(["a", "b", "c", "a"]);
    expect(findPrerequisiteCycle(new Map([["a", ["a"]]]))).toEqual(["a", "a"]);
  });

  it("tags every lesson with skills and uses every skill", () => {
    for (const placement of lessonPlacements) {
      expect(placement.skills.length, placement.lessonId).toBeGreaterThan(0);
      expect(new Set(placement.skills).size, placement.lessonId).toBe(placement.skills.length);
    }
    expect(new Set(lessonPlacements.flatMap((placement) => placement.skills))).toEqual(new Set(Object.keys(skills)));
  });
});
