import { evaluateCategorize, evaluateDocumentSearch, evaluateFindError, evaluateOrder } from "./exercise-evaluation";
import type { LessonBlock } from "./types";

const questionTypes = ["multipleChoiceQuestion", "numericQuestion", "multiNumericQuestion", "fadedExample", "documentTap", "findError", "categorizeQuestion", "orderQuestion", "documentSearchQuestion", "findErrorQuestion"] as const;
export type QuestionBlock = Extract<LessonBlock, { type: (typeof questionTypes)[number] }>;
export function isQuestion(block: LessonBlock): block is QuestionBlock {
  return (questionTypes as readonly string[]).includes(block.type);
}

/** Normalize the Czech decimal separator at the answer-input boundary. */
export function parseNumericAnswer(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value.replace(",", "."));
}

/** Document selections travel as one comma-separated answer, so they fit the saved-answer contract (≤ 10 keys, ≤ 100 chars). */
export function parseSelection(value: string | undefined) {
  return value ? value.split(",").filter(Boolean) : [];
}
export function serializeSelection(ids: readonly string[]) {
  return [...new Set(ids)].join(",");
}

function isNear(raw: string | undefined, answer: number, tolerance: number) {
  return Math.abs(parseNumericAnswer(raw ?? "") - answer) <= tolerance;
}
function hasNumber(raw: string | undefined) {
  return Boolean(raw?.trim()) && Number.isFinite(parseNumericAnswer(raw!));
}

/**
 * Same authored answers and tolerances as the article renderer; blanks never become zero.
 * `undefined` means "not answered yet", so Check stays disabled and the server refuses to move on.
 */
export function evaluateQuestion(block: QuestionBlock, answers: Record<string, string>) {
  switch (block.type) {
    case "categorizeQuestion": return evaluateCategorize(block, answers);
    case "orderQuestion": return evaluateOrder(block, answers);
    case "documentSearchQuestion": return evaluateDocumentSearch(block, answers, parseNumericAnswer);
    case "findErrorQuestion": return evaluateFindError(block, answers);
    case "multipleChoiceQuestion":
      if (!block.options.some((option) => option.id === answers.answer)) return undefined;
      return answers.answer === block.correctOptionId;
    case "fadedExample": {
      const { blank } = block;
      if (blank.input === "choice") {
        if (!blank.options.some((option) => option.id === answers.answer)) return undefined;
        return answers.answer === blank.correctOptionId;
      }
      if (!hasNumber(answers.answer)) return undefined;
      return isNear(answers.answer, blank.answer, blank.tolerance);
    }
    case "documentTap": {
      const selectable = new Set(block.document.rows.filter((row) => row.selectable !== false).map((row) => row.id));
      const selected = parseSelection(answers.selected);
      if (!selected.length || selected.some((id) => !selectable.has(id))) return undefined;
      const unique = new Set(selected);
      return unique.size === block.correctRowIds.length && block.correctRowIds.every((id) => unique.has(id));
    }
    case "findError":
      if (!block.rows.some((row) => row.id === answers.row) || !block.fixes.some((fix) => fix.id === answers.fix)) return undefined;
      return answers.row === block.errorRowId && answers.fix === block.correctFixId;
    default: {
      const fields = block.type === "multiNumericQuestion" ? block.answers : [{ id: "answer", answer: block.answer, tolerance: block.tolerance }];
      if (fields.some((field) => !hasNumber(answers[field.id]))) return undefined;
      return fields.every((field) => isNear(answers[field.id], field.answer, field.tolerance));
    }
  }
}

/** The explanation shown after Check: a wrong option's own explanation when it has one, otherwise the shared text. */
export function feedbackFor(block: QuestionBlock, answers: Record<string, string>, verdict: boolean) {
  if (verdict) return { explanation: block.correctExplanation };
  const options = block.type === "multipleChoiceQuestion" ? block.options : block.type === "fadedExample" && block.blank.input === "choice" ? block.blank.options : block.type === "findError" ? block.fixes : [];
  const key = block.type === "findError" ? answers.fix : answers.answer;
  const chosen = options.find((option) => option.id === key);
  const wrongRow = block.type === "findError" && answers.row !== block.errorRowId;
  return {
    explanation: !wrongRow && chosen?.explanation ? chosen.explanation : block.incorrectExplanation,
    misconception: !wrongRow ? chosen?.misconception ?? (block.type === "fadedExample" ? block.misconception : undefined) : undefined,
  };
}
