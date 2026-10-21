import type { QuestionBlock } from "./question-evaluation";
import { correctAnswers as authoredCorrect, wrongAnswers as authoredWrong } from "./answer-keys";
import type { AuthoredLesson, LessonBlock } from "./types";

/** Test-only helpers for authored lesson suites. */
export function block<T extends LessonBlock["type"]>(lesson: AuthoredLesson, id: string, type: T) {
  const found = lesson.blocks.find((item) => item.id === id);
  if (!found || found.type !== type) throw new Error(`Missing ${type} ${id}`);
  return found as Extract<LessonBlock, { type: T }>;
}

export const numericAnswer = (lesson: AuthoredLesson, id: string) => block(lesson, id, "numericQuestion").answer;

export function correctAnswers(question: QuestionBlock): Record<string, string> {
  return authoredCorrect(question, { decimalComma: true });
}

export function wrongAnswers(question: QuestionBlock): Record<string, string> {
  return authoredWrong(question);
}
