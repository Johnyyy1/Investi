// Skill mastery (#122) on a disposable local database: append-only attempts, request idempotency under
// concurrency, checkpoint → review contexts, derived levels, guest claim, export and account cascade.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { lessonAward, lessonProgress, skillAttempt, user } from "../src/db/schema";
import { buildAccountExport, readAccountExportRows, serializeAccountExport } from "../src/features/account/export";
import { claimGuestLearning } from "../src/features/guest/repository";
import { getSkillItem } from "../src/features/mastery/domain";
import { loadSkillLevels, recordSkillAttempt } from "../src/features/mastery/repository";

assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname), "Requires a disposable local DB.");
assert.equal(process.env.MASTERY_QA_DISPOSABLE, "1");
const prefix = `masteryqa_${randomUUID().replaceAll("-", "")}`;
const ids: string[] = [];
async function identity(kind: "guest" | "account") {
  const id = `${prefix}_${ids.length}`; ids.push(id);
  await db.insert(user).values({ id, email: `${id}@example.com`, name: "Mastery QA", isAnonymous: kind === "guest", anonymousKind: kind === "guest" ? "guest" : null, createdAt: new Date(), updatedAt: new Date() });
  return id;
}
const position = getSkillItem("foundations-stocks/mastery-position")!;
const ownership = getSkillItem("foundations-stocks/mastery-intrinsic")!;
const rows = (userId: string) => db.select().from(skillAttempt).where(eq(skillAttempt.userId, userId)).orderBy(skillAttempt.attemptedAt);

try {
  const owner = await identity("account");
  const other = await identity("account");

  // A retried request lands once, even when the retries race; the first verdict wins.
  const requestId = randomUUID();
  const raced = await Promise.all(Array.from({ length: 6 }, (_, index) => recordSkillAttempt(owner, { requestId, item: position, correct: index === 0, mode: "lesson" })));
  assert.equal((await rows(owner)).length, 1);
  assert.equal(new Set(raced.map((stored) => stored.correct)).size, 1);
  // The same request ID belongs to each user separately.
  await recordSkillAttempt(other, { requestId, item: position, correct: false, mode: "lesson" });
  assert.equal((await rows(other)).length, 1);
  console.log("PASS: concurrent retries of one request store one attempt per user.");

  // Checkpoint answers become reviews once the skill is Zvládnuté; concurrent answers serialize on the account lock.
  const t0 = new Date("2026-10-01T10:00:00Z");
  const day = (days: number) => new Date(t0.getTime() + days * 86_400_000);
  await recordSkillAttempt(owner, { requestId: randomUUID(), item: ownership, correct: true, mode: "lesson", now: day(0) });
  await Promise.all([1, 2, 3].map(() => recordSkillAttempt(owner, { requestId: randomUUID(), item: ownership, correct: true, mode: "checkpoint", now: day(1) })));
  const contexts = (await rows(owner)).filter((row) => row.skillId === "stock-ownership").map((row) => row.context).sort();
  assert.deepEqual(contexts, ["checkpoint", "lesson", "review", "review"]);
  assert.equal((await loadSkillLevels(owner))["stock-ownership"], 3);
  await recordSkillAttempt(owner, { requestId: randomUUID(), item: ownership, correct: true, mode: "checkpoint", now: day(9) });
  assert.equal((await loadSkillLevels(owner))["stock-ownership"], 4);
  const wrong = await recordSkillAttempt(owner, { requestId: randomUUID(), item: ownership, correct: false, mode: "checkpoint", now: day(10) });
  assert.equal(wrong.context, "review");
  assert.equal((await loadSkillLevels(owner))["stock-ownership"], 3);
  console.log("PASS: checkpoint → review contexts under concurrency, Ovládnuté after 7 days, a wrong review lowers one level.");

  // Completed lessons count as Známé without any attempt; attempts never touch progress or receipts.
  await db.insert(lessonProgress).values({ userId: other, lessonId: "foundations-markets", status: "completed", lastPosition: 0, completedAt: new Date(), updatedAt: new Date() });
  const levels = await loadSkillLevels(other);
  assert.equal(levels["bid-ask-spread"], 2);
  assert.equal(levels["position-value"], 1);
  assert.equal(levels["diversification"], 0);
  assert.equal((await db.select().from(lessonAward).where(inArray(lessonAward.userId, [owner, other]))).length, 0);
  assert.equal((await db.select().from(lessonProgress).where(eq(lessonProgress.userId, owner))).length, 0);
  console.log("PASS: completion counts as Známé without a backfill; attempts write no progress or rewards.");

  const exported = JSON.parse(serializeAccountExport(buildAccountExport((await readAccountExportRows(db, owner))!)));
  assert.equal(exported.skillAttempts.length, (await rows(owner)).length);
  assert.deepEqual(Object.keys(exported.skillAttempts[0]).sort(), ["attemptedAt", "context", "correct", "itemId", "skillId"]);
  console.log("PASS: account export lists every attempt without internal keys.");

  // A claimed guest adds its attempts to the account with their original times.
  const guest = await identity("guest");
  const account = await identity("account");
  await recordSkillAttempt(guest, { requestId: randomUUID(), item: position, correct: true, mode: "checkpoint", now: day(2) });
  await recordSkillAttempt(account, { requestId: randomUUID(), item: position, correct: false, mode: "lesson", now: day(3) });
  await claimGuestLearning(guest, account);
  assert.deepEqual((await rows(account)).map((row) => [row.context, row.correct, row.attemptedAt.toISOString()]), [["checkpoint", true, day(2).toISOString()], ["lesson", false, day(3).toISOString()]]);
  assert.equal((await rows(guest)).length, 0);
  console.log("PASS: guest claim moves attempts with original times; the guest is gone.");

  await db.delete(user).where(eq(user.id, owner));
  assert.equal((await rows(owner)).length, 0);
  assert.equal((await rows(other)).length, 1);
  console.log("PASS: deleting an account deletes its attempts only.");
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally {
  await db.delete(user).where(inArray(user.id, ids));
  process.exit(process.exitCode ?? 0);
}
