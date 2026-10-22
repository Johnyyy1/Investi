import type { LessonBlock } from "@/features/lessons/types";
import { lessonAnswersSchema } from "@/features/lessons/answer-contract";
import { availableLessons } from "@/features/learning/catalog";
import { getAuthoredLesson } from "@/features/lessons/registry";
import { getGuidedSteps } from "@/features/lessons/steps";
import { evaluateQuestion, isQuestion } from "@/features/lessons/question-evaluation";

export function lessonSteps(lessonId: string) {
  const definition = availableLessons.find((lesson) => lesson.id === lessonId);
  if (!definition) throw new Error("Lesson is unavailable.");
  return getGuidedSteps(getAuthoredLesson(definition.moduleSlug, definition.slug)!);
}
/**
 * A checked, correct answer earns the right to continue. Mistakes remain ephemeral and retryable.
 * The saved cursor is the proof of a lesson walk: it moves forward one step at a time and only past a step whose
 * graded questions the server re-evaluated as correct, so completion needs no separate record of answers.
 * That holds while each step has at most one graded question and the final step has none; transition tests enforce both.
 */
export function validateMove(lessonId: string, current: number, next: number, answers: Record<string, string> = {}) {
  return validateStepMove(lessonSteps(lessonId), current, next, answers);
}

export function validateStepMove(steps: readonly { blocks: readonly LessonBlock[] }[], current: number, next: number, answers: Record<string, string> = {}) {
  lessonAnswersSchema.parse(answers);
  if (!Number.isInteger(current) || current < 0 || current >= steps.length) throw new Error("Invalid current step.");
  if (!Number.isInteger(next) || next < 0 || next >= steps.length || next > current + 1) throw new Error("Continue one step at a time.");
  if (next > current && steps[current].blocks.filter(isQuestion).some((question) => evaluateQuestion(question, answers) !== true)) {
    throw new Error("Answer the question correctly before continuing.");
  }
}
export function validateCompletion(lessonId: string, progress?: { status: string; lastPosition: number }) {
  if (!progress || (progress.status !== "completed" && progress.lastPosition !== lessonSteps(lessonId).length - 1)) throw new Error("Finish the lesson before completing it.");
}
