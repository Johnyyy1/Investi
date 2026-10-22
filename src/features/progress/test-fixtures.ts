import type { QuestionBlock } from "@/features/lessons/question-evaluation";
import { correctAnswers as authoredCorrect, wrongAnswers as authoredWrong } from "@/features/lessons/answer-keys";

/** The authored correct answer, in the shape the lesson submits it. */
export function correctAnswers(block: QuestionBlock): Record<string, string> {
  return authoredCorrect(block);
}

/** A complete but wrong answer: another option, or a value well outside the tolerance (only the first field of several). */
export function wrongAnswers(block: QuestionBlock): Record<string, string> {
  return authoredWrong(block, { firstFieldOnly: true });
}
