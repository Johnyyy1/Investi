import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { perfMeasure } from "@/lib/perf";
import { lessonAward, lessonProgress, portfolio, progressionUnlock, user } from "@/db/schema";
import { evaluateUnlock, PORTFOLIO_LAB_UNLOCK_ID, progressionUnlocks } from "./unlocks";

type ProgressionQuery = Pick<typeof db, "select" | "insert">;

async function facts(query: Pick<typeof db, "select">, userId: string) {
  const [awards, states, recorded, priorPortfolio, owners] = await Promise.all([
    query.select({ xp: lessonAward.xp }).from(lessonAward).where(eq(lessonAward.userId, userId)),
    query.select({ lessonId: lessonProgress.lessonId }).from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.status, "completed"))),
    query.select().from(progressionUnlock).where(and(eq(progressionUnlock.userId, userId), eq(progressionUnlock.unlockId, PORTFOLIO_LAB_UNLOCK_ID))).limit(1),
    query.select({ id: portfolio.id }).from(portfolio).where(eq(portfolio.userId, userId)).limit(1),
    query.select({ isAnonymous: user.isAnonymous }).from(user).where(eq(user.id, userId)).limit(1),
  ]);
  return {
    progression: { totalXp: awards.reduce((sum, award) => sum + award.xp, 0), completedLessonIds: new Set(states.map((state) => state.lessonId)) },
    recorded: recorded[0],
    grandfathered: priorPortfolio.length > 0,
    isDemo: owners[0]?.isAnonymous === true,
  };
}

/** Caller holds the user's row lock, shared with lesson completion and trades. */
export async function ensurePortfolioLabUnlockInTransaction(query: ProgressionQuery, userId: string) {
  const { progression, recorded, grandfathered, isDemo } = await facts(query, userId);
  const status = evaluateUnlock(PORTFOLIO_LAB_UNLOCK_ID, progression, !!recorded || grandfathered, isDemo);
  if (recorded || !status.unlocked) return { ...status, newlyUnlocked: false, capitalAwardedMinor: 0n };
  const [inserted] = await query.insert(progressionUnlock).values({
    userId,
    unlockId: PORTFOLIO_LAB_UNLOCK_ID,
    practiceCapitalMinor: grandfathered ? 0n : progressionUnlocks.PORTFOLIO_LAB.rewardPracticeCapitalMinor,
    reason: grandfathered ? "existing_portfolio" : isDemo ? "demo_access" : "learning_requirements",
    unlockedAt: new Date(),
  }).onConflictDoNothing().returning();
  return { ...status, newlyUnlocked: !!inserted && !grandfathered && !isDemo, capitalAwardedMinor: inserted?.practiceCapitalMinor ?? 0n };
}

/** Opens demos and repairs qualifying legacy accounts on first access; retries grant nothing extra. */
export async function loadPortfolioLabUnlock(userId: string) {
  return perfMeasure("progression.loadPortfolioLabUnlock", "db", () => db.transaction(async (tx) => {
    // Separate op: a long lockRow means this transaction waited on another holder of the user's row lock.
    const [owner] = await perfMeasure("progression.lockUserRow", "db", () => tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update"));
    if (!owner) throw new Error("Účet není dostupný.");
    return perfMeasure("progression.ensureUnlock", "db", () => ensurePortfolioLabUnlockInTransaction(tx, userId));
  }));
}

export async function requirePortfolioLabUnlock(userId: string) {
  const status = await loadPortfolioLabUnlock(userId);
  if (!status.unlocked) throw new Error("Portfolio Lab je zamčený. Odemkneš ho dokončením Základů investování.");
  return status;
}
