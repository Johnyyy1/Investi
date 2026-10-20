import type { QuestionBlock } from "./question-evaluation";
import type { AuthoredLesson, LessonBlock } from "./types";

/** Test-only helpers for authored lesson suites. */
export function block<T extends LessonBlock["type"]>(lesson: AuthoredLesson, id: string, type: T) {
  const found = lesson.blocks.find((item) => item.id === id);
  if (!found || found.type !== type) throw new Error(`Missing ${type} ${id}`);
  return found as Extract<LessonBlock, { type: T }>;
}

export const numericAnswer = (lesson: AuthoredLesson, id: string) => block(lesson, id, "numericQuestion").answer;

export function correctAnswers(question: QuestionBlock): Record<string, string> {
  if (question.type === "multipleChoiceQuestion") return { answer: question.correctOptionId };
  if (question.type === "numericQuestion") return { answer: String(question.answer).replace(".", ",") };
  return Object.fromEntries(question.answers.map((answer) => [answer.id, String(answer.answer)]));
}

export function wrongAnswers(question: QuestionBlock): Record<string, string> {
  if (question.type === "multipleChoiceQuestion") return { answer: question.options.find((option) => option.id !== question.correctOptionId)!.id };
  if (question.type === "numericQuestion") return { answer: String(question.answer + question.tolerance * 10 + 1) };
  return Object.fromEntries(question.answers.map((answer) => [answer.id, String(answer.answer + answer.tolerance * 10 + 1)]));
}
