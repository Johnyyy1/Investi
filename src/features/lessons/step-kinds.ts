import type { FactKey } from "@/features/facts/registry";
import type { AuthoredLesson, LessonBlock } from "./types";

/** Two-column desktop layouts from designs H, I, J and K (document or data left, task right). */
const splitBlockTypes: ReadonlySet<LessonBlock["type"]> = new Set(["documentTap", "findError", "personaDecision", "labMission"]);

/**
 * Desktop column for a step: the reading column by default, wider for interactive figures and widest for the
 * two-column step kinds. Mobile is always one column.
 */
export function stepWidth(blocks: readonly LessonBlock[]) {
  if (blocks.some((block) => splitBlockTypes.has(block.type))) return "max-w-[1240px]";
  if (blocks.some((block) => block.type === "interactiveFigure")) return "max-w-[1040px]";
  return "max-w-[760px]";
}

/** Every fact a lesson shows, in first-use order, for the "Stav k" chip on its first step. */
export function lessonFactKeys(lesson: Pick<AuthoredLesson, "blocks">): FactKey[] {
  return [...new Set(lesson.blocks.flatMap((block) => block.type === "factNotice" ? block.factKeys : []))];
}
