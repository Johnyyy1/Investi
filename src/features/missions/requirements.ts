import type { LessonBlock } from "@/features/lessons/types";
import { getMission } from "./registry";

export class MissionRequiredError extends Error {
  constructor() { super("Nejdřív splň misi a ověř její výsledek na serveru."); }
}
export function stepMissionIds(step: { blocks: readonly LessonBlock[] }) {
  return step.blocks.flatMap((block) => block.type === "labMission" && block.missionId ? [block.missionId] : []);
}
export async function requireMissions(ids: readonly string[], lessonId: string, completed: (id: string) => Promise<boolean>) {
  for (const id of ids) {
    getMission(id, lessonId);
    if (!await completed(id)) throw new MissionRequiredError();
  }
}
