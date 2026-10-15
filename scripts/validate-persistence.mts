import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { learningProfile, lessonAward, lessonProgress, user } from "../src/db/schema";
import { ensureDemoSeed } from "../src/features/demo/repository";
import { completeLesson, saveLessonProgress } from "../src/features/progress/repository";
import { lessonSteps } from "../src/features/progress/transition";
import { quickStart } from "../src/features/onboarding/repository";
import { initializeTimeZone } from "../src/features/gamification/repository";
import { loadPracticeCapitalSummary } from "../src/features/rewards/repository";
import postgres from "postgres";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname), "Requires local DB.");
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const ids: string[] = [];
const prefix = `qa_${randomUUID().replaceAll("-", "")}`;
let constraint: string | undefined;
async function owner(isAnonymous: boolean) {
  const id = `${prefix}_${ids.length}`; ids.push(id);
  await db.insert(user).values({ id, email: `${id}@example.com`, name: "Persistence QA", isAnonymous, createdAt: new Date(), updatedAt: new Date() });
  return id;
}
try {
  const a = await owner(true), b = await owner(true), normal = await owner(false), failing = await owner(true);
  const now = new Date("2026-09-09T12:00:00Z");
  await Promise.all([ensureDemoSeed(a, now), ensureDemoSeed(a, now), ensureDemoSeed(b, now)]);
  const getAwards = (id: string) => db.select().from(lessonAward).where(eq(lessonAward.userId, id));
  assert.equal((await getAwards(a)).length, 6);
  // Policy v3: the five Foundations receipts are XP only; the seeded Returns lesson carries 2,000 Kč.
  assert.equal((await loadPracticeCapitalSummary(a)).earnedPracticeCapitalMinor, 200_000n);
  assert.ok((await getAwards(a)).every((award) => award.rewardPolicyVersion === 3 && award.practiceCapitalMinor === (award.lessonId.startsWith("returns-") ? 200_000n : 0n)));
  await assert.rejects(() => ensureDemoSeed(normal, now));
  assert.equal((await getAwards(normal)).length, 0);
  constraint = `${prefix}_failure`;
  await sql.unsafe(`ALTER TABLE lesson_award ADD CONSTRAINT "${constraint}" CHECK (user_id <> '${failing}') NOT VALID`);
  await assert.rejects(() => ensureDemoSeed(failing, now));
  assert.equal((await db.select().from(learningProfile).where(eq(learningProfile.userId, failing))).length, 0);
  assert.equal((await db.select().from(lessonProgress).where(eq(lessonProgress.userId, failing))).length, 0);
  await sql.unsafe(`ALTER TABLE lesson_award DROP CONSTRAINT "${constraint}"`); constraint = undefined;
  await ensureDemoSeed(failing, now);
  assert.equal((await getAwards(failing)).length, 6);
  // Direct repository callers cannot skip to a reward or jump from opening to final step.
  await assert.rejects(() => completeLesson(normal, "foundations-why-invest"));
  await assert.rejects(() => saveLessonProgress(normal, { lessonId: "foundations-why-invest", status: "in_progress", lastPosition: 8 }));
  await assert.rejects(() => saveLessonProgress(normal, { lessonId: "foundations-why-invest", status: "completed", lastPosition: 8 }));
  await db.update(lessonProgress).set({ lastPosition: lessonSteps("foundations-risk-reward").length - 1 }).where(and(eq(lessonProgress.userId, a), eq(lessonProgress.lessonId, "foundations-risk-reward")));
  const [one, two] = await Promise.all([completeLesson(a, "foundations-risk-reward"), completeLesson(a, "foundations-risk-reward")]);
  assert.equal(one.xpAwarded + two.xpAwarded, 60);
  assert.equal(one.practiceCapitalAwardedMinor + two.practiceCapitalAwardedMinor, BigInt(0));
  assert.equal((await loadPracticeCapitalSummary(a)).earnedPracticeCapitalMinor, 700_000n, "concurrent demo completion grants demo access once (5,000 Kč) beside the seeded Returns reward (2,000 Kč); the Foundations lesson adds none");
  assert.equal((await getAwards(a)).length, 7);
  assert.equal((await getAwards(b)).length, 6);
  assert.equal((await loadPracticeCapitalSummary(b)).earnedPracticeCapitalMinor, 200_000n, "a new demo carries only its seeded Returns reward until demo access is recorded");
  const [completedBeforeReview] = await db.select().from(lessonProgress).where(eq(lessonProgress.userId, a));
  const capitalBeforeReview = (await loadPracticeCapitalSummary(a)).earnedPracticeCapitalMinor;
  const review = await completeLesson(a, completedBeforeReview.lessonId);
  assert.equal(review.xpAwarded, 0);
  assert.equal((await loadPracticeCapitalSummary(a)).earnedPracticeCapitalMinor, capitalBeforeReview, "review awards no capital");
  const [completedAfterReview] = await db.select().from(lessonProgress).where(eq(lessonProgress.userId, a));
  assert.equal(completedAfterReview.completedAt?.getTime(), completedBeforeReview.completedAt?.getTime(), "review preserves completedAt");
  await ensureDemoSeed(a, now);
  assert.equal((await getAwards(a)).length, 7, "re-initialization preserves mutation");
  const previous = await db.select().from(learningProfile).where(eq(learningProfile.userId, b));
  await quickStart(b, { experienceLevel: "ADVANCED", timeZone: "America/New_York" });
  await initializeTimeZone(b, "Asia/Tokyo");
  assert.deepEqual(await db.select().from(learningProfile).where(eq(learningProfile.userId, b)), previous, "stale onboarding and device timezone cannot overwrite completed preferences");
  await quickStart(normal, { experienceLevel: "BEGINNER", timeZone: "Europe/Prague" });
  const [profile] = await db.select().from(learningProfile).where(eq(learningProfile.userId, normal));
  assert.deepEqual(profile.goals, []); assert.deepEqual(profile.interests, []);
  assert.equal(profile.timeZone, "Europe/Prague");
  console.log("PASS: real DB atomic policy-v3 receipts, review and concurrent idempotence, completedAt preservation, demo ownership/isolation, concurrent seed idempotence, seed rollback/retry, server progression validation, stale onboarding protection, pinned timezone.");
} finally {
  if (constraint) await sql.unsafe(`ALTER TABLE lesson_award DROP CONSTRAINT IF EXISTS "${constraint}"`);
  for (const id of ids) await db.delete(user).where(eq(user.id, id));
  await sql.end();
  // db's pool is intentionally retained by Next in application code; close this isolated validation process.
  process.exitCode ??= 0;
  const client = (globalThis as unknown as { client: { end: () => Promise<void> } }).client;
  if (client) await client.end();
}
