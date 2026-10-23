import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { lessonProgress, skillAttempt, user } from "@/db/schema";
import type { SkillItem } from "@/features/learning/curriculum";
import { skillItems } from "@/features/learning/curriculum";
import { checkpointContext, skillLevel } from "./domain";

/**
 * Appends one server-evaluated attempt. Under the account row lock, so a concurrent checkpoint answer sees the
 * same state when it decides between checkpoint and review. A retried `requestId` keeps the first row.
 */
export async function recordSkillAttempt(userId: string, input: { requestId: string; item: SkillItem; correct: boolean; mode: "lesson" | "checkpoint"; now?: Date }) {
  const { requestId, item, correct, mode, now = new Date() } = input;
  return db.transaction(async (tx) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
    const context = mode === "lesson" ? "lesson" : checkpointContext(skillLevel(
      await tx.select().from(skillAttempt).where(and(eq(skillAttempt.userId, userId), eq(skillAttempt.skillId, item.skillId)))));
    await tx.insert(skillAttempt).values({ userId, requestId, skillId: item.skillId, itemId: item.id, correct, context, attemptedAt: now }).onConflictDoNothing();
    const [stored] = await tx.select().from(skillAttempt).where(and(eq(skillAttempt.userId, userId), eq(skillAttempt.requestId, requestId)));
    return stored;
  });
}

/** Every skill's derived level, with completed lessons counting as Známé for the skills they evidence. */
export async function loadSkillLevels(userId: string) {
  const [attempts, completed] = await Promise.all([
    db.select().from(skillAttempt).where(eq(skillAttempt.userId, userId)).orderBy(asc(skillAttempt.attemptedAt)),
    db.select({ lessonId: lessonProgress.lessonId }).from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.status, "completed"))),
  ]);
  const done = new Set(completed.map((row) => row.lessonId));
  const skillIds = [...new Set(skillItems.map((entry) => entry.skillId))];
  return Object.fromEntries(skillIds.map((skillId) => [skillId, skillLevel(
    attempts.filter((attempt) => attempt.skillId === skillId),
    skillItems.some((entry) => entry.skillId === skillId && done.has(entry.lessonId)),
  )]));
}
