// Full migration and persistence checks run only in this explicitly disposable local database.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/investi_artifacts_qa");
assert.equal(process.env.ARTIFACTS_QA_DISPOSABLE, "1", "Explicit disposable QA opt-in required.");
const sql = postgres(url.toString(), { prepare: false, onnotice: () => {} });
const migrationDb = drizzle(sql);
const temp = await mkdtemp(join(tmpdir(), "investi-artifacts-migrations-"));
const prefix = `artifactqa_${randomUUID()}`;
const ids = ["owner", "other", "demo", "guest"].map((suffix) => `${prefix}_${suffix}`);
const [owner, other, demo, guest] = ids;
try {
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  const prior = journal.entries.filter((entry: { idx: number }) => entry.idx < 15);
  await mkdir(join(temp, "meta"));
  await writeFile(join(temp, "meta/_journal.json"), JSON.stringify({ ...journal, entries: prior }));
  for (const entry of prior) await copyFile(`drizzle/${entry.tag}.sql`, join(temp, `${entry.tag}.sql`));
  await migrate(migrationDb, { migrationsFolder: temp });
  execFileSync("npm", ["run", "db:seed"], { stdio: "pipe", env: process.env });
  for (const id of ids) await sql`insert into "user" (id, name, email, is_anonymous, anonymous_kind, created_at, updated_at)
    values (${id}, 'Artifact QA', ${`${id}@example.com`}, ${id === demo || id === guest}, ${id === demo ? "demo" : id === guest ? "guest" : null}, now(), now())`;
  const lessonId = "foundations-why-invest";
  await sql`insert into lesson_progress (user_id,lesson_id,status,last_position,completed_at,updated_at) values (${other},${lessonId},'completed',2,'2026-10-01T10:00:00Z','2026-10-01T10:00:00Z')`;
  await sql`insert into lesson_award (user_id,lesson_id,xp,practice_capital_minor,reward_policy_version,learning_date,time_zone,awarded_at) values (${other},${lessonId},60,200000,1,'2026-10-01','UTC','2026-10-01T10:00:00Z')`;
  await sql`insert into progression_unlock (user_id,unlock_id,practice_capital_minor,reason,unlocked_at) values (${other},'PORTFOLIO_LAB',500000,'legacy','2026-10-01T10:00:00Z')`;
  const legacy = async () => ({ progress: await sql`select * from lesson_progress where user_id=${other}`, awards: await sql`select * from lesson_award where user_id=${other}`, unlocks: await sql`select * from progression_unlock where user_id=${other}` });
  const before = await legacy();
  await migrate(migrationDb, { migrationsFolder: "drizzle" });
  await migrate(migrationDb, { migrationsFolder: "drizzle" });
  assert.deepEqual(await legacy(), before, "additive migration and rerun preserve progress, receipts, access and dates");

  const { db } = await import("../src/db");
  const { saveLearnerArtifact: save, listLearnerArtifacts: list, deleteLearnerArtifact: remove, hasValidArtifact } = await import("../src/features/artifacts/repository");
  const { artifactExamples } = await import("../src/features/artifacts/test-fixtures");
  const { artifactKinds } = await import("../src/features/artifacts/schemas");
  const input = (kind: keyof typeof artifactExamples = "goal_map", sourceLessonId: string | null = lessonId) => ({ content: { kind, payload: artifactExamples[kind] }, sourceLessonId, consent: true as const, requestId: randomUUID() });
  // Runtime boundary intentionally receives untrusted inputs; invalid values are covered below too.
  const saveInput = (id: string, value: unknown) => save(id, value as Parameters<typeof save>[1]);
  const request = input();
  const first = await saveInput(owner, request);
  const retry = await Promise.all(Array.from({ length: 5 }, () => saveInput(owner, request)));
  assert.ok(retry.every((row) => row.id === first.id && row.version === 1));
  await assert.rejects(() => saveInput(owner, { ...request, sourceLessonId: null }));
  await assert.rejects(() => saveInput(owner, { ...request, content: { kind: "goal_map", payload: { goals: [] } } }));
  const edits = await Promise.all(Array.from({ length: 6 }, () => saveInput(owner, input())));
  assert.deepEqual(edits.map((row) => row.version).sort((a, b) => a - b), [2, 3, 4, 5, 6, 7]);
  assert.equal((await list(owner, "goal_map"))[0].version, 7);
  assert.equal((await sql`select * from learner_artifact where user_id=${owner} and kind='goal_map'`).length, 7);
  assert.equal((await sql`select * from learner_artifact where id=${first.id}`)[0].version, 1, "previous versions never mutate");
  const theirs = await saveInput(other, input());
  assert.equal((await list(other))[0].version, 1);
  await remove(owner, theirs.id);
  assert.equal((await list(other)).length, 1, "cross-user deletion cannot remove any revision");
  await assert.rejects(() => saveInput(guest, input()));
  await assert.rejects(() => saveInput(owner, { ...input(), consent: false }));
  assert.equal((await list(guest)).length, 0, "guest outputs are never persisted");
  await saveInput(demo, input());
  // Authored-block-bound lesson_output has its own real progression/lifecycle suite: validate-lesson-exercises.mts.
  for (const kind of artifactKinds.filter((kind) => kind !== "goal_map" && kind !== "lesson_output")) await saveInput(owner, input(kind));
  assert.equal((await list(owner)).length, artifactKinds.length - 1);

  const { readAccountExportRows, buildAccountExport, serializeAccountExport } = await import("../src/features/account/export");
  const rows = (await readAccountExportRows(db, owner))!;
  assert.equal(rows.artifacts.length, 16, "export includes every revision of every kind");
  assert.ok(rows.artifacts.every((row) => row.userId === owner));
  const exported = JSON.parse(serializeAccountExport(buildAccountExport(rows)));
  assert.equal(exported.learnerArtifacts.length, 16);
  assert.equal(exported.learnerArtifacts.find((row: { kind: string }) => row.kind === "fee_profile").payload.orderFeeMinor, "25");
  assert.ok(exported.learnerArtifacts.every((row: object) => !Object.hasOwn(row, "userId") && !Object.hasOwn(row, "requestId")));
  console.log("PASS: migration/rerun, all typed payloads, concurrent versions, retry idempotency, ownership, guest rejection and full export.");

  const { getStepDefinitions } = await import("../src/features/lessons/steps");
  const { completeLesson, saveLessonProgress } = await import("../src/features/progress/repository");
  const steps = getStepDefinitions(lessonId);
  // Isolated process only: exercise the generic extension without adding gates to published lessons.
  const gated = steps[0];
  const oldRequirement = gated.requiredArtifact;
  gated.requiredArtifact = { kind: "goal_map" };
  try {
    await remove(owner, first.id);
    assert.equal((await list(owner, "goal_map")).length, 0, "deleting an older revision removes all versions");
    await remove(owner, first.id); // Safe retry.
    const move = () => saveLessonProgress(owner, { lessonId, status: "in_progress", lastPosition: 1 });
    await assert.rejects(move);
    await saveInput(owner, input("goal_map", "returns-simple-returns"));
    await assert.rejects(move, "an artifact from a different lesson does not pass the default requirement");
    const valid = await saveInput(owner, input());
    await move();
    await sql`update lesson_progress set last_position=${steps.length - 1} where user_id=${owner} and lesson_id=${lessonId}`;
    await remove(owner, valid.id);
    await assert.rejects(() => completeLesson(owner, lessonId), "completion rechecks outputs deleted after the step");
    assert.equal((await sql`select * from lesson_award where user_id=${owner}`).length, 0);
    // Bad legacy/manual rows cannot pass solely because they exist.
    const good = await saveInput(owner, input());
    await sql`update learner_artifact set payload='{}'::jsonb where id=${good.id}`;
    assert.equal(await hasValidArtifact(db, owner, "goal_map", lessonId), false);
    await assert.rejects(() => completeLesson(owner, lessonId));
    await saveInput(owner, input());
    assert.equal((await completeLesson(owner, lessonId)).xpAwarded, 60);
    assert.equal((await completeLesson(owner, lessonId)).xpAwarded, 0);
    const completedBefore = await sql`select * from lesson_progress where user_id=${owner}`;
    await remove(owner, (await list(owner, "goal_map"))[0].id);
    assert.equal((await completeLesson(owner, lessonId)).xpAwarded, 0, "deletion never revokes lifetime completion");
    assert.deepEqual(await sql`select * from lesson_progress where user_id=${owner}`, completedBefore);
    await completeLesson(other, lessonId);
    assert.deepEqual(await legacy(), before, "review preserves original receipts, dates and access");
  } finally { gated.requiredArtifact = oldRequirement; }
  await sql`delete from "user" where id=${demo}`;
  assert.equal((await sql`select * from learner_artifact where user_id=${demo}`).length, 0, "demo deletion cascades");
  await sql`delete from "user" where id=${owner}`;
  assert.equal((await sql`select * from learner_artifact where user_id=${owner}`).length, 0, "account deletion cascades every kind and revision");
  assert.equal((await list(other)).length, 1, "another learner's artifact remains");
  console.log("PASS: server-side step/completion requirements, invalid/missing/deleted output rejection, lifetime rewards preserved, account/demo cascades.");
} finally {
  await sql`delete from "user" where id in ${sql(ids)}`;
  await sql.end();
  await rm(temp, { recursive: true, force: true });
  const client = (globalThis as unknown as { client?: { end: () => Promise<void> } }).client;
  await client?.end();
}
