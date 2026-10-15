// Guest → account claim on a disposable local database: receipts, progress, profile, demo isolation,
// atomicity, idempotency and concurrency with lesson completion.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { learningProfile, lessonAward, lessonProgress, portfolio, progressionUnlock, user } from "../src/db/schema";
import { claimGuestLearning, deleteDemoIdentity } from "../src/features/guest/repository";
import { completeLesson, saveLessonProgress } from "../src/features/progress/repository";
import { lessonSteps } from "../src/features/progress/transition";
import { loadPracticeCapitalSummary } from "../src/features/rewards/repository";
import { loadPortfolioLabUnlock } from "../src/features/progression/repository";
import { getOrCreateActivePortfolio } from "../src/features/portfolio/repository";
import { foundationsLessons } from "../src/features/lessons/foundations/manifest";
import { isQuestion } from "../src/features/lessons/question-evaluation";

assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname), "Requires a disposable local DB.");
const ids: string[] = [];
const prefix = `guestqa_${randomUUID().replaceAll("-", "")}`;
const FIRST = "foundations-why-invest", SECOND = "foundations-stocks";

async function identity(kind: "guest" | "demo" | "account") {
  const id = `${prefix}_${ids.length}`; ids.push(id);
  await db.insert(user).values({ id, email: `${id}@example.com`, name: "Guest QA", isAnonymous: kind !== "account", anonymousKind: kind === "account" ? null : kind, createdAt: new Date(), updatedAt: new Date() });
  return id;
}
/** Walks a lesson the way the player does: one step at a time, correct answers only, then completes it. */
async function finish(userId: string, lessonId: string) {
  const steps = lessonSteps(lessonId);
  for (let position = 1; position < steps.length; position++) {
    const question = steps[position - 1].blocks.find(isQuestion);
    const answers = !question ? undefined : question.type === "multipleChoiceQuestion" ? { answer: question.correctOptionId }
      : question.type === "numericQuestion" ? { answer: String(question.answer) } : Object.fromEntries(question.answers.map((field) => [field.id, String(field.answer)]));
    await saveLessonProgress(userId, { lessonId, status: "in_progress", lastPosition: position }, answers);
  }
  return completeLesson(userId, lessonId);
}
async function onboard(userId: string, goals: ("QUANT" | "CONFIDENCE")[], completedAt = new Date()) {
  await db.insert(learningProfile).values({ userId, goals, dailyGoalMinutes: 5, timeZone: "Europe/Prague", onboardingStep: 6, onboardingCompletedAt: completedAt, personalizedOnboardingCompletedAt: completedAt, updatedAt: completedAt });
}
const awards = (userId: string) => db.select().from(lessonAward).where(eq(lessonAward.userId, userId));
const progress = (userId: string) => db.select().from(lessonProgress).where(eq(lessonProgress.userId, userId));
const exists = async (userId: string) => (await db.select({ id: user.id }).from(user).where(eq(user.id, userId))).length === 1;
const strip = <T extends { userId: string }>(rows: T[]) => rows.map((row) => JSON.stringify({ ...row, userId: undefined }, (_, value) => typeof value === "bigint" ? `${value}n` : value)).sort();

try {
  // 0. Schema: a kind belongs to anonymous identities only.
  await assert.rejects(() => db.insert(user).values({ id: `${prefix}_bad`, email: `${prefix}_bad@example.com`, name: "Bad", isAnonymous: false, anonymousKind: "guest", createdAt: new Date(), updatedAt: new Date() }));

  // 1. New account: everything the guest earned moves unchanged; the guest is gone.
  const guest = await identity("guest"), account = await identity("account");
  await onboard(guest, ["CONFIDENCE"]);
  const reward = await finish(guest, FIRST);
  assert.equal(reward.xpAwarded, 60);
  const guestAwards = await awards(guest), guestProgress = await progress(guest);
  const guestCapital = (await loadPracticeCapitalSummary(guest)).earnedPracticeCapitalMinor;
  assert.deepEqual(await claimGuestLearning(guest, account), { claimed: true });
  assert.equal(await exists(guest), false);
  assert.deepEqual(strip(await awards(account)), strip(guestAwards), "receipts keep timestamps, amounts and policy version");
  assert.deepEqual(strip(await progress(account)), strip(guestProgress));
  assert.equal((await loadPracticeCapitalSummary(account)).earnedPracticeCapitalMinor, guestCapital, "Practice Capital is derived from the same receipts");
  const [claimedProfile] = await db.select().from(learningProfile).where(eq(learningProfile.userId, account));
  assert.deepEqual(claimedProfile.goals, ["CONFIDENCE"]); assert.ok(claimedProfile.personalizedOnboardingCompletedAt);
  // 2. Idempotent: a retry after success finds no guest and changes nothing.
  assert.deepEqual(await claimGuestLearning(guest, account), { claimed: false });
  assert.equal((await awards(account)).length, 1);
  // A claimed lesson cannot be rewarded again on the account.
  assert.equal((await completeLesson(account, FIRST)).xpAwarded, 0);
  console.log("PASS: new account receives guest receipts, progress and profile unchanged; retry is a no-op; no second reward.");

  // 3. Existing account wins: its own receipt and profile stay; only missing lessons are added.
  const guest2 = await identity("guest"), existing = await identity("account");
  await onboard(existing, ["QUANT"], new Date("2026-01-01T00:00:00Z"));
  await finish(existing, FIRST);
  const [ownReceipt] = await awards(existing);
  await onboard(guest2, ["CONFIDENCE"]);
  await finish(guest2, FIRST); await finish(guest2, SECOND);
  await claimGuestLearning(guest2, existing);
  const merged = await awards(existing);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.find((row) => row.lessonId === FIRST), ownReceipt, "one lifetime receipt per lesson: the account's");
  assert.ok(merged.some((row) => row.lessonId === SECOND));
  assert.deepEqual((await db.select().from(learningProfile).where(eq(learningProfile.userId, existing)))[0].goals, ["QUANT"]);
  // 4. An unfinished account lesson is completed by the guest's finished one; a finished one is never reopened.
  const guest3 = await identity("guest"), partial = await identity("account");
  await saveLessonProgress(partial, { lessonId: FIRST, status: "in_progress", lastPosition: 1 });
  await finish(guest3, FIRST);
  await saveLessonProgress(guest3, { lessonId: SECOND, status: "in_progress", lastPosition: 1 }, { answer: (lessonSteps(SECOND)[0].blocks.find(isQuestion) as { correctOptionId: string }).correctOptionId });
  await finish(partial, SECOND);
  await claimGuestLearning(guest3, partial);
  const partialRows = await progress(partial);
  assert.equal(partialRows.find((row) => row.lessonId === FIRST)?.status, "completed");
  assert.equal(partialRows.find((row) => row.lessonId === SECOND)?.status, "completed");
  console.log("PASS: existing account keeps its receipts and profile, gains only missing lessons; finished lessons never reopen.");

  // 5. Demo sample data never moves; a demo link only deletes the demo.
  const demo = await identity("demo"), demoTarget = await identity("account");
  await finish(demo, FIRST);
  await assert.rejects(() => claimGuestLearning(demo, demoTarget));
  assert.equal(await exists(demo), true); assert.equal((await awards(demoTarget)).length, 0);
  await deleteDemoIdentity(demo);
  assert.equal(await exists(demo), false); assert.equal((await awards(demoTarget)).length, 0);
  // deleteDemoIdentity never deletes a guest or an account.
  const keptGuest = await identity("guest"); await deleteDemoIdentity(keptGuest); await deleteDemoIdentity(demoTarget);
  assert.equal(await exists(keptGuest), true); assert.equal(await exists(demoTarget), true);
  console.log("PASS: demo receipts are never claimed; demo cleanup touches only demos.");

  // 6. Atomic: a guest with a portfolio (not reachable through the app) is rejected and nothing moves.
  const guestWithPortfolio = await identity("guest"), target6 = await identity("account");
  await finish(guestWithPortfolio, FIRST);
  await db.insert(portfolio).values({ id: randomUUID(), userId: guestWithPortfolio, openedAt: new Date(), openingCapitalMinor: 0n });
  await assert.rejects(() => claimGuestLearning(guestWithPortfolio, target6));
  assert.equal(await exists(guestWithPortfolio), true); assert.equal((await awards(guestWithPortfolio)).length, 1); assert.equal((await awards(target6)).length, 0);
  // Guests cannot open the Lab or record an unlock, even with every Foundations lesson finished.
  const labGuest = await identity("guest");
  for (const lesson of foundationsLessons.filter((row) => row.status === "available")) await finish(labGuest, lesson.id);
  const labStatus = await loadPortfolioLabUnlock(labGuest);
  assert.equal(labStatus.unlocked, false); assert.equal(labStatus.requiresAccount, true);
  assert.equal((await db.select().from(progressionUnlock).where(eq(progressionUnlock.userId, labGuest))).length, 0);
  await assert.rejects(() => getOrCreateActivePortfolio(labGuest));
  const labAccount = await identity("account");
  await claimGuestLearning(labGuest, labAccount);
  assert.equal((await loadPortfolioLabUnlock(labAccount)).unlocked, true, "the saved account unlocks the Lab from the claimed lessons");
  console.log("PASS: claim is atomic; guests never unlock the Lab or own a portfolio; the claimed account does.");

  // 7. Concurrency: completion racing the claim never duplicates or strands a receipt.
  for (let round = 0; round < 8; round++) {
    const racer = await identity("guest"), racerAccount = await identity("account");
    const steps = lessonSteps(FIRST);
    await saveLessonProgress(racer, { lessonId: FIRST, status: "in_progress", lastPosition: 1 });
    await saveLessonProgress(racer, { lessonId: FIRST, status: "in_progress", lastPosition: steps.length - 1 }, { answer: (steps[1].blocks.find(isQuestion) as { correctOptionId: string }).correctOptionId });
    const [completion] = await Promise.allSettled([completeLesson(racer, FIRST), claimGuestLearning(racer, racerAccount)]);
    const accountAwards = (await awards(racerAccount)).filter((row) => row.lessonId === FIRST);
    assert.equal(await exists(racer), false);
    assert.equal((await db.select().from(lessonAward).where(eq(lessonAward.userId, racer))).length, 0);
    assert.equal(accountAwards.length, completion.status === "fulfilled" ? 1 : 0, "a successful completion is always claimed; a failed one leaves no receipt");
  }
  // Two accounts racing for one guest: exactly one gets the learning.
  const contested = await identity("guest"), first = await identity("account"), second = await identity("account");
  await finish(contested, FIRST);
  const results = await Promise.all([claimGuestLearning(contested, first), claimGuestLearning(contested, second)]);
  assert.equal(results.filter((result) => result.claimed).length, 1);
  assert.equal((await db.select().from(lessonAward).where(inArray(lessonAward.userId, [first, second]))).length, 1);
  console.log("PASS: completion and claim serialize on the user row lock; a guest is claimed at most once.");
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally {
  await db.delete(user).where(inArray(user.id, ids));
  process.exit(process.exitCode ?? 0);
}
