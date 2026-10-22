import { describe, expect, it } from "vitest";
import { artifactPayloadSchemas } from "@/features/artifacts/schemas";
import { checklistExercise, rubricExercise } from "./exercise-fixtures";
import { validOutputForBlock } from "./output-contract";
import { validateExerciseBlocks } from "./exercise-definition";

const rubric = { type: "rubricSelfAssessment", blockId: rubricExercise.id, text: "Ověřím svůj plán.", ratings: [{ criterionId: "specific", level: 1 }] } as const;
describe("explicit lesson output submission", () => {
  it("accepts a low self-rating and empty checklist while rejecting missing/forged output", () => {
    const parsed = artifactPayloadSchemas.lesson_output.parse(rubric);
    if (parsed.type !== "rubricSelfAssessment") throw new Error("Expected a rubric payload.");
    expect(validOutputForBlock(rubricExercise, parsed)).toBe(true);
    expect(validOutputForBlock(checklistExercise, { type: "checklist", blockId: checklistExercise.id, checkedItemIds: [] })).toBe(true);
    for (const patch of [{ text: " " }, { text: "x".repeat(2001) }, { ratings: [] }, { ratings: [{ criterionId: "specific", level: 0 }] }, { ratings: [{ criterionId: "specific", level: 5 }] }, { ratings: [rubric.ratings[0], rubric.ratings[0]] }]) expect(artifactPayloadSchemas.lesson_output.safeParse({ ...rubric, ...patch }).success).toBe(false);
    expect(validOutputForBlock(rubricExercise, { ...parsed, blockId: "other" })).toBe(false);
    expect(validOutputForBlock(rubricExercise, { ...parsed, ratings: [{ criterionId: "made-up", level: 4 }] })).toBe(false);
    expect(validOutputForBlock(checklistExercise, { type: "checklist", blockId: checklistExercise.id, checkedItemIds: ["made-up"] })).toBe(false);
  });
  it("bounds output definitions independently of cursor answer size", () => {
    expect(() => validateExerciseBlocks([rubricExercise, checklistExercise])).not.toThrow();
    expect(() => validateExerciseBlocks([{ ...checklistExercise, items: [] }])).toThrow();
  });
});
