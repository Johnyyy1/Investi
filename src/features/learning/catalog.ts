import { storageModules } from "./curriculum";
export type ModuleStatus = "available" | "planned";

export type LearningModuleDefinition = {
  slug: string;
  title: string;
  description: string;
  lessonCount: number;
  estimatedMinutes: number;
  status: ModuleStatus;
};

/** Storage modules for routing, seeding and module pages, derived from the curriculum registry. */
export const moduleCatalog: readonly LearningModuleDefinition[] = storageModules.map((module) => {
  const published = module.lessons.filter((lesson) => lesson.status === "available");
  return { slug: module.slug, title: module.title, description: module.description, lessonCount: published.length, estimatedMinutes: published.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0), status: module.status };
});

export function getModuleBySlug(slug: string) {
  return moduleCatalog.find((module) => module.slug === slug);
}

/** One typed manifest for routing, persistence, and all module paths. Historical IDs stay stable. */
export const curriculumLessons = storageModules.flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, moduleSlug: module.slug, moduleId: module.id })));
export const availableLessons = curriculumLessons.filter((lesson) => lesson.status === "available");
/** `Lekce: <title>` for a published lesson, so a renamed or moved lesson updates every Lab link; null until it is published. */
export function lessonLink(lessonId: string): { href: string; label: string } | null {
  const lesson = availableLessons.find((candidate) => candidate.id === lessonId);
  return lesson ? { href: `/learn/${lesson.moduleSlug}/${lesson.slug}`, label: `Lekce: ${lesson.title}` } : null;
}
export function getModuleLessons(slug: string) { return curriculumLessons.filter((lesson) => lesson.moduleSlug === slug); }
export function getModulePath(slug: string, states: { lessonId: string; status: string }[]) {
  return getModuleLessons(slug).map((lesson) => {
    const status = states.find((state) => state.lessonId === lesson.id)?.status;
    const state = lesson.status !== "available" ? "locked" : status === "completed" ? "completed" : status === "in_progress" ? "active" : "available";
    return { id: lesson.id, title: lesson.title, minutes: lesson.estimatedMinutes, state } as const;
  });
}
