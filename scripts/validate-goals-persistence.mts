import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { db } from "../src/db";
import { seedCurriculum } from "../src/db/curriculum";
import { completeLesson, markLessonInProgress, saveLessonProgress } from "../src/features/progress/repository";
import { lessonSteps } from "../src/features/progress/transition";
import { correctAnswers, wrongAnswers } from "../src/features/lessons/answer-keys";
import { isQuestion } from "../src/features/lessons/question-evaluation";
import { saveLearnerArtifact, deleteLearnerArtifact } from "../src/features/artifacts/repository";
import { readAccountExportRows, buildAccountExport, serializeAccountExport } from "../src/features/account/export";
import { goalMapFromDraft, emptyGoal, GOALS_LESSON_ID as lessonId } from "../src/features/lessons/before-investing/goals-model";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/investi_artifacts_qa");
assert.equal(process.env.ARTIFACTS_QA_DISPOSABLE, "1");
const sql = postgres(url.toString(), { prepare: false });
const ids = [randomUUID(), randomUUID()];
const [owner, other] = ids;
const steps = lessonSteps(lessonId);
const mapStep = steps.findIndex((step) => step.requiredArtifact?.kind === "goal_map");
const payload = goalMapFromDraft([{ ...emptyGoal(), label: "Modelové bydlení", year: "2033", amount: "300000,25" }], false, 2026);
const input = (sourceLessonId: string = lessonId) => ({ content: { kind: "goal_map" as const, payload }, sourceLessonId, consent: true as const, requestId: randomUUID() });
try {
  await seedCurriculum(db);
  for (const id of ids) await sql`insert into "user" (id,name,email,created_at,updated_at) values (${id},'Goals QA',${`${id}@example.com`},now(),now())`;
  await markLessonInProgress(owner, lessonId);
  for (let position = 0; position < mapStep; position++) {
    const question = steps[position].blocks.find(isQuestion);
    const move = (answers?: Record<string, string>) => saveLessonProgress(owner, { lessonId, status: "in_progress", lastPosition: position + 1 }, answers);
    if (question) await assert.rejects(() => move(wrongAnswers(question)));
    await move(question ? correctAnswers(question) : {});
  }
  const movePastMap = () => saveLessonProgress(owner, { lessonId, status: "in_progress", lastPosition: mapStep + 1 });
  await assert.rejects(movePastMap, /ulož/);
  await saveLearnerArtifact(other, input());
  await assert.rejects(movePastMap, /ulož/, "another owner cannot satisfy the gate");
  await saveLearnerArtifact(owner, input("before-investing-budget"));
  await assert.rejects(movePastMap, /ulož/, "wrong source cannot satisfy the gate");
  const request = input();
  const saved = await Promise.all(Array.from({ length: 4 }, () => saveLearnerArtifact(owner, request)));
  assert.ok(saved.every((entry) => entry.id === saved[0].id && entry.version === 2));
  await movePastMap();
  const exported = JSON.parse(serializeAccountExport(buildAccountExport((await readAccountExportRows(db, owner))!)));
  assert.equal(exported.learnerArtifacts.length, 2);
  assert.equal(exported.learnerArtifacts[0].payload.goals[0].amountMinor, "30000025");
  await deleteLearnerArtifact(owner, saved[0].id);
  await assert.rejects(() => completeLesson(owner, lessonId), /ulož/, "completion rechecks deletion after passing the step");
  const skip = await saveLearnerArtifact(owner, { ...input(), content: { kind: "goal_map", payload: { goals: [], noSpecificGoal: true } } });
  assert.equal((await completeLesson(owner, lessonId)).xpAwarded, 60);
  const before = await sql`select * from lesson_progress where user_id=${owner} and lesson_id=${lessonId}`;
  await deleteLearnerArtifact(owner, skip.id);
  assert.equal((await completeLesson(owner, lessonId)).xpAwarded, 0);
  assert.deepEqual(await sql`select * from lesson_progress where user_id=${owner} and lesson_id=${lessonId}`, before);
  const receipt = await sql`select xp,practice_capital_minor::text,reward_policy_version from lesson_award where user_id=${owner}`;
  assert.deepEqual(receipt.map((entry) => ({ ...entry })), [{ xp: 60, practice_capital_minor: "0", reward_policy_version: 4 }]);
  assert.equal((await sql`select * from progression_unlock where user_id=${owner}`).length, 0);
  console.log("PASS: real goals lesson gates, wrong answers/source/owner, concurrent retries, exact export, explicit skip, deleted-output completion check, lifetime completion and XP-only receipt.");
} finally {
  await sql`delete from "user" where id in ${sql(ids)}`;
  await sql.end();
  await (globalThis as unknown as { client?: { end: () => Promise<void> } }).client?.end();
}
