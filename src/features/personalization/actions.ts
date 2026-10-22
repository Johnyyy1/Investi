"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { logUnexpectedError } from "@/lib/server-errors";
import { completePersonalization, retakeDiagnostic, skipPersonalization, updatePersonalizedPreferences } from "./repository";

async function save(name: string, input: unknown, operation: (userId: string, input: unknown) => Promise<void>) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, message: "Přihlas se znovu a ulož své předvolby.", signIn: true };
    await operation(user.id, input);
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    // Answers that fail validation are the learner's to fix; anything else is a failure.
    if (!(error instanceof z.ZodError)) logUnexpectedError("personalization", name, error);
    return { ok: false as const, message: "Přizpůsobení se nepodařilo uložit. Zkontroluj odpovědi a zkus to znovu." };
  }
}
export async function completePersonalizationAction(input: unknown) { return save("complete personalization", input, completePersonalization); }
export async function updatePersonalizedPreferencesAction(input: unknown) { return save("update preferences", input, updatePersonalizedPreferences); }
export async function retakeDiagnosticAction(input: unknown) { return save("retake diagnostic", input, retakeDiagnostic); }
export async function skipPersonalizationAction(input: unknown) { return save("skip personalization", input, skipPersonalization); }
