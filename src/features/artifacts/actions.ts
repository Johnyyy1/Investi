"use server";

import { getCurrentUser } from "@/lib/session";
import { logUnexpectedError } from "@/lib/server-errors";
import { isGuestIdentity } from "@/features/guest/identity";
import { deleteLearnerArtifact, listLearnerArtifacts, saveLearnerArtifact } from "./repository";
import { deleteArtifactSchema, listArtifactsSchema, saveArtifactSchema } from "./schemas";

const unavailable = { ok: false as const, message: "Pro uložení výstupů si nejdřív vytvoř účet nebo se přihlas." };
const failure = { ok: false as const, message: "Výstup se nepodařilo zpracovat. Zkus to znovu." };

/** Input is validated before the repository runs, so anything it throws (a stored payload that no longer parses too) is a failure. */
function failed(operation: string, error: unknown) {
  logUnexpectedError("artifacts", operation, error);
  return failure;
}

export async function saveArtifact(input: unknown) {
  try {
    const owner = await getCurrentUser();
    if (!owner || isGuestIdentity(owner)) return unavailable;
    const parsed = saveArtifactSchema.safeParse(input);
    if (!parsed.success) return { ok: false as const, message: "Zkontroluj výstup a potvrď souhlas s uložením." };
    const artifact = await saveLearnerArtifact(owner.id, parsed.data);
    return { ok: true as const, artifact };
  } catch (error) { return failed("save", error); }
}

export async function listArtifacts(input: unknown = {}) {
  try {
    const owner = await getCurrentUser();
    if (!owner || isGuestIdentity(owner)) return unavailable;
    const parsed = listArtifactsSchema.safeParse(input);
    if (!parsed.success) return failure;
    return { ok: true as const, artifacts: await listLearnerArtifacts(owner.id, parsed.data.kind) };
  } catch (error) { return failed("list", error); }
}

export async function deleteArtifact(input: unknown) {
  try {
    const owner = await getCurrentUser();
    if (!owner || isGuestIdentity(owner)) return unavailable;
    const parsed = deleteArtifactSchema.safeParse(input);
    if (!parsed.success) return failure;
    await deleteLearnerArtifact(owner.id, parsed.data.id);
    return { ok: true as const };
  } catch (error) { return failed("delete", error); }
}
