import { availableLessons } from "./catalog";
import { getStepDefinitions } from "../lessons/steps";

export type LearnerState = { lessonId: string; status: "not_started" | "in_progress" | "completed"; lastPosition: number; updatedAt: Date; completedAt: Date | null };
/** Continuity first: latest active lesson, unfinished learning in the last completed module,
 * recommended module, then curriculum order. Ties use curriculum order. Only published lessons count. */
export function getLearnerSummary(states: LearnerState[], recommendedStart = "investing-foundations") {
  const lessons = availableLessons;
  const completed = lessons.filter((lesson) => states.some((state) => state.lessonId === lesson.id && state.status === "completed"));
  const knownStates = states.filter((state) => lessons.some((lesson) => lesson.id === state.lessonId));
  const latest = (a: LearnerState, b: LearnerState) => b.updatedAt.getTime() - a.updatedAt.getTime() || lessons.findIndex((lesson) => lesson.id === a.lessonId) - lessons.findIndex((lesson) => lesson.id === b.lessonId);
  const current = knownStates.filter((state) => state.status === "in_progress").sort(latest)[0];
  const recent = knownStates.filter((state) => state.status === "completed").sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0) || latest(a, b));
  const previousModule = lessons.find((lesson) => lesson.id === recent[0]?.lessonId)?.moduleSlug;
  const unfinished = lessons.filter((lesson) => !completed.includes(lesson));
  const next = lessons.find((lesson) => lesson.id === current?.lessonId)
    ?? unfinished.find((lesson) => lesson.moduleSlug === previousModule)
    ?? unfinished.find((lesson) => lesson.moduleSlug === recommendedStart)
    ?? unfinished[0] ?? lessons[lessons.length - 1];
  const state = states.find((state) => state.lessonId === next.id);
  const stepCount = getStepDefinitions(next.id).length;
  return { lessons, completed, next, state, stepCount, position: Math.min(Math.max(state?.lastPosition ?? 0, 0), stepCount - 1), allComplete: completed.length === lessons.length, percentage: Math.round(completed.length / lessons.length * 100), recent };
}
