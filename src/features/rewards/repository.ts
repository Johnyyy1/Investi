import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { lesson, lessonAward, progressionUnlock } from "@/db/schema";
import { practiceCapitalLedger, type PracticeCapitalReceipt } from "./practice-capital";

/** Lesson receipts plus unlock grants, summed by the database as exact integers. One statement,
 * so one round-trip and one snapshot; usable inside a transaction that holds the user's row lock. */
export async function readPracticeCapitalEntitlementMinor(query: Pick<typeof db, "execute">, userId: string) {
  const [row] = await query.execute<{ awards: string; grants: string }>(sql`select
    (select coalesce(sum(${lessonAward.practiceCapitalMinor}), 0) from ${lessonAward} where ${lessonAward.userId} = ${userId})::text as awards,
    (select coalesce(sum(${progressionUnlock.practiceCapitalMinor}), 0) from ${progressionUnlock} where ${progressionUnlock.userId} = ${userId})::text as grants`);
  return BigInt(row?.awards ?? "0") + BigInt(row?.grants ?? "0");
}

/** Returns the exact Practice Capital entitlement from immutable lesson receipts. */
export async function loadPracticeCapitalSummary(userId: string) {
  return { earnedPracticeCapitalMinor: await readPracticeCapitalEntitlementMinor(db, userId) };
}

/** Unjoined authoritative amounts and original dates, including legacy and zero receipts. */
export async function readPracticeCapitalContributions(query: Pick<typeof db, "select">, userId: string) {
  const awards = query.select({ amountMinor: lessonAward.practiceCapitalMinor, at: lessonAward.awardedAt })
    .from(lessonAward).where(eq(lessonAward.userId, userId));
  const grants = query.select({ amountMinor: progressionUnlock.practiceCapitalMinor, at: progressionUnlock.unlockedAt })
    .from(progressionUnlock).where(eq(progressionUnlock.userId, userId));
  return awards.unionAll(grants);
}

/** Every lesson receipt and unlock grant behind the entitlement, read in one statement so the
 * ledger total always equals readPracticeCapitalEntitlementMinor for the same snapshot. */
export async function loadPracticeCapitalLedger(userId: string) {
  const lessons = db.select({
    kind: sql<PracticeCapitalReceipt["kind"]>`'lesson'`.as("kind"),
    sourceId: lessonAward.lessonId,
    label: lesson.title,
    amountMinor: lessonAward.practiceCapitalMinor,
    receivedAt: lessonAward.awardedAt,
  }).from(lessonAward).innerJoin(lesson, eq(lesson.id, lessonAward.lessonId)).where(eq(lessonAward.userId, userId));
  const grants = db.select({
    kind: sql<PracticeCapitalReceipt["kind"]>`'unlock'`.as("kind"),
    sourceId: progressionUnlock.unlockId,
    label: progressionUnlock.reason,
    amountMinor: progressionUnlock.practiceCapitalMinor,
    receivedAt: progressionUnlock.unlockedAt,
  }).from(progressionUnlock).where(eq(progressionUnlock.userId, userId));
  const rows = await lessons.unionAll(grants);
  return practiceCapitalLedger(rows.map(({ kind, sourceId, label, amountMinor, receivedAt }): PracticeCapitalReceipt => kind === "lesson"
    ? { kind, lessonId: sourceId, title: label, amountMinor, receivedAt }
    : { kind, unlockId: sourceId, reason: label, amountMinor, receivedAt }));
}
