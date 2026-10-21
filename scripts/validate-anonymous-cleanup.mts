// Anonymous identity cleanup on a disposable local database: the session-based retention rule, grace period,
// cascades, saved accounts and shared data left alone, row locks skipped, batching and concurrent runs.
// The cleanup is global, so this refuses to run without an explicit disposable-database opt-in.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { countUnreachableAnonymousIdentities, deleteUnreachableAnonymousIdentities } from "../src/features/guest/cleanup";

const url = process.env.DATABASE_URL;
assert.ok(url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname), "Requires a disposable local DB.");
assert.equal(process.env.ANONYMOUS_CLEANUP_QA_DISPOSABLE, "1", "Set ANONYMOUS_CLEANUP_QA_DISPOSABLE=1: the cleanup deletes every eligible anonymous identity in this database.");
const sql = postgres(url, { prepare: false });
const database = drizzle({ client: sql });

const HOUR = 60 * 60 * 1000, DAY = 24 * HOUR;
const prefix = `cleanupqa_${randomUUID().replaceAll("-", "")}`;
let sequence = 0;
const ago = (ms: number) => new Date(Date.now() - ms);

type Kind = "guest" | "demo" | "legacy" | "account";
/** An identity created `age` ago whose sessions expire at the given offsets from now (negative = already expired). */
async function identity(kind: Kind, age: number, sessionExpiries: number[] = []) {
  const id = `${prefix}_${sequence++}`;
  const createdAt = ago(age).toISOString();
  await sql`insert into "user" (id, name, email, is_anonymous, anonymous_kind, created_at, updated_at)
    values (${id}, 'Cleanup QA', ${`${id}@example.com`}, ${kind !== "account"}, ${kind === "guest" || kind === "demo" ? kind : null}, ${createdAt}, ${createdAt})`;
  for (const offset of sessionExpiries) {
    await sql`insert into session (id, token, user_id, expires_at, created_at, updated_at)
      values (${randomUUID()}, ${randomUUID()}, ${id}, ${new Date(Date.now() + offset).toISOString()}, ${createdAt}, ${createdAt})`;
  }
  return id;
}
/** Learning rows that must disappear with their owner. */
async function withLearning(userId: string, lessonId: string) {
  await sql`insert into learner_artifact (id,user_id,kind,version,payload,request_id) values (${randomUUID()},${userId},'goal_map',1,'{"goals":[]}'::jsonb,${randomUUID()})`;
  await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, completed_at, updated_at) values (${userId}, ${lessonId}, 'completed', 2, now(), now())`;
  await sql`insert into lesson_award (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at)
    values (${userId}, ${lessonId}, 60, 0, 2, current_date, 'Europe/Prague', now())`;
  await sql`insert into learning_profile (user_id, onboarding_step, updated_at) values (${userId}, 6, now())`;
  await sql`insert into progression_unlock (user_id, unlock_id, practice_capital_minor, reason, unlocked_at) values (${userId}, 'PORTFOLIO_LAB', 500000, 'demo_access', now())`;
}
const exists = async (id: string) => (await sql`select 1 from "user" where id = ${id}`).length === 1;
const owned = async (id: string) => (await sql`select
  (select count(*) from session where user_id = ${id}) + (select count(*) from lesson_progress where user_id = ${id})
  + (select count(*) from lesson_award where user_id = ${id}) + (select count(*) from learning_profile where user_id = ${id})
  + (select count(*) from progression_unlock where user_id = ${id})
  + (select count(*) from learner_artifact where user_id = ${id}) as n`)[0].n;
const shared = async () => (await sql`select (select count(*) from lesson)::int as lessons, (select count(*) from learning_module)::int as modules`)[0];

try {
  const [lesson] = await sql`select id from lesson where is_published order by id limit 1`;
  assert.ok(lesson, "Run db:migrate and db:seed first.");
  // Start from a database with nothing else eligible, so later counts are exact.
  await deleteUnreachableAnonymousIdentities(database, { maxBatches: Number.POSITIVE_INFINITY });
  const sharedBefore = await shared();

  // 1. Retention follows sessions, not age.
  const activeOldGuest = await identity("guest", 30 * DAY, [-20 * DAY, 5 * DAY]); // Better Auth refreshed it while in use
  const expiredGuest = await identity("guest", 10 * DAY, [-3 * DAY]);
  const expiredDemo = await identity("demo", 3 * DAY, [-2 * DAY]);
  const legacyDemo = await identity("legacy", 40 * DAY, [-33 * DAY]);
  const graceGuest = await identity("guest", 9 * DAY, [-2 * HOUR]); // expired, but inside the grace period
  const sessionlessOld = await identity("guest", 2 * DAY);
  const sessionlessYoung = await identity("guest", 2 * HOUR); // the session may still be on its way
  const oldAccount = await identity("account", 400 * DAY, [-300 * DAY]);
  await withLearning(expiredGuest, lesson.id);
  await withLearning(expiredDemo, lesson.id);
  await withLearning(oldAccount, lesson.id);

  assert.deepEqual(await countUnreachableAnonymousIdentities(database), { demo: 2, guest: 2 });
  assert.equal(await exists(expiredGuest), true, "a dry run deletes nothing");

  // 2. A row locked by a claim or lesson completion is skipped, never waited on.
  const lockedGuest = await identity("guest", 10 * DAY, [-3 * DAY]);
  let release!: () => void, locked!: () => void;
  const holding = new Promise<void>((resolve) => { locked = resolve; });
  const lockHolder = sql.begin(async (tx) => {
    await tx`select id from "user" where id = ${lockedGuest} for update`;
    locked();
    await new Promise<void>((resolve) => { release = resolve; });
  });
  await holding;
  const first = await deleteUnreachableAnonymousIdentities(database);
  assert.deepEqual(first, { removed: { demo: 2, guest: 2 }, complete: true });
  assert.equal(await exists(lockedGuest), true, "a locked row is skipped");
  release();
  await lockHolder;

  for (const id of [expiredGuest, expiredDemo, legacyDemo, sessionlessOld]) {
    assert.equal(await exists(id), false);
    assert.equal(Number(await owned(id)), 0, "sessions, progress, receipts, profile, unlocks and artifacts cascade");
  }
  for (const id of [activeOldGuest, graceGuest, sessionlessYoung, oldAccount]) assert.equal(await exists(id), true);
  assert.equal(Number(await owned(oldAccount)), 6, "saved accounts keep everything");
  assert.deepEqual(await shared(), sharedBefore, "curriculum and other shared rows are untouched");
  console.log("PASS: only anonymous identities without a session valid in the last day are removed, with their data; active old guests, the grace period, fresh identities and saved accounts stay.");

  // 3. The skipped row goes on the next run; reruns are idempotent; time moving on releases the grace guest.
  assert.deepEqual(await deleteUnreachableAnonymousIdentities(database), { removed: { demo: 0, guest: 1 }, complete: true });
  assert.equal(await exists(lockedGuest), false);
  assert.deepEqual(await deleteUnreachableAnonymousIdentities(database), { removed: { demo: 0, guest: 0 }, complete: true });
  // A day later the grace guest and the session-less identity are unreachable; the refreshed guest is not.
  assert.deepEqual(await deleteUnreachableAnonymousIdentities(database, { now: new Date(Date.now() + DAY) }), { removed: { demo: 0, guest: 2 }, complete: true });
  assert.equal(await exists(graceGuest), false);
  assert.equal(await exists(sessionlessYoung), false);
  assert.equal(await exists(activeOldGuest), true);
  console.log("PASS: locked rows are skipped and picked up by the next run; reruns are idempotent; the grace period ends a day after expiry.");

  // 4. Bounded batches report what remains; oldest first, so the last (youngest) guest is left.
  for (let i = 0; i < 5; i++) await identity(i % 2 ? "demo" : "guest", 5 * DAY + (5 - i) * HOUR, [-2 * DAY]);
  const bounded = await deleteUnreachableAnonymousIdentities(database, { batchSize: 2, maxBatches: 2 });
  assert.equal(bounded.removed.demo + bounded.removed.guest, 4);
  assert.equal(bounded.complete, false);
  assert.deepEqual(await deleteUnreachableAnonymousIdentities(database, { batchSize: 2 }), { removed: { demo: 0, guest: 1 }, complete: true });
  console.log("PASS: a bounded run stops after its batches and reports that more remain; the next run finishes.");

  // 5. Concurrent runs split the work without errors or double counting.
  for (let i = 0; i < 12; i++) await identity(i % 3 ? "guest" : "demo", 5 * DAY, [-2 * DAY]);
  const runs = await Promise.all([1, 2, 3].map(() => deleteUnreachableAnonymousIdentities(database, { batchSize: 3 })));
  const total = runs.reduce((sum, run) => ({ demo: sum.demo + run.removed.demo, guest: sum.guest + run.removed.guest }), { demo: 0, guest: 0 });
  assert.deepEqual(total, { demo: 4, guest: 8 });
  assert.deepEqual(await countUnreachableAnonymousIdentities(database), { demo: 0, guest: 0 });
  console.log("PASS: concurrent runs remove each identity exactly once.");
} finally {
  await sql`delete from "user" where id like ${`${prefix}_%`}`;
  await sql.end();
}
