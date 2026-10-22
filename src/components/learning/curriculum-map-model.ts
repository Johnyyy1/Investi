import { getStepDefinitions } from "@/features/lessons/steps";
import { curriculumLevels, displayModules, getDisplayModulePlacements, getLessonPlacement } from "@/features/learning/curriculum";
import type { getLearnerSummary, LearnerState } from "@/features/learning/learner-summary";

type Summary = Pick<ReturnType<typeof getLearnerSummary>, "lessons" | "completed" | "next" | "allComplete"> & { states: readonly LearnerState[] };
export type MapStatus = "done" | "started" | "todo" | "planned";
export const mapStatusLabels: Record<MapStatus, string> = { done: "Hotovo", started: "Rozpracováno", todo: "Nezačato", planned: "Připravujeme" };

/** Presentation only: display placement never replaces storage identity, routing or reward eligibility.
 * Counts describe published lessons, not mastery or completion of a practical milestone. */
export function curriculumMapModel(summary: Summary) {
  const completed = new Set(summary.completed.map((lesson) => lesson.id));
  const currentPlacement = !summary.allComplete ? getLessonPlacement(summary.next.id) : undefined;
  const progress = (lessons: readonly { done: boolean; active: boolean }[]) => {
    const finished = lessons.filter((lesson) => lesson.done).length;
    const status: MapStatus = !lessons.length ? "planned" : finished === lessons.length ? "done" : lessons.some((lesson) => lesson.done || lesson.active) ? "started" : "todo";
    return { completed: finished, total: lessons.length, status, percentage: lessons.length ? Math.round(finished / lessons.length * 100) : null };
  };
  return curriculumLevels.map((level) => {
    const modules = displayModules.filter((module) => module.levelId === level.id).map((module) => {
      const lessons = getDisplayModulePlacements(module.code).flatMap((placement) => {
        const lesson = summary.lessons.find((candidate) => candidate.id === placement.lessonId);
        if (!lesson) return [];
        const state = summary.states.find((candidate) => candidate.lessonId === lesson.id);
        const stepCount = state?.status === "in_progress" ? getStepDefinitions(lesson.id).length : 0;
        const step = stepCount ? { position: Math.min(Math.max(state!.lastPosition, 0) + 1, stepCount), count: stepCount } : undefined;
        return [{ step, ...lesson, displayCode: placement.displayCode, href: `/learn/${lesson.moduleSlug}/${lesson.slug}`, done: completed.has(lesson.id), active: !completed.has(lesson.id) && state?.status === "in_progress", current: !summary.allComplete && summary.next.id === lesson.id }];
      });
      return { ...module, lessons, ...progress(lessons) };
    });
    return { ...level, modules, ...progress(modules.flatMap((module) => module.lessons)), current: modules.some((module) => module.code === currentPlacement?.displayModule), optional: ["L4", "L5", "L6", "V"].includes(level.id) };
  });
}
export type CurriculumMapModel = ReturnType<typeof curriculumMapModel>;
