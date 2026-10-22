import type { ArtifactPayload, ArtifactRequirement } from "@/features/artifacts/schemas";
import type { LessonBlock, OutputBlock } from "./types";

/** A self-assessment submits evidence, never a correct grade or a minimum self-rating. */
export function validOutputForBlock(block: OutputBlock, payload: ArtifactPayload<"lesson_output">) {
  if (block.id !== payload.blockId || block.type !== payload.type) return false;
  if (block.type === "checklist" && payload.type === "checklist") {
    return payload.checkedItemIds.every((id) => block.items.some((item) => item.id === id));
  }
  if (block.type === "rubricSelfAssessment" && payload.type === "rubricSelfAssessment") {
    return payload.ratings.length === block.criteria.length && block.criteria.every((criterion) => payload.ratings.some((rating) => rating.criterionId === criterion.id));
  }
  return false;
}

export function stepArtifactRequirements(step: { requiredArtifact?: ArtifactRequirement; blocks: readonly LessonBlock[] }) {
  return [step.requiredArtifact, ...step.blocks.flatMap((block): ArtifactRequirement[] => block.type === "rubricSelfAssessment"
    ? [{ kind: "lesson_output", blockId: block.id }] : [])];
}
