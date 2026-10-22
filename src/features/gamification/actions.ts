"use server";
import { getCurrentUser } from "@/lib/session";
import { logUnexpectedError } from "@/lib/server-errors";
import { validTimeZone } from "./domain";
import { initializeTimeZone } from "./repository";
import { revalidatePath } from "next/cache";
export async function initializeTimeZoneAction(timeZone: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false };
    // A zone this server cannot resolve is the browser's input, not a failure.
    try { validTimeZone(timeZone); } catch { return { ok: false }; }
    await initializeTimeZone(user.id, timeZone);
    revalidatePath("/learn");
    return { ok: true };
  } catch (error) {
    logUnexpectedError("gamification", "initialize time zone", error);
    return { ok: false };
  }
}
