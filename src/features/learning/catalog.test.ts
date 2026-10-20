import { describe, expect, it } from "vitest";
import { getModuleBySlug, getModulePath, lessonLink, moduleCatalog } from "./catalog";
import { foundationsLessons } from "../lessons/foundations/manifest";
import { returnsLessons } from "../lessons/returns/manifest";

describe("module catalog", () => {
  it("exposes Investing Foundations as the first available module", () => {
    expect(moduleCatalog[0]).toMatchObject({ slug: "investing-foundations", status: "available" });
  });

  it("returns undefined for an unknown module", () => {
    expect(getModuleBySlug("unknown-module")).toBeUndefined();
  });

  it("publishes every module, from Foundations to Diversification", () => {
    expect(moduleCatalog.map((module) => [module.slug, module.status])).toEqual([["investing-foundations", "available"], ["returns", "available"], ["volatility", "available"], ["correlation", "available"], ["diversification", "available"]]);
  });

  it("builds Lab lesson links from the curriculum and never links an unpublished lesson", () => {
    expect(lessonLink("diversification-sectors-countries")).toEqual({ href: "/learn/diversification/sectors-and-countries", label: "Lekce: Sektory a země" });
    expect(lessonLink("diversification-correlation-risk")?.href).toBe("/learn/diversification/correlation-and-portfolio-risk");
    expect(lessonLink("foundations-checkpoint")).toBeNull();
    expect(lessonLink("unknown")).toBeNull();
  });
});

describe("persisted Returns path", () => {
  it("shows available lessons without inventing in-progress state", () => {
    expect(getModulePath("returns", []).map((item) => item.state)).toEqual(["available", "available", "available", "available", "available", "available"]);
  });
  it("matches unordered persisted rows by lesson id, not array position", () => {
    const items = getModulePath("returns", [{ lessonId: returnsLessons[2].id, status: "in_progress" }, { lessonId: returnsLessons[0].id, status: "completed" }]);
    expect(items.map((item) => item.state)).toEqual(["completed", "available", "active", "available", "available", "available"]);
  });
  it("never unlocks an unimplemented lesson from a stray progress row", () => {
    const planned = foundationsLessons.filter((lesson) => lesson.status === "planned");
    expect(planned.length).toBeGreaterThan(0);
    const path = getModulePath("investing-foundations", planned.map((lesson) => ({ lessonId: lesson.id, status: "completed" })));
    expect(path.filter((item) => planned.some((lesson) => lesson.id === item.id)).map((item) => item.state)).toEqual(["locked"]);
  });
});
