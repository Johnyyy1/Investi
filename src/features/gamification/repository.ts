import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { learningProfile, lessonAward } from "@/db/schema";
import { getLearningProfile } from "@/features/onboarding/repository";
import { getGamification, validTimeZone } from "./domain";

export async function loadGamification(userId: string) {
  // The profile read is request-memoized, so inside a render this reuses the learner's profile.
  const [awards, profile] = await Promise.all([
    db.select().from(lessonAward).where(eq(lessonAward.userId, userId)),
    getLearningProfile(userId),
  ]);
  return getGamification(awards, new Date(), profile?.timeZone ?? "UTC", profile?.dailyGoalMinutes);
}
/** Pin once, so travelling or changing device timezones cannot manufacture learning days. */
export async function initializeTimeZone(userId: string, value: unknown) {
  const timeZone = validTimeZone(value);
  await db.update(learningProfile).set({ timeZone }).where(and(eq(learningProfile.userId, userId), isNull(learningProfile.timeZone)));
}
