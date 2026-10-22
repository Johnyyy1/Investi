import type { ExerciseBlock, LessonBlock } from "./types";
import { lessonAnswersSchema } from "./answer-contract";

export function isExercise(block: LessonBlock): block is ExerciseBlock {
  return ["categorizeQuestion", "orderQuestion", "documentSearchQuestion", "findErrorQuestion"].includes(block.type);
}

const unique = (ids: readonly string[]) => new Set(ids).size === ids.length;
function idsValid(ids: readonly string[], max = 10) {
  return ids.length > 0 && ids.length <= max && unique(ids) && ids.every((id) => id.trim().length > 0 && id.length <= 100);
}

/** Authoring errors fail closed, before a learner is asked for an impossible/oversized answer. */
export function validateExercise(block: ExerciseBlock) {
  let valid: boolean;
  switch (block.type) {
    case "categorizeQuestion":
      valid = idsValid(block.items.map((item) => item.id)) && idsValid(block.categories.map((item) => item.id))
        && block.items.every((item) => block.categories.some((category) => category.id === item.categoryId));
      break;
    case "orderQuestion":
      valid = idsValid(block.items.map((item) => item.id)) && unique(block.correctOrder) && block.correctOrder.length === block.items.length
        && block.correctOrder.every((id) => block.items.some((item) => item.id === id));
      break;
    case "documentSearchQuestion":
      const target = block.target;
      valid = idsValid(block.document.regions.map((region) => region.id)) && (target.type === "region"
        ? block.document.regions.some((region) => region.id === target.regionId)
        : Number.isFinite(target.answer) && Number.isFinite(target.tolerance) && target.tolerance >= 0);
      break;
    case "findErrorQuestion":
      valid = idsValid(block.steps.map((step) => step.id)) && block.steps.some((step) => step.id === block.incorrectStepId);
  }
  if (!valid) throw new Error(`Invalid exercise definition: ${block.id}`);
}

function complete(answers: Record<string, string>, keys: string[]) {
  return lessonAnswersSchema.safeParse(answers).success && Object.keys(answers).length === keys.length
    && keys.every((key) => Object.hasOwn(answers, key) && answers[key].trim() !== "");
}

export function evaluateCategorize(block: Extract<ExerciseBlock, { type: "categorizeQuestion" }>, answers: Record<string, string>) {
  validateExercise(block);
  if (!complete(answers, block.items.map((item) => item.id)) || block.items.some((item) => !block.categories.some((category) => category.id === answers[item.id]))) return undefined;
  return block.items.every((item) => answers[item.id] === item.categoryId);
}

/** One position per field, never a JSON array that could exceed the 100-character value limit. */
export function evaluateOrder(block: Extract<ExerciseBlock, { type: "orderQuestion" }>, answers: Record<string, string>) {
  validateExercise(block);
  const keys = block.items.map((_, index) => String(index));
  if (!complete(answers, keys) || !unique(keys.map((key) => answers[key]))
    || keys.some((key) => !block.items.some((item) => item.id === answers[key]))) return undefined;
  return block.correctOrder.every((id, index) => answers[String(index)] === id);
}

export function evaluateDocumentSearch(block: Extract<ExerciseBlock, { type: "documentSearchQuestion" }>, answers: Record<string, string>, parseNumber: (value: string) => number) {
  validateExercise(block);
  if (!complete(answers, ["answer"])) return undefined;
  if (block.target.type === "region") {
    if (!block.document.regions.some((region) => region.id === answers.answer)) return undefined;
    return answers.answer === block.target.regionId;
  }
  const number = parseNumber(answers.answer);
  return Number.isFinite(number) ? Math.abs(number - block.target.answer) <= block.target.tolerance : undefined;
}

export function evaluateFindError(block: Extract<ExerciseBlock, { type: "findErrorQuestion" }>, answers: Record<string, string>) {
  validateExercise(block);
  if (!complete(answers, ["answer"]) || !block.steps.some((step) => step.id === answers.answer)) return undefined;
  return answers.answer === block.incorrectStepId;
}
