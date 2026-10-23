import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
const url = new URL(process.env.DATABASE_URL ?? "");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/investi_6a3a_qa");
assert.equal(process.env.PERSONALIZATION_QA_DISPOSABLE, "1");
assert.equal(process.env.MARKET_DATA_PROVIDER, "deterministic");
assert.equal(process.env.FX_DATA_PROVIDER, "deterministic");
const sql = postgres(url.toString(), { prepare: false });
const id = process.env.PERSONALIZATION_QA_USER_ID;
const [owner] = await sql`select email from "user" where id = ${id!}`;
assert.ok(owner?.email.startsWith("personalization-browser-"));
const { foundationsLessons } = await import("../src/features/lessons/foundations/manifest");
const { returnsLessons } = await import("../src/features/lessons/returns/manifest");
const { availableLessons } = await import("../src/features/learning/catalog");
const { lessonSteps } = await import("../src/features/progress/transition");
const { completeLesson } = await import("../src/features/progress/repository");
const { saveLearnerArtifact } = await import("../src/features/artifacts/repository");
const { CHECKUP_LESSON_ID } = await import("../src/features/lessons/before-investing/checkup-model");
const { GOALS_LESSON_ID } = await import("../src/features/lessons/before-investing/goals-model");
const { executeTrade } = await import("../src/features/portfolio/repository");
const mode = process.env.PERSONALIZATION_QA_LESSONS ?? "foundations";
assert.ok(["foundations", "first-return", "all-published"].includes(mode));
// all-published completes every published lesson, the same catalog that decides when Learn shows the curriculum as complete.
const lessons = mode === "all-published" ? availableLessons : (mode === "foundations" ? foundationsLessons : returnsLessons).filter((lesson) => lesson.status === "available");
for (const lesson of mode === "first-return" ? lessons.slice(0, 1) : lessons) {
  // The synthetic learner explicitly skips goal-setting; real completion still checks the stored output.
  if (lesson.id === GOALS_LESSON_ID) await saveLearnerArtifact(id!, {
    content: { kind: "goal_map", payload: { goals: [], noSpecificGoal: true } },
    sourceLessonId: lesson.id, consent: true, requestId: randomUUID(),
  });
  // The all-complete fixture needs a saved, all-ready check-up so it does not recommend remedial review.
  if (lesson.id === CHECKUP_LESSON_ID) await saveLearnerArtifact(id!, {
    content: { kind: "financial_checkup", payload: { budget: "reviewed", expensiveDebt: "none", reserve: "ready_for_goal", goals: "defined", retirement: "reviewed", nextStep: "continue_learning" } },
    sourceLessonId: lesson.id, consent: true, requestId: randomUUID(),
  });
  await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, updated_at) values (${id!}, ${lesson.id}, 'in_progress', ${lessonSteps(lesson.id).length - 1}, now()) on conflict (user_id, lesson_id) do update set last_position = excluded.last_position`;
  await completeLesson(id!, lesson.id);
}
if (mode === "foundations") await executeTrade(id!, { instrumentId: "US-XNAS:AAPL", quantity: "0.1", side: "BUY", clientIdempotencyKey: "00000000-0000-4000-8000-000000000001" });
await sql.end();
process.exit(0);
