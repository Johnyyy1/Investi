// Isolated process + explicitly disposable loopback DB. Never edit published curriculum on disk.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { StepDefinition } from "../src/features/lessons/types";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/investi_artifacts_qa");
assert.equal(process.env.ARTIFACTS_QA_DISPOSABLE, "1");
const sql = postgres(url.toString(), { prepare: false, onnotice: () => {} });
await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
const ids = ["owner", "other", "guest", "demo"].map((suffix) => `exercises_${randomUUID()}_${suffix}`);
const [owner, other, guest, demo] = ids;
const { authoredLessons } = await import("../src/features/lessons/registry");
const { getStepDefinitions } = await import("../src/features/lessons/steps");
const { exercisePreviewBlocks, exercisePreviewSteps, gradedExercises, checklistExercise, rubricExercise } = await import("../src/features/lessons/exercise-fixtures");
const { correctAnswers, wrongAnswers } = await import("../src/features/progress/test-fixtures");
const lesson = authoredLessons.find((item) => item.id === "foundations-why-invest")!;
const originalBlocks = lesson.blocks;
const definitions = getStepDefinitions(lesson.id) as StepDefinition[];
const originalSteps = [...definitions];
lesson.blocks = exercisePreviewBlocks;
definitions.splice(0, definitions.length, ...exercisePreviewSteps);
try {
  for (const id of ids) await sql`insert into "user" (id,name,email,is_anonymous,anonymous_kind,created_at,updated_at) values (${id},'Exercises QA',${`${id}@example.com`},${id === guest || id === demo},${id === guest ? "guest" : id === demo ? "demo" : null},now(),now())`;
  const { db } = await import("../src/db");
  const { saveLessonProgress: move, completeLesson } = await import("../src/features/progress/repository");
  const { saveLearnerArtifact: save, listLearnerArtifacts: list, deleteLearnerArtifact: remove, hasValidArtifact } = await import("../src/features/artifacts/repository");
  const saveOutput = (userId: string, payload: unknown, sourceLessonId: string | null = lesson.id, requestId = randomUUID()) => save(userId, { content: { kind: "lesson_output", payload }, sourceLessonId, consent: true, requestId } as Parameters<typeof save>[1]);
  const advance = (position: number, answers?: Record<string, string>) => move(owner, { lessonId: lesson.id, status: "in_progress", lastPosition: position }, answers);
  for (const [index, question] of gradedExercises.entries()) {
    for (const answers of [{}, wrongAnswers(question), { ...correctAnswers(question), forged: "yes" }]) {
      await assert.rejects(() => advance(index + 1, answers));
      assert.equal((await sql`select last_position from lesson_progress where user_id=${owner}`)[0]?.last_position ?? 0, index);
    }
    await assert.rejects(() => advance(index + 2, correctAnswers(question)), "no jumping over an unchecked step");
    await advance(index + 1, correctAnswers(question));
  }
  // Decision tree + blank checklist both allow continuation without persistence.
  await advance(6); await advance(7);
  await assert.rejects(() => advance(8, { submitted: "true" }), "client flags cannot stand in for an output");
  const checklist = { type: "checklist", blockId: checklistExercise.id, checkedItemIds: [] };
  const rubric = { type: "rubricSelfAssessment", blockId: rubricExercise.id, text: "Před rozhodnutím ověřím svůj plán.", ratings: [{ criterionId: "specific", level: 1 }] };
  const requestId = randomUUID();
  const first = await saveOutput(owner, checklist, lesson.id, requestId);
  const retries = await Promise.all(Array.from({ length: 4 }, () => saveOutput(owner, checklist, lesson.id, requestId)));
  assert.ok(retries.every((item) => item.id === first.id));
  await saveOutput(other, rubric);
  await saveOutput(demo, checklist);
  await assert.rejects(() => saveOutput(guest, checklist));
  for (const invalid of [{ ...rubric, ratings: [] }, { ...rubric, ratings: [{ criterionId: "forged", level: 4 }] }, { ...rubric, text: " " }, { ...rubric, ratings: [{ criterionId: "specific", level: 5 }] }, { ...rubric, blockId: checklistExercise.id }]) await assert.rejects(() => saveOutput(owner, invalid));
  await assert.rejects(() => saveOutput(owner, rubric, "returns-simple-returns"));
  await assert.rejects(() => advance(8), "another user's artifact and own checklist cannot satisfy rubric");
  const submitted = await saveOutput(owner, rubric);
  assert.equal(await hasValidArtifact(db, owner, "lesson_output", lesson.id, rubricExercise.id), true);
  await advance(8); // Lowest self-rating is a valid submission, not a failure.
  await remove(owner, first.id);
  assert.equal((await list(owner, "lesson_output")).length, 1, "deleting one block retains the other block");
  await remove(owner, submitted.id);
  await assert.rejects(() => completeLesson(owner, lesson.id), "deleted output cannot complete an unfinished lesson");
  const restored = await saveOutput(owner, rubric);
  await sql`update learner_artifact set payload=${JSON.stringify({ ...rubric, ratings: [{ criterionId: "forged", level: 4 }] })}::jsonb where id=${restored.id}`;
  await assert.rejects(() => completeLesson(owner, lesson.id), "structurally valid legacy rows still need authored criteria");
  await saveOutput(owner, rubric);
  const rewards = await Promise.all(Array.from({ length: 4 }, () => completeLesson(owner, lesson.id)));
  assert.equal(rewards.reduce((sum, result) => sum + result.xpAwarded, 0), 60);
  const before = await sql`select * from lesson_progress where user_id=${owner}`;
  await remove(owner, (await list(owner, "lesson_output"))[0].id);
  assert.equal((await completeLesson(owner, lesson.id)).xpAwarded, 0);
  assert.deepEqual(await sql`select * from lesson_progress where user_id=${owner}`, before);
  const { readAccountExportRows, buildAccountExport, serializeAccountExport } = await import("../src/features/account/export");
  await saveOutput(owner, checklist); await saveOutput(owner, rubric);
  const exported = JSON.parse(serializeAccountExport(buildAccountExport((await readAccountExportRows(db, owner))!)));
  assert.equal(exported.learnerArtifacts.length, 2);
  assert.ok(exported.learnerArtifacts.some((item: { payload: { text?: string } }) => item.payload.text === rubric.text));
  await sql`delete from "user" where id in ${sql([owner, demo])}`;
  assert.equal((await sql`select * from learner_artifact where user_id in ${sql([owner, demo])}`).length, 0);
  assert.equal((await list(other)).length, 1);
  console.log("PASS: new graded steps, limits, rubric ownership/source/criteria, low-rating submission, retry/concurrent reward safety, scoped deletion, export and cascades.");
} finally {
  lesson.blocks = originalBlocks; definitions.splice(0, definitions.length, ...originalSteps);
  await sql`delete from "user" where id in ${sql(ids)}`;
  await sql.end();
  await (globalThis as unknown as { client?: { end: () => Promise<void> } }).client?.end();
}
