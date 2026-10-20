import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { lessonAward, lessonProgress, user } from "../src/db/schema";
import { completeLesson, markLessonInProgress, saveLessonProgress } from "../src/features/progress/repository";
import { lessonSteps } from "../src/features/progress/transition";
import { isQuestion } from "../src/features/lessons/question-evaluation";
import { loadPracticeCapitalSummary } from "../src/features/rewards/repository";

assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname), "Requires a local test database.");
const userId = `log_returns_qa_${randomUUID()}`;
const lessonId = "returns-log-returns";
const where = and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId));
const progress = () => db.select().from(lessonProgress).where(where);
const awards = () => db.select().from(lessonAward).where(eq(lessonAward.userId, userId));
try {
  await db.insert(user).values({ id: userId, email: `${userId}@example.com`, name: "Log returns QA", createdAt: new Date(), updatedAt: new Date() });
  // Preserve a legitimate historical receipt alongside a new v2 completion.
  await db.insert(lessonProgress).values({ userId, lessonId: "returns-comparing", status: "completed", lastPosition: 7, completedAt: new Date(), updatedAt: new Date() });
  await db.insert(lessonAward).values({ userId, lessonId: "returns-comparing", xp: 60, practiceCapitalMinor: 200_000n, rewardPolicyVersion: 1, learningDate: "2026-09-29", timeZone: "Europe/Prague", awardedAt: new Date() });
  const previousAwards = await awards();
  const previousProgress = await db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, "returns-comparing")));
  await markLessonInProgress(userId, lessonId);
  await assert.rejects(() => completeLesson(userId, lessonId));
  await assert.rejects(() => saveLessonProgress(userId, { lessonId, status: "in_progress", lastPosition: 7 }));
  await assert.rejects(() => saveLessonProgress(userId, { lessonId: "foundations-checkpoint", status: "in_progress", lastPosition: 0 }));
  const steps = lessonSteps(lessonId);
  for (let step = 0; step < steps.length - 1; step++) {
    const question = steps[step].blocks.find(isQuestion);
    if (question) {
      await assert.rejects(() => saveLessonProgress(userId, { lessonId, status: "in_progress", lastPosition: step + 1 }, { answer: "wrong" }));
      assert.equal((await progress())[0].lastPosition, step, "wrong answer preserves the cursor");
    }
    const answers = question?.type === "multipleChoiceQuestion" ? { answer: question.correctOptionId } : question?.type === "numericQuestion" ? { answer: String(question.answer) } : undefined;
    await saveLessonProgress(userId, { lessonId, status: "in_progress", lastPosition: step + 1 }, answers);
  }
  const results = await Promise.all([completeLesson(userId, lessonId), completeLesson(userId, lessonId)]);
  assert.equal(results.reduce((sum, result) => sum + result.xpAwarded, 0), 60, "concurrent completion grants XP once");
  assert.equal(results.reduce((sum, result) => sum + result.practiceCapitalAwardedMinor, 0n), 200_000n, "concurrent completion grants 2,000 Kč once");
  assert.ok(results.every((result) => !result.nextHref.includes("checkpoint")));
  const receipts = await awards();
  assert.equal(receipts.length, 2);
  assert.deepEqual(receipts.find((award) => award.lessonId === "returns-comparing"), previousAwards[0]);
  assert.equal(receipts.find((award) => award.lessonId === lessonId)?.rewardPolicyVersion, 3);
  assert.equal(receipts.find((award) => award.lessonId === lessonId)?.practiceCapitalMinor, 200_000n);
  const completed = await progress();
  assert.equal(completed[0].status, "completed");
  assert.equal((await loadPracticeCapitalSummary(userId)).earnedPracticeCapitalMinor, 400_000n, "legacy v1 receipt plus the new v3 lesson reward");
  await markLessonInProgress(userId, lessonId);
  await saveLessonProgress(userId, { lessonId, status: "in_progress", lastPosition: 0 });
  const replay = await completeLesson(userId, lessonId);
  assert.equal(replay.xpAwarded, 0);
  assert.equal(replay.practiceCapitalAwardedMinor, 0n);
  assert.deepEqual(await progress(), completed, "review preserves completion, timestamps and cursor");
  assert.deepEqual(await awards(), receipts, "review preserves receipts");
  assert.deepEqual(await db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, "returns-comparing"))), previousProgress);
  console.log("PASS: L5 persisted gates, concurrent one-time 60 XP + 2,000 Kč v3 completion, replay, legacy receipt and L4 preservation, planned lesson rejection.");
} finally {
  await db.delete(user).where(eq(user.id, userId));
  const client = (globalThis as unknown as { client?: { end: () => Promise<void> } }).client;
  if (client) await client.end();
}
