import type { ArtifactKind, ArtifactRequirement } from "./schemas";

export class ArtifactRequiredError extends Error {
  constructor() { super("Nejdřív ulož výstup požadovaný v tomto kroku lekce."); }
}

/** Presence comes from server storage, never a client answer or cursor flag. */
export async function requireArtifacts(
  requirements: readonly (ArtifactRequirement | undefined)[],
  lessonId: string,
  hasArtifact: (kind: ArtifactKind, sourceLessonId?: string, blockId?: string) => Promise<boolean>,
) {
  for (const requirement of requirements) {
    if (requirement && !await hasArtifact(requirement.kind, requirement.source === "any_lesson" ? undefined : lessonId, requirement.blockId)) throw new ArtifactRequiredError();
  }
}
