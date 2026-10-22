import { describe, expect, it } from "vitest";
import { evaluateQuestion, feedbackFor, isQuestion } from "./question-evaluation";
import { correctAnswers, wrongAnswers } from "@/features/progress/test-fixtures";
import { validateStepMove } from "@/features/progress/transition";
import { categorizeExercise, orderExercise, numericDocumentExercise, gradedExercises, checklistExercise, rubricExercise, decisionExercise } from "./exercise-fixtures";
import { lessonAnswersSchema } from "./answer-contract";
import { validateExerciseBlocks } from "./exercise-definition";
import { resolveDecisionTree } from "./decision-tree";
import { stepArtifactRequirements } from "./output-contract";

describe("new server-graded exercise contracts", () => {
  it.each(gradedExercises)("evaluates complete, wrong, missing and forged answers for $type", (block) => {
    expect(isQuestion(block)).toBe(true);
    expect(evaluateQuestion(block, correctAnswers(block))).toBe(true);
    expect(evaluateQuestion(block, wrongAnswers(block))).toBe(false);
    expect(feedbackFor(block, correctAnswers(block), true).explanation).toBe(block.correctExplanation);
    expect(feedbackFor(block, wrongAnswers(block), false).explanation).toBe(block.incorrectExplanation);
    const invalid: Record<string, string>[] = [{}, { answer: "" }, { answer: "unknown" }, { ...correctAnswers(block), forged: "correct" }];
    for (const answers of invalid) expect(evaluateQuestion(block, answers)).toBeUndefined();
    const steps = [{ blocks: [block] }, { blocks: [] }];
    for (const answers of [{}, wrongAnswers(block)]) expect(() => validateStepMove(steps, 0, 1, answers)).toThrow();
    expect(() => validateStepMove(steps, 0, 1, correctAnswers(block))).not.toThrow();
    expect(() => validateStepMove(steps, 1, 0)).not.toThrow();
  });
  it("requires every category and each unique ordering position", () => {
    expect(evaluateQuestion(categorizeExercise, { commission: "order" })).toBeUndefined();
    expect(evaluateQuestion(categorizeExercise, { commission: "order", fund: "made-up" })).toBeUndefined();
    expect(evaluateQuestion(orderExercise, { "0": "plan", "1": "plan", "2": "confirm" })).toBeUndefined();
    expect(evaluateQuestion(orderExercise, { "0": "plan", "1": "review" })).toBeUndefined();
  });
  it("reads numeric document answers with the same decimal and missing-value rules", () => {
    expect(evaluateQuestion(numericDocumentExercise, { answer: "0,25" })).toBe(true);
    for (const answer of ["", " ", "NaN", "Infinity"]) expect(evaluateQuestion(numericDocumentExercise, { answer })).toBeUndefined();
    expect(evaluateQuestion(numericDocumentExercise, { answer: "0" })).toBe(false);
  });
  it("fits ten long IDs in ten bounded fields without packing a JSON array", () => {
    const items = Array.from({ length: 10 }, (_, index) => ({ id: `${index}${"x".repeat(99)}`, label: String(index) }));
    const block = { ...orderExercise, items, correctOrder: items.map((item) => item.id) };
    const answers = correctAnswers(block);
    expect(lessonAnswersSchema.safeParse(answers).success).toBe(true);
    expect(evaluateQuestion(block, answers)).toBe(true);
    for (const invalid of [{ ...answers, extra: "x" }, { answer: "x".repeat(101) }, { ["x".repeat(101)]: "x" }]) expect(lessonAnswersSchema.safeParse(invalid).success).toBe(false);
    expect(() => validateExerciseBlocks([{ ...block, items: [...items, { id: "extra", label: "Extra" }] }])).toThrow();
  });
  it("rejects impossible authored questions and multiple grades on a step", () => {
    expect(() => validateExerciseBlocks([{ ...orderExercise, correctOrder: ["plan", "plan", "confirm"] }])).toThrow();
    expect(() => validateExerciseBlocks([categorizeExercise, orderExercise])).toThrow();
    expect(() => validateExerciseBlocks([orderExercise, { id: "after", type: "paragraph", content: "After the question" }])).toThrow();
  });
});

describe("ungraded activities and explicit submissions", () => {
  it("never grades or blocks a checklist or decision tree", () => {
    for (const block of [checklistExercise, decisionExercise]) {
      expect(isQuestion(block)).toBe(false);
      expect(() => validateStepMove([{ blocks: [block] }, { blocks: [] }], 0, 1)).not.toThrow();
      expect(stepArtifactRequirements({ blocks: [block] }).filter(Boolean)).toEqual([]);
    }
  });
  it("derives rubric submission from persisted block output, never answer correctness", () => {
    expect(isQuestion(rubricExercise)).toBe(false);
    expect(stepArtifactRequirements({ blocks: [rubricExercise] })).toContainEqual({ kind: "lesson_output", blockId: rubricExercise.id });
  });
  it("resolves branches and outcomes, rejecting invalid paths and cycles", () => {
    expect(resolveDecisionTree(decisionExercise, [])).toMatchObject({ id: "start" });
    expect(resolveDecisionTree(decisionExercise, ["yes"])).toMatchObject({ id: "review" });
    expect(resolveDecisionTree(decisionExercise, ["no"])).toMatchObject({ id: "write" });
    for (const path of [["unknown"], ["yes", "no"]]) expect(resolveDecisionTree(decisionExercise, path)).toBeUndefined();
    const cyclic = { ...decisionExercise, nodes: [{ id: "start", prompt: "Cycle", choices: [{ id: "back", label: "Back", nextId: "start" }] }] };
    expect(() => validateExerciseBlocks([cyclic])).toThrow();
    expect(resolveDecisionTree(cyclic, ["back"])).toBeUndefined();
  });
});
