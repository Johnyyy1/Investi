import type { QuestionBlock } from "@/features/lessons/question-evaluation";

/** The authored correct answer, in the shape the lesson submits it. */
export function correctAnswers(block: QuestionBlock): Record<string, string> {
  if (block.type === "multipleChoiceQuestion") return { answer: block.correctOptionId };
  if (block.type === "numericQuestion") return { answer: String(block.answer) };
  return Object.fromEntries(block.answers.map((field) => [field.id, String(field.answer)]));
}

/** A complete but wrong answer: another option, or a value well outside the tolerance (only the first field of several). */
export function wrongAnswers(block: QuestionBlock): Record<string, string> {
  const miss = (answer: number, tolerance: number) => String(answer + 10 * (tolerance + 1));
  if (block.type === "multipleChoiceQuestion") return { answer: block.options.find((option) => option.id !== block.correctOptionId)!.id };
  if (block.type === "numericQuestion") return { answer: miss(block.answer, block.tolerance) };
  return { ...correctAnswers(block), [block.answers[0].id]: miss(block.answers[0].answer, block.answers[0].tolerance) };
}
