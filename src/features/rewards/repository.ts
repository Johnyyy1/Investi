import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { lessonAward, progressionUnlock } from "@/db/schema";

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
