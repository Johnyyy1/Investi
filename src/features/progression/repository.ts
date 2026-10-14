import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { perfMeasure } from "@/lib/perf";
import { lessonAward, lessonProgress, portfolio, progressionUnlock, user } from "@/db/schema";
import { PORTFOLIO_LAB_UNLOCK_ID, progressionUnlocks, resolvePortfolioLabUnlock, type PortfolioLabUnlockFacts } from "./unlocks";

type ProgressionQuery = Pick<typeof db, "select" | "insert">;

/** Every fact the unlock rule needs, in one statement and therefore one snapshot. Undefined if the user is gone.
 * Subqueries filter by the parameter rather than correlating with "user", so unqualified columns stay unambiguous. */
async function facts(query: Pick<typeof db, "select">, userId: string): Promise<PortfolioLabUnlockFacts | undefined> {
  const [row] = await query.select({
    isAnonymous: user.isAnonymous,
    totalXp: sql<number>`(select coalesce(sum(${lessonAward.xp}), 0)::integer from ${lessonAward} where ${lessonAward.userId} = ${userId})`.mapWith(Number),
    completedLessonIds: sql<string[]>`array(select ${lessonProgress.lessonId} from ${lessonProgress} where ${lessonProgress.userId} = ${userId} and ${lessonProgress.status} = 'completed')`,
    recorded: sql<boolean>`exists(select 1 from ${progressionUnlock} where ${progressionUnlock.userId} = ${userId} and ${progressionUnlock.unlockId} = ${PORTFOLIO_LAB_UNLOCK_ID})`,
    grandfathered: sql<boolean>`exists(select 1 from ${portfolio} where ${portfolio.userId} = ${userId})`,
  }).from(user).where(eq(user.id, userId));
  if (!row) return undefined;
  return {
    progression: { totalXp: row.totalXp, completedLessonIds: new Set(row.completedLessonIds) },
    recorded: row.recorded,
    grandfathered: row.grandfathered,
    isDemo: row.isAnonymous,
  };
}

const unchanged = (status: ReturnType<typeof resolvePortfolioLabUnlock>["status"]) => ({ ...status, newlyUnlocked: false, capitalAwardedMinor: 0n });

/** Caller holds the user's row lock, shared with lesson completion and trades. */
export async function ensurePortfolioLabUnlockInTransaction(query: ProgressionQuery, userId: string) {
  const current = await facts(query, userId);
  if (!current) throw new Error("Účet není dostupný.");
  const { status, needsRecord } = resolvePortfolioLabUnlock(current);
  if (!needsRecord) return unchanged(status);
  const { grandfathered, isDemo } = current;
  const [inserted] = await query.insert(progressionUnlock).values({
    userId,
    unlockId: PORTFOLIO_LAB_UNLOCK_ID,
    practiceCapitalMinor: grandfathered ? 0n : progressionUnlocks.PORTFOLIO_LAB.rewardPracticeCapitalMinor,
    reason: grandfathered ? "existing_portfolio" : isDemo ? "demo_access" : "learning_requirements",
    unlockedAt: new Date(),
  }).onConflictDoNothing().returning();
  return { ...status, newlyUnlocked: !!inserted && !grandfathered && !isDemo, capitalAwardedMinor: inserted?.practiceCapitalMinor ?? 0n };
}

/** Opens demos and repairs qualifying legacy accounts on first access; retries grant nothing extra.
 * Recorded and still-locked accounts are answered from one plain read with no transaction or row lock;
 * only an account that must be recorded takes the locked write path, which re-reads under the lock. */
export async function loadPortfolioLabUnlock(userId: string) {
  return perfMeasure("progression.loadPortfolioLabUnlock", "db", async () => {
    const current = await perfMeasure("progression.readUnlockFacts", "db", () => facts(db, userId));
    if (!current) throw new Error("Účet není dostupný.");
    const { status, needsRecord } = resolvePortfolioLabUnlock(current);
    if (!needsRecord) return unchanged(status);
    return db.transaction(async (tx) => {
      // Separate op: a long lockRow means this transaction waited on another holder of the user's row lock.
      const [owner] = await perfMeasure("progression.lockUserRow", "db", () => tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update"));
      if (!owner) throw new Error("Účet není dostupný.");
      return perfMeasure("progression.ensureUnlock", "db", () => ensurePortfolioLabUnlockInTransaction(tx, userId));
    });
  });
}

export async function requirePortfolioLabUnlock(userId: string) {
  const status = await loadPortfolioLabUnlock(userId);
  if (!status.unlocked) throw new Error("Portfolio Lab je zamčený. Odemkneš ho dokončením Základů investování.");
  return status;
}
