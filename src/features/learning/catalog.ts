import { foundationsLessons, FOUNDATIONS_MODULE_ID } from "../lessons/foundations/manifest";
import { RETURNS_MODULE_ID, returnsLessons } from "../lessons/returns/manifest";
import { VOLATILITY_MODULE_ID, volatilityLessons } from "../lessons/volatility/manifest";
export type ModuleStatus = "available" | "planned";

export type LearningModuleDefinition = {
  slug: string;
  title: string;
  description: string;
  lessonCount: number;
  estimatedMinutes: number;
  status: ModuleStatus;
};

/** Product-facing curriculum registry until the editorial CMS is introduced. */
export const moduleCatalog: readonly LearningModuleDefinition[] = [
  { slug: "investing-foundations", title: "Základy investování", description: "Vybuduj si základní představy, které potřebuješ před analýzou investic.", lessonCount: foundationsLessons.filter((lesson) => lesson.status === "available").length, estimatedMinutes: foundationsLessons.filter((lesson) => lesson.status === "available").reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0), status: "available" },
  { slug: "returns", title: "Výnos a složené zhodnocení", description: "Od změn cen ke srovnatelným výsledkům investic.", lessonCount: returnsLessons.filter((lesson) => lesson.status === "available").length, estimatedMinutes: returnsLessons.filter((lesson) => lesson.status === "available").reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0), status: "available" },
  { slug: "volatility", title: "Volatilita", description: "Měření rozsahu a nejistoty výnosů.", lessonCount: volatilityLessons.filter((lesson) => lesson.status === "available").length, estimatedMinutes: volatilityLessons.filter((lesson) => lesson.status === "available").reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0), status: "available" },
  { slug: "correlation", title: "Korelace", description: "Jak se aktiva pohybují společně — a kdy ne.", lessonCount: 4, estimatedMinutes: 40, status: "planned" },
  { slug: "diversification", title: "Diverzifikace", description: "Sestavování portfolií, která promyšleně rozkládají riziko.", lessonCount: 5, estimatedMinutes: 50, status: "planned" },
];

export function getModuleBySlug(slug: string) {
  return moduleCatalog.find((module) => module.slug === slug);
}

/** One typed manifest for routing, persistence, and all module paths. Historical IDs stay stable. */
export const curriculumLessons = [
  ...foundationsLessons.map((lesson) => ({ ...lesson, moduleSlug: "investing-foundations", moduleId: FOUNDATIONS_MODULE_ID })),
  ...returnsLessons.map((lesson) => ({ ...lesson, moduleSlug: "returns", moduleId: RETURNS_MODULE_ID })),
  ...volatilityLessons.map((lesson) => ({ ...lesson, moduleSlug: "volatility", moduleId: VOLATILITY_MODULE_ID })),
];
export const availableLessons = curriculumLessons.filter((lesson) => lesson.status === "available");
export function getModuleLessons(slug: string) { return curriculumLessons.filter((lesson) => lesson.moduleSlug === slug); }
export function getModulePath(slug: string, states: { lessonId: string; status: string }[]) {
  return getModuleLessons(slug).map((lesson) => {
    const status = states.find((state) => state.lessonId === lesson.id)?.status;
    const state = lesson.status !== "available" ? "locked" : status === "completed" ? "completed" : status === "in_progress" ? "active" : "available";
    return { id: lesson.id, title: lesson.title, minutes: lesson.estimatedMinutes, state } as const;
  });
}
