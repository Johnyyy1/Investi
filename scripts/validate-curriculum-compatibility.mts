import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { seedCurriculum } from "../src/db/curriculum";
import { lesson, lessonAward, lessonProgress, progressionUnlock, user } from "../src/db/schema";
import { FOUNDATIONS_MODULE_ID } from "../src/features/lessons/foundations/manifest";
import { getStepDefinitions } from "../src/features/lessons/returns/guided-flow";
import { completeLesson, markLessonInProgress, saveLessonProgress } from "../src/features/progress/repository";
import { correctAnswers } from "../src/features/progress/test-fixtures";
import { lessonSteps } from "../src/features/progress/transition";
import { isQuestion } from "../src/features/lessons/question-evaluation";
import { loadPortfolioLabUnlock } from "../src/features/progression/repository";
import { evaluateUnlock, PORTFOLIO_LAB_UNLOCK_ID, progressionUnlocks } from "../src/features/progression/unlocks";
import { loadPracticeCapitalSummary } from "../src/features/rewards/repository";

assert.equal(process.env.CURRICULUM_QA_DISPOSABLE, "1", "Requires an explicitly disposable database.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname));
const ids: string[] = [];
const extraIds = Array.from({ length: 3 }, () => `qa-foundations-${randomUUID()}`);
const lessonId = "foundations-why-invest";
const steps = getStepDefinitions(lessonId) as { title: string; blocks: readonly string[] }[];
const originalSteps = [...steps];
const oldFinal = steps.length - 1;
const required = progressionUnlocks.PORTFOLIO_LAB.prerequisiteLessonIds;
const where = (id: string) => and(eq(lessonProgress.userId, id), eq(lessonProgress.lessonId, lessonId));
const awardsOf = (id: string) => db.select().from(lessonAward).where(eq(lessonAward.userId, id)).orderBy(asc(lessonAward.lessonId));
const progressOf = (id: string) => db.select().from(lessonProgress).where(eq(lessonProgress.userId, id)).orderBy(asc(lessonProgress.lessonId));
async function owner() {
  const id = `curriculum_${randomUUID()}`;
  ids.push(id);
  await db.insert(user).values({ id, name: "Curriculum QA", email: `${id}@example.com`, isAnonymous: false, createdAt: new Date(), updatedAt: new Date() });
  return id;
}

try {
  const learner = await owner(), partial = await owner(), atSummary = await owner(), recorded = await owner();
  const historical = new Date("2026-09-09T12:00:00Z");
  for (const [index, id] of [...required, "returns-checkpoint"].entries()) {
    await db.insert(lessonProgress).values({ userId: learner, lessonId: id, status: "completed", lastPosition: lessonSteps(id).length - 1, completedAt: historical, updatedAt: historical });
    await db.insert(lessonAward).values({ userId: learner, lessonId: id, xp: 60, practiceCapitalMinor: index === 0 ? 200_000n : 0n, rewardPolicyVersion: index === 0 ? 1 : index === 1 || id === "returns-checkpoint" ? 2 : 3, learningDate: "2026-09-09", timeZone: "UTC", awardedAt: historical });
  }
  await db.insert(progressionUnlock).values({ userId: recorded, unlockId: PORTFOLIO_LAB_UNLOCK_ID, practiceCapitalMinor: 500_000n, reason: "learning_requirements", unlockedAt: historical });
  await db.insert(lessonProgress).values([
    { userId: partial, lessonId, status: "in_progress", lastPosition: 1, updatedAt: historical },
    { userId: atSummary, lessonId, status: "in_progress", lastPosition: oldFinal, updatedAt: historical },
  ]);
  const before = { awards: await awardsOf(learner), progress: await progressOf(learner), capital: await loadPracticeCapitalSummary(learner), partial: await progressOf(partial), summary: await progressOf(atSummary) };
  assert.equal(evaluateUnlock(PORTFOLIO_LAB_UNLOCK_ID, { totalXp: 420, completedLessonIds: new Set(required) }).unlocked, true);

  // Simulate publication and a compatible content deployment without changing production lessons.
  await db.insert(lesson).values(extraIds.map((id, index) => ({ id, moduleId: FOUNDATIONS_MODULE_ID, slug: id, title: "Future Foundations lesson", summary: "QA only", position: 100 + index, estimatedMinutes: 5, isPublished: true, createdAt: historical, updatedAt: historical })));
  steps.splice(-1, 0, { title: "Additional explanation", blocks: ["saving"] });
  await seedCurriculum(db);
  await seedCurriculum(db);
  assert.deepEqual(await awardsOf(learner), before.awards, "seeding never rewrites v1/v2/v3 receipts or XP");
  assert.deepEqual(await progressOf(learner), before.progress, "completed lessons and checkpoint retain status, cursor and dates");
  assert.deepEqual(await progressOf(partial), before.partial, "the earlier saved cursor is unchanged");
  assert.deepEqual(await progressOf(atSummary), before.summary, "the old final cursor is unchanged");
  assert.deepEqual(await loadPracticeCapitalSummary(learner), before.capital);

  const unlocks = await Promise.all(Array.from({ length: 4 }, () => loadPortfolioLabUnlock(learner)));
  assert.ok(unlocks.every((unlock) => unlock.unlocked));
  assert.equal(unlocks.reduce((sum, unlock) => sum + unlock.capitalAwardedMinor, 0n), 500_000n, "new lessons do not block the original one-time grant, including concurrent requests");
  const grants = await db.select().from(progressionUnlock).where(eq(progressionUnlock.userId, learner));
  assert.equal(grants.length, 1);
  assert.equal((await loadPortfolioLabUnlock(recorded)).capitalAwardedMinor, 0n);
  assert.equal((await loadPortfolioLabUnlock(recorded)).unlocked, true, "a recorded unlock survives even without current learning prerequisites");
  assert.equal((await loadPracticeCapitalSummary(recorded)).earnedPracticeCapitalMinor, 500_000n);

  await markLessonInProgress(learner, lessonId);
  await saveLessonProgress(learner, { lessonId, status: "in_progress", lastPosition: 0 });
  for (const id of [lessonId, "returns-checkpoint"]) {
    const review = await completeLesson(learner, id);
    assert.equal(review.xpAwarded, 0);
    assert.equal(review.practiceCapitalAwardedMinor, 0n);
  }
  assert.deepEqual(await progressOf(learner), before.progress, "review after content growth cannot revoke completion");
  assert.deepEqual(await awardsOf(learner), before.awards, "review cannot recalculate historical awards");
  assert.equal((await loadPracticeCapitalSummary(learner)).earnedPracticeCapitalMinor, before.capital.earnedPracticeCapitalMinor + 500_000n, "only the legitimate unlock grant adds capital");

  await assert.rejects(() => completeLesson(partial, lessonId));
  await assert.rejects(() => saveLessonProgress(partial, { lessonId, status: "in_progress", lastPosition: 2 }), "the original graded question is still required");
  const question = lessonSteps(lessonId)[1].blocks.find(isQuestion)!;
  await saveLessonProgress(partial, { lessonId, status: "in_progress", lastPosition: 2 }, correctAnswers(question));
  for (const id of [partial, atSummary]) {
    await assert.rejects(() => completeLesson(id, lessonId), "the old final cursor now visits the new explanatory step");
    await saveLessonProgress(id, { lessonId, status: "in_progress", lastPosition: oldFinal + 1 });
    const reward = await completeLesson(id, lessonId);
    assert.equal(reward.xpAwarded, 60);
    assert.equal(reward.practiceCapitalAwardedMinor, 0n);
  }
  assert.equal((await db.select().from(lessonProgress).where(where(partial)))[0].status, "completed");
  console.log("PASS: curriculum growth preserves identity, cursors, completion/checkpoints and v1/v2/v3 receipts; safe step insertion preserves grading; original and recorded unlocks survive, with one concurrent grant.");
} finally {
  steps.splice(0, steps.length, ...originalSteps);
  for (const id of ids) await db.delete(user).where(eq(user.id, id));
  await db.delete(lesson).where(inArray(lesson.id, extraIds));
  const client = (globalThis as unknown as { client?: { end: () => Promise<void> } }).client;
  if (client) await client.end();
}
