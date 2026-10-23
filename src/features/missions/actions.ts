"use server";

import { z } from "zod";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { logUnexpectedError } from "@/lib/server-errors";
import { hasCompletedMission, verifyMission } from "./repository";
import { getMission } from "./registry";

const idSchema = z.string().min(1).max(100);
export async function missionStatusAction(missionId: string, lessonId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, completed: false, message: "Přihlas se znovu a ověř misi." };
    const mission = getMission(idSchema.parse(missionId), idSchema.parse(lessonId));
    return { ok: true, completed: await hasCompletedMission(db, user.id, mission.id) };
  } catch { return { ok: false, completed: false, message: "Misi se nepodařilo načíst. Zkus to znovu." }; }
}

export async function verifyMissionAction(missionId: string, lessonId: string, requestId: string, decision?: unknown) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, completed: false, message: "Přihlas se znovu a ověř misi." };
    const mission = getMission(idSchema.parse(missionId), idSchema.parse(lessonId));
    const result = await verifyMission(user.id, mission.id, z.uuid().parse(requestId), decision);
    return { ok: true, ...result };
  } catch (error) {
    if (!(error instanceof z.ZodError)) logUnexpectedError("missions", "verify mission", error);
    return { ok: false, completed: false, message: "Výsledek se nepodařilo ověřit. Zkontroluj zadání a zkus to znovu." };
  }
}
