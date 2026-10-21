import { describe, expect, it } from "vitest";
import { availableLessons, curriculumLessons, getModuleLessons, moduleCatalog } from "@/features/learning/catalog";
import { findMissingCurriculum } from "./curriculum";

const seededModules = () => moduleCatalog.filter((module) => module.status === "available").map((module) => ({ id: getModuleLessons(module.slug)[0].moduleId, isPublished: true }));
const seededLessons = () => curriculumLessons.map((lesson) => ({ id: lesson.id, moduleId: lesson.moduleId, isPublished: lesson.status === "available" }));

describe("findMissingCurriculum", () => {
  it("reports nothing for a fully seeded database", () => {
    expect(findMissingCurriculum({ modules: seededModules(), lessons: seededLessons() })).toEqual({ modules: [], lessons: [] });
  });

  it("reports every catalog lesson of a module that was never seeded", () => {
    const volatility = getModuleLessons("volatility");
    const moduleId = volatility[0].moduleId;
    const missing = findMissingCurriculum({
      modules: seededModules().filter((row) => row.id !== moduleId),
      lessons: seededLessons().filter((row) => row.moduleId !== moduleId),
    });
    expect(missing.modules).toEqual(["volatility"]);
    expect(missing.lessons).toEqual(volatility.filter((lesson) => lesson.status === "available").map((lesson) => lesson.id));
  });

  it("treats unpublished rows and rows in the wrong module as missing", () => {
    const [first, second] = availableLessons;
    const lessons = seededLessons().map((row) =>
      row.id === first.id ? { ...row, isPublished: false } : row.id === second.id ? { ...row, moduleId: "another-module" } : row,
    );
    const modules = seededModules().map((row, index) => (index === 0 ? { ...row, isPublished: false } : row));
    expect(findMissingCurriculum({ modules, lessons })).toEqual({ modules: [moduleCatalog[0].slug], lessons: [first.id, second.id] });
  });

  it("reports everything against an empty database", () => {
    const missing = findMissingCurriculum({ modules: [], lessons: [] });
    expect(missing.lessons).toHaveLength(availableLessons.length);
    expect(missing.modules).toHaveLength(moduleCatalog.filter((module) => module.status === "available").length);
  });
});
