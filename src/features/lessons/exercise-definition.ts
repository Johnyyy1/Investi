import type { LessonBlock } from "./types";
import { isExercise, validateExercise } from "./exercise-evaluation";
import { isQuestion } from "./question-evaluation";

/** Validate only new block contracts; the published lesson layout and answers are unchanged. */
export function validateExerciseBlocks(blocks: readonly LessonBlock[]) {
  const questions = blocks.filter(isQuestion);
  if (questions.length > 1 || (questions.length === 1 && blocks.at(-1) !== questions[0])) throw new Error("A graded question must be the only question and the last block of its step.");
  for (const block of blocks) {
    if (isExercise(block)) validateExercise(block);
    if (block.type === "checklist" || block.type === "rubricSelfAssessment") {
      const items = block.type === "checklist" ? block.items : block.criteria;
      if (block.id !== block.id.trim() || !block.id.trim() || block.id.length > 100 || !items.length || items.length > 10 || new Set(items.map((item) => item.id)).size !== items.length
        || items.some((item) => item.id !== item.id.trim() || !item.id.trim() || item.id.length > 100)) throw new Error("Invalid output definition.");
    }
    if (block.type === "decisionTree") {
      const nodes = new Map(block.nodes.map((node) => [node.id, node]));
      const visited = new Set<string>();
      const active = new Set<string>();
      const visit = (id: string): boolean => {
        if (active.has(id)) return false;
        if (visited.has(id)) return true;
        const node = nodes.get(id);
        if (!node) return false;
        active.add(id);
        const valid = "outcome" in node ? Boolean(node.outcome.trim()) : node.choices.length > 0
          && new Set(node.choices.map((choice) => choice.id)).size === node.choices.length
          && node.choices.every((choice) => visit(choice.nextId));
        active.delete(id);
        if (valid) visited.add(id);
        return valid;
      };
      if (block.nodes.length > 100 || nodes.size !== block.nodes.length || !visit(block.startId)) throw new Error("Invalid decision tree.");
    }
  }
}
