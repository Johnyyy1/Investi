import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { lessonAward, lessonProgress, portfolio, progressionUnlock, user } from "../src/db/schema";
import { lessonSteps } from "../src/features/progress/transition";
import { completeLesson } from "../src/features/progress/repository";
import { loadPortfolioLabUnlock, requirePortfolioLabUnlock } from "../src/features/progression/repository";
import { progressionUnlocks } from "../src/features/progression/unlocks";
import { loadPracticeCapitalSummary } from "../src/features/rewards/repository";
import { loadPortfolioView } from "../src/features/portfolio/service";
import { executeTrade, resetActivePortfolio } from "../src/features/portfolio/repository";
import { ensureDemoSeed } from "../src/features/demo/repository";

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname), "Requires a local test database.");
const sql = postgres(databaseUrl, { prepare: false });
const ids: string[] = [];
async function owner(isAnonymous = false) {
  const id = `progression_qa_${randomUUID()}`;
  ids.push(id);
  await db.insert(user).values({ id, email: `${id}@example.com`, name: "Progression QA", isAnonymous, createdAt: new Date(), updatedAt: new Date() });
  return id;
}
async function finalCursor(userId: string, lessonId: string) {
  await db.insert(lessonProgress).values({ userId, lessonId, status: "in_progress", lastPosition: lessonSteps(lessonId).length - 1, updatedAt: new Date() });
}
/** Holds the user's row lock from another session, as a completion or trade would. A FOR UPDATE, or an insert
 * whose foreign key needs FOR KEY SHARE on the user row, blocks until release; a plain read does not. */
async function holdUserRowLock(userId: string) {
  let release!: () => void, acquired!: () => void;
  const released = new Promise<void>((resolve) => { release = resolve; });
  const held = new Promise<void>((resolve) => { acquired = resolve; });
  const transaction = sql.begin(async (tx) => {
    await tx`select id from "user" where id = ${userId} for update`;
    acquired();
    await released;
  });
  await held;
  return async () => { release(); await transaction; };
}
const settlesWithin = (promise: Promise<unknown>, ms: number) =>
  Promise.race([promise.then(() => true, () => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]);
const unlockRowsOf = (userId: string) => db.select().from(progressionUnlock).where(eq(progressionUnlock.userId, userId));

try {
  // A pre-existing seeded demo gets access lazily without rewriting its learning history.
  const demo = await owner(true), otherDemo = await owner(true);
  await ensureDemoSeed(demo);
  await ensureDemoSeed(otherDemo);
  const demoProgress = await db.select().from(lessonProgress).where(eq(lessonProgress.userId, demo));
  const demoAwards = await db.select().from(lessonAward).where(eq(lessonAward.userId, demo));
  const demoAccess = await Promise.all([loadPortfolioLabUnlock(demo), requirePortfolioLabUnlock(demo)]);
  assert.ok(demoAccess.every((status) => status.unlocked && !status.newlyUnlocked && !status.prerequisitesComplete));
  assert.equal(demoAccess.reduce((sum, status) => sum + status.capitalAwardedMinor, 0n), 500_000n);
  const demoGrants = await db.select().from(progressionUnlock).where(eq(progressionUnlock.userId, demo));
  assert.equal(demoGrants.length, 1);
  assert.equal(demoGrants[0].reason, "demo_access");
  assert.deepEqual(await db.select().from(lessonProgress).where(eq(lessonProgress.userId, demo)), demoProgress);
  assert.deepEqual(await db.select().from(lessonAward).where(eq(lessonAward.userId, demo)), demoAwards);
  const demoView = await loadPortfolioView(demo);
  assert.equal(demoView.earnedPracticeCapitalMinor, "500000");
  assert.equal(demoView.investmentGainLossMinor, "0", "demo capital is a contribution, not investment performance");
  await requirePortfolioLabUnlock(otherDemo);
  const otherDemoView = await loadPortfolioView(otherDemo);
  const demoBuy = { instrumentId: "US-XNAS:AAPL", quantity: "0.1", side: "BUY" as const, clientIdempotencyKey: randomUUID() };
  await executeTrade(demo, demoBuy);
  assert.equal((await executeTrade(demo, demoBuy)).duplicate, true);
  assert.deepEqual(await loadPortfolioView(otherDemo), otherDemoView, "demo trading remains isolated");
  await executeTrade(demo, { ...demoBuy, side: "SELL", clientIdempotencyKey: randomUUID() });
  await resetActivePortfolio(demo, randomUUID());
  await ensureDemoSeed(demo);
  await requirePortfolioLabUnlock(demo);
  const resetDemo = await loadPortfolioView(demo);
  assert.equal(resetDemo.availableCashMinor, "500000");
  assert.equal(resetDemo.investmentGainLossMinor, "0");
  assert.equal(resetDemo.holdings.length, 0, "reset and revisit never reseed trades");
  assert.equal((await db.select().from(progressionUnlock).where(eq(progressionUnlock.userId, demo))).length, 1);
  await db.update(lessonProgress).set({ lastPosition: lessonSteps("foundations-risk-reward").length - 1 }).where(and(eq(lessonProgress.userId, demo), eq(lessonProgress.lessonId, "foundations-risk-reward")));
  const demoCompletion = await completeLesson(demo, "foundations-risk-reward");
  assert.equal(demoCompletion.xpAwarded, 60);
  assert.equal(demoCompletion.unlockCapitalAwardedMinor, 0n, "later lessons do not duplicate the demo grant");
  assert.equal(demoCompletion.portfolioLabUnlocked, false);

  const learner = await owner();
  assert.equal((await loadPortfolioLabUnlock(learner)).unlocked, false);
  await assert.rejects(() => requirePortfolioLabUnlock(learner));
  const required = progressionUnlocks.PORTFOLIO_LAB.prerequisiteLessonIds;
  for (const lessonId of required.slice(0, -1)) {
    await finalCursor(learner, lessonId);
    assert.equal((await completeLesson(learner, lessonId)).xpAwarded, 60);
  }
  assert.equal((await loadPortfolioLabUnlock(learner)).unlocked, false);
  await finalCursor(learner, required.at(-1)!);
  await finalCursor(learner, "returns-what-is-a-return");
  const results = await Promise.all([
    completeLesson(learner, required.at(-1)!),
    completeLesson(learner, "returns-what-is-a-return"),
  ]);
  assert.equal(results.filter((result) => result.portfolioLabUnlocked).length, 1, "concurrent threshold crossings grant once");
  assert.equal(results.reduce((sum, result) => sum + result.unlockCapitalAwardedMinor, 0n), 500_000n);
  assert.equal((await completeLesson(learner, required.at(-1)!)).xpAwarded, 0, "retry awards no XP");
  assert.equal((await loadPortfolioLabUnlock(learner)).newlyUnlocked, false, "reload does not grant again");
  const [awardRows, unlockRows] = await Promise.all([
    db.select().from(lessonAward).where(eq(lessonAward.userId, learner)),
    db.select().from(progressionUnlock).where(eq(progressionUnlock.userId, learner)),
  ]);
  assert.equal(awardRows.reduce((sum, row) => sum + row.xp, 0), 480);
  assert.equal(unlockRows.length, 1);
  assert.equal(unlockRows[0].practiceCapitalMinor, 500_000n);
  assert.ok(awardRows.every((row) => row.practiceCapitalMinor === 0n && row.rewardPolicyVersion === 2), "new completions use XP-only policy v2");
  assert.equal((await loadPracticeCapitalSummary(learner)).earnedPracticeCapitalMinor, 500_000n);
  const view = await loadPortfolioView(learner);
  assert.equal(view.earnedPracticeCapitalMinor, "500000");
  assert.equal(view.availableCashMinor, "500000");
  assert.equal(view.investmentGainLossMinor, "0", "learning grants are contributions, not return");

  // Reading a recorded unlock takes no transaction and no row lock, and writes nothing.
  const recordedBefore = await unlockRowsOf(learner);
  const releaseLearner = await holdUserRowLock(learner);
  try {
    const read = loadPortfolioLabUnlock(learner);
    assert.ok(await settlesWithin(read, 2_000), "a recorded unlock is read without waiting for the user's row lock");
    const status = await read;
    assert.equal(status.unlocked, true);
    assert.equal(status.newlyUnlocked, false);
    assert.equal(status.capitalAwardedMinor, 0n);
    assert.equal(status.totalXp, 480);
    assert.ok((await Promise.all(Array.from({ length: 8 }, () => requirePortfolioLabUnlock(learner)))).every((status) => status.unlocked && status.capitalAwardedMinor === 0n));
  } finally { await releaseLearner(); }
  assert.deepEqual(await unlockRowsOf(learner), recordedBefore, "reading a recorded unlock is side-effect-free");

  // A still-locked account is answered from the same plain read, with exact progress figures.
  const partial = await owner();
  for (const lessonId of required.slice(0, 2)) {
    await finalCursor(partial, lessonId);
    await completeLesson(partial, lessonId);
  }
  const releasePartial = await holdUserRowLock(partial);
  try {
    const read = loadPortfolioLabUnlock(partial);
    assert.ok(await settlesWithin(read, 2_000), "a locked account is read without waiting for the user's row lock");
    const status = await read;
    assert.equal(status.unlocked, false);
    assert.equal(status.totalXp, 120);
    assert.equal(status.completedPrerequisiteLessons, 2);
    assert.equal(status.requiredPrerequisiteLessons, required.length);
    assert.equal(status.capitalAwardedMinor, 0n);
    await assert.rejects(() => requirePortfolioLabUnlock(partial));
  } finally { await releasePartial(); }
  assert.equal((await unlockRowsOf(partial)).length, 0, "a locked read records nothing");
  await assert.rejects(() => loadPortfolioLabUnlock(`progression_qa_missing_${randomUUID()}`), /Účet není dostupný/);

  // An account that must be recorded still takes the user's row lock, so it serialises with completions and trades.
  const pendingDemo = await owner(true);
  const releasePendingDemo = await holdUserRowLock(pendingDemo);
  const pendingDemoAccess = loadPortfolioLabUnlock(pendingDemo);
  try {
    assert.equal(await settlesWithin(pendingDemoAccess, 300), false, "recording a new unlock waits for the user's row lock");
  } finally { await releasePendingDemo(); }
  const pendingDemoStatus = await pendingDemoAccess;
  assert.equal(pendingDemoStatus.unlocked, true);
  assert.equal(pendingDemoStatus.newlyUnlocked, false, "demo access is not a learning unlock");
  assert.equal(pendingDemoStatus.capitalAwardedMinor, 500_000n);
  assert.deepEqual((await unlockRowsOf(pendingDemo)).map((row) => [row.reason, row.practiceCapitalMinor]), [["demo_access", 500_000n]]);

  // Legacy repair: qualifying learning without a record. Concurrent page reads, action guards and a completion grant once.
  const unrecorded = await owner();
  for (const lessonId of required) {
    await db.insert(lessonProgress).values({ userId: unrecorded, lessonId, status: "completed", lastPosition: lessonSteps(lessonId).length - 1, completedAt: new Date(), updatedAt: new Date() });
    await db.insert(lessonAward).values({ userId: unrecorded, lessonId, xp: 60, practiceCapitalMinor: 0n, rewardPolicyVersion: 2, learningDate: "2026-10-14", timeZone: "UTC", awardedAt: new Date() });
  }
  await finalCursor(unrecorded, "returns-what-is-a-return");
  const [completion, ...repairs] = await Promise.all([
    completeLesson(unrecorded, "returns-what-is-a-return"),
    ...Array.from({ length: 6 }, () => loadPortfolioLabUnlock(unrecorded)),
    requirePortfolioLabUnlock(unrecorded),
    requirePortfolioLabUnlock(unrecorded),
  ]);
  assert.ok(repairs.every((status) => status.unlocked));
  assert.equal(repairs.reduce((sum, status) => sum + status.capitalAwardedMinor, completion.unlockCapitalAwardedMinor), 500_000n, "concurrent repair grants exactly once");
  assert.equal(repairs.filter((status) => status.newlyUnlocked).length + (completion.portfolioLabUnlocked ? 1 : 0), 1);
  assert.equal(completion.xpAwarded, 60);
  assert.deepEqual((await unlockRowsOf(unrecorded)).map((row) => [row.reason, row.practiceCapitalMinor]), [["learning_requirements", 500_000n]]);
  assert.equal((await loadPracticeCapitalSummary(unrecorded)).earnedPracticeCapitalMinor, 500_000n);
  assert.equal((await loadPortfolioLabUnlock(unrecorded)).capitalAwardedMinor, 0n, "after repair, reads grant nothing");

  const legacy = await owner();
  await db.insert(lessonAward).values({ userId: legacy, lessonId: required[0], xp: 60, practiceCapitalMinor: 200_000n, rewardPolicyVersion: 1, learningDate: "2026-09-22", timeZone: "UTC", awardedAt: new Date() });
  await db.insert(portfolio).values({ id: randomUUID(), userId: legacy, openedAt: new Date(), openingCapitalMinor: 200_000n });
  await executeTrade(legacy, { instrumentId: "US-XNAS:AAPL", quantity: "0.1", side: "BUY", clientIdempotencyKey: randomUUID() });
  const original = await db.select().from(portfolio).where(eq(portfolio.userId, legacy));
  const originalView = await loadPortfolioView(legacy);
  assert.equal((await loadPortfolioLabUnlock(legacy)).unlocked, true, "existing portfolio retains access");
  assert.equal((await loadPortfolioLabUnlock(legacy)).capitalAwardedMinor, 0n);
  assert.deepEqual(await db.select().from(portfolio).where(eq(portfolio.userId, legacy)), original, "legacy portfolio remains untouched");
  assert.equal((await loadPracticeCapitalSummary(legacy)).earnedPracticeCapitalMinor, 200_000n, "grandfathering adds no capital");
  assert.equal((await loadPortfolioView(legacy)).holdings[0].quantity, originalView.holdings[0].quantity, "grandfathering preserves holdings and trades");
  assert.equal((await db.select().from(lessonAward).where(eq(lessonAward.userId, legacy))).length, 1, "grandfathering does not fabricate XP");
  await finalCursor(legacy, required[1]);
  const mixed = await completeLesson(legacy, required[1]);
  assert.equal(mixed.xpAwarded, 60);
  assert.equal(mixed.practiceCapitalAwardedMinor, 0n, "subsequent completion follows v2");
  const mixedRows = await db.select().from(lessonAward).where(eq(lessonAward.userId, legacy));
  assert.equal(mixedRows.find((row) => row.lessonId === required[0])?.practiceCapitalMinor, 200_000n, "v1 receipt remains unchanged");
  assert.equal(mixedRows.find((row) => row.lessonId === required[1])?.rewardPolicyVersion, 2, "new receipt records v2");
  assert.equal((await loadPracticeCapitalSummary(legacy)).earnedPracticeCapitalMinor, 200_000n, "mixed v1/v2 capital preserves only historical amount");

  const backfill = await owner();
  await db.insert(lessonAward).values({ userId: backfill, lessonId: required[1], xp: 60, practiceCapitalMinor: 200_000n, rewardPolicyVersion: 1, learningDate: "2026-09-22", timeZone: "UTC", awardedAt: new Date() });
  await db.insert(portfolio).values({ id: randomUUID(), userId: backfill, openedAt: new Date(), openingCapitalMinor: 200_000n });
  await executeTrade(backfill, { instrumentId: "US-XNAS:AAPL", quantity: "0.1", side: "BUY", clientIdempotencyKey: randomUUID() });
  const beforeBackfill = await loadPortfolioView(backfill);
  const migration = await readFile(new URL("../drizzle/0007_complex_deadpool.sql", import.meta.url), "utf8");
  const insert = migration.slice(migration.indexOf('INSERT INTO "progression_unlock"'));
  await sql.unsafe(insert);
  await sql.unsafe(insert);
  const migrated = await db.select().from(progressionUnlock).where(and(eq(progressionUnlock.userId, backfill), eq(progressionUnlock.unlockId, "PORTFOLIO_LAB")));
  assert.equal(migrated.length, 1, "backfill rerun is idempotent");
  assert.equal(migrated[0].reason, "existing_portfolio");
  assert.equal(migrated[0].practiceCapitalMinor, 0n);
  const afterBackfill = await loadPortfolioView(backfill);
  assert.equal(afterBackfill.holdings[0].quantity, beforeBackfill.holdings[0].quantity, "migration backfill preserves holdings and trades");
  assert.equal(afterBackfill.earnedPracticeCapitalMinor, beforeBackfill.earnedPracticeCapitalMinor, "grandfathering contributes no capital");
  console.log("PASS: demo access, isolated trading/reset, concurrent one-time demo grant, preserved learning history, XP, concurrent learning unlock, lock-free side-effect-free status reads, locked-path recording, concurrent legacy repair, grandfathering, accounting, and migration rerun.");
} finally {
  await db.delete(user).where(eq(user.id, ids[0] ?? ""));
  for (const id of ids.slice(1)) await db.delete(user).where(eq(user.id, id));
  await sql.end();
  const client = (globalThis as unknown as { client?: { end: () => Promise<void> } }).client;
  if (client) await client.end();
}
