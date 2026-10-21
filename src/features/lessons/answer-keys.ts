import { serializeSelection, type QuestionBlock } from "./question-evaluation";

/**
 * The authored correct answer in the shape the player submits it. Used by tests, QA scripts and fixtures to walk
 * lessons; a new graded block type must be added here as well as in `evaluateQuestion`.
 * `decimalComma` writes a single numeric answer the Czech way, as a learner would type it.
 */
export function correctAnswers(block: QuestionBlock, { decimalComma = false } = {}): Record<string, string> {
  const number = (value: number) => decimalComma ? String(value).replace(".", ",") : String(value);
  switch (block.type) {
    case "multipleChoiceQuestion": return { answer: block.correctOptionId };
    case "numericQuestion": return { answer: number(block.answer) };
    case "multiNumericQuestion": return Object.fromEntries(block.answers.map((field) => [field.id, String(field.answer)]));
    case "fadedExample": return { answer: block.blank.input === "choice" ? block.blank.correctOptionId : number(block.blank.answer) };
    case "documentTap": return { selected: serializeSelection(block.correctRowIds) };
    case "findError": return { row: block.errorRowId, fix: block.correctFixId };
  }
}

/** A complete but wrong answer: another option, or a value well outside the tolerance. `firstFieldOnly` keeps the other fields correct. */
export function wrongAnswers(block: QuestionBlock, { firstFieldOnly = false } = {}): Record<string, string> {
  const miss = (answer: number, tolerance: number) => String(answer + tolerance * 10 + 1);
  switch (block.type) {
    case "multipleChoiceQuestion": return { answer: block.options.find((option) => option.id !== block.correctOptionId)!.id };
    case "numericQuestion": return { answer: miss(block.answer, block.tolerance) };
    case "multiNumericQuestion": return firstFieldOnly
      ? { ...correctAnswers(block), [block.answers[0].id]: miss(block.answers[0].answer, block.answers[0].tolerance) }
      : Object.fromEntries(block.answers.map((field) => [field.id, miss(field.answer, field.tolerance)]));
    case "fadedExample": {
      const { blank } = block;
      return { answer: blank.input === "choice" ? blank.options.find((option) => option.id !== blank.correctOptionId)!.id : miss(blank.answer, blank.tolerance) };
    }
    case "documentTap": {
      const other = block.document.rows.find((row) => row.selectable !== false && !block.correctRowIds.includes(row.id));
      return { selected: serializeSelection(other ? [...block.correctRowIds, other.id] : block.correctRowIds.slice(1)) };
    }
    case "findError": return { row: block.errorRowId, fix: block.fixes.find((fix) => fix.id !== block.correctFixId)!.id };
  }
}
