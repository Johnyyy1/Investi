import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { db } from "../src/db";
import { saveLearnerArtifact, deleteLearnerArtifact } from "../src/features/artifacts/repository";
import { artifactExamples } from "../src/features/artifacts/test-fixtures";
import { exampleIps } from "../src/features/ips/test-fixtures";
import { decimalToQuantityUnits } from "../src/features/portfolio/decimal";
import { backtestHistoryPlans } from "../src/features/backtesting/catalog";
import { getOrCreateActivePortfolio } from "../src/features/portfolio/repository";
import { loadPortfolioView } from "../src/features/portfolio/service";
import { portfolioMarketData } from "../src/features/portfolio/environment";
import { buildAccountExport, readAccountExportRows, serializeAccountExport } from "../src/features/account/export";
import { evaluateTraining, replayTraining, type TrainingAction } from "../src/features/training/domain";
import { appendTrainingAction, loadLatestTraining, startTrainingSession } from "../src/features/training/repository";
import { loadScenarioSeries, modelSeries } from "../src/features/training/scenarios";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
assert.equal(process.env.TRAINING_QA_DISPOSABLE, "1");
assert.equal(process.env.MARKET_DATA_PROVIDER, "deterministic");
const sql = postgres(url.toString(), { prepare: false });
const ids = ["owner", "other", "guest", "demo"].map((suffix) => `trainingqa_${randomUUID()}_${suffix}`);
const [owner, other, guest, demo] = ids;
const savePlan = (userId: string, payload: unknown = exampleIps) => saveLearnerArtifact(userId, { content: { kind: "investment_plan", payload }, sourceLessonId: null, consent: true, requestId: randomUUID() } as Parameters<typeof saveLearnerArtifact>[1]);
const protectedRows = async () => ({
  portfolios: await sql`select * from portfolio where user_id=${owner} order by id`,
  trades: await sql`select * from portfolio_trade where portfolio_id in (select id from portfolio where user_id=${owner}) order by id`,
  awards: await sql`select * from lesson_award where user_id=${owner}`, unlocks: await sql`select * from progression_unlock where user_id=${owner}`,
  progress: await sql`select * from lesson_progress where user_id=${owner}`,
});
const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;
const act = (sessionId: string, expectedMonth: number, action: TrainingAction, clientIdempotencyKey = randomUUID()) => appendTrainingAction(owner, { sessionId, expectedMonth, clientIdempotencyKey, action });

try {
  for (const id of ids) await sql`insert into "user" (id,name,email,is_anonymous,anonymous_kind,created_at,updated_at) values (${id},'Training QA',${`${id}@example.com`},${id === guest || id === demo},${id === guest ? "guest" : id === demo ? "demo" : null},now(),now())`;
  await sql`insert into progression_unlock (user_id,unlock_id,practice_capital_minor,reason,unlocked_at) values (${owner},'PORTFOLIO_LAB',500000,'legacy','2026-10-01T10:00:00Z')`;
  await getOrCreateActivePortfolio(owner);
  const before = await protectedRows();
  const viewBefore = await loadPortfolioView(owner);
  const series = modelSeries();

  await assert.rejects(() => startTrainingSession(owner, { scenarioId: "model-crisis-v1", requestId: randomUUID(), series }), code("NoPlan"));
  await assert.rejects(() => startTrainingSession(guest, { scenarioId: "model-crisis-v1", requestId: randomUUID(), series }), code("SavedAccount"));
  await savePlan(owner, artifactExamples.investment_plan);
  await assert.rejects(() => startTrainingSession(owner, { scenarioId: "model-crisis-v1", requestId: randomUUID(), series }), code("LegacyPlan"));
  const plan = await savePlan(owner);
  const requestId = randomUUID();
  const starts = await Promise.all(Array.from({ length: 5 }, () => startTrainingSession(owner, { scenarioId: "model-crisis-v1", requestId, series })));
  assert.equal(new Set(starts.map(({ sessionId }) => sessionId)).size, 1);
  assert.equal(starts.filter(({ duplicate }) => !duplicate).length, 1);
  await assert.rejects(() => startTrainingSession(owner, { scenarioId: "history-2020-v1", requestId, series }), code("KeyReused"));
  const { sessionId } = starts[0];
  const [row] = await sql`select * from training_session where id=${sessionId}`;
  assert.equal(row.ips_artifact_id, plan.id);
  assert.deepEqual(row.plan, { ipsVersion: plan.version, contributionMinor: "250025", targetInvestedBps: 8000, rebalancing: { mode: "band", bandBps: 500 }, drawdownAction: "keep_plan" });
  assert.equal(row.initial_capital_minor, "10000000");
  console.log("PASS: saved v2 IPS required, guest refused, legacy plan refused, idempotent concurrent start, request reuse refused, structured plan snapshot only.");

  // Same key from five tabs: one row. Five different "advance" keys for the same month: one wins, the rest are stale.
  const buyKey = randomUUID();
  const buys = await Promise.all(Array.from({ length: 5 }, () => act(sessionId, 0, { kind: "buy", amountMinor: 8_000_000n }, buyKey)));
  assert.equal(buys.filter(({ duplicate }) => !duplicate).length, 1);
  await assert.rejects(() => act(sessionId, 0, { kind: "buy", amountMinor: 1_000_000n }, buyKey), code("KeyReused"));
  const advances = await Promise.allSettled(Array.from({ length: 5 }, () => act(sessionId, 0, { kind: "advance" })));
  assert.equal(advances.filter(({ status }) => status === "fulfilled").length, 1);
  assert.ok(advances.every((result) => result.status === "fulfilled" || code("Stale")(result.reason)));
  // Concurrent buys for more than the cash: the lock serializes them, so cash never goes negative.
  const cash = (await loadLatestTraining(owner))!.state.cashMinor;
  const halfPlus = cash / 2n + 1n;
  const overspend = await Promise.allSettled([act(sessionId, 1, { kind: "buy", amountMinor: halfPlus }), act(sessionId, 1, { kind: "buy", amountMinor: halfPlus })]);
  assert.equal(overspend.filter(({ status }) => status === "fulfilled").length, 1);
  assert.ok(overspend.some((result) => result.status === "rejected" && code("InsufficientCash")(result.reason)));
  assert.ok((await loadLatestTraining(owner))!.state.cashMinor >= 0n);
  await assert.rejects(() => act(sessionId, 1, { kind: "sell", quantityUnits: 10n ** 20n }), code("Oversell"));
  await assert.rejects(() => appendTrainingAction(other, { sessionId, expectedMonth: 1, clientIdempotencyKey: randomUUID(), action: { kind: "advance" } }), code("NotFound"));
  console.log("PASS: idempotent action retry, changed payload refused, concurrent advance serialized, no overspend under concurrency, oversell and foreign session refused.");

  // Panic-sell in the trough, then finish; the evaluation replays identically from the stored log.
  for (let month = 1; month < 6; month++) await act(sessionId, month, { kind: "advance" });
  const trough = (await loadLatestTraining(owner))!;
  await act(sessionId, 6, { kind: "sell", quantityUnits: trough.state.quantityUnits });
  for (let month = 6; month < 24; month++) await act(sessionId, month, { kind: "advance" });
  await assert.rejects(() => act(sessionId, 24, { kind: "advance" }), code("Finished"));
  const first = (await loadLatestTraining(owner))!, second = (await loadLatestTraining(owner))!;
  assert.deepEqual(second.state, first.state);
  assert.equal(first.state.finished, true);
  const actions = (await sql`select kind, amount_minor, quantity from training_action where session_id=${sessionId} order by sequence`).map((action): TrainingAction =>
    action.kind === "buy" ? { kind: "buy", amountMinor: BigInt(action.amount_minor) } : action.kind === "sell" ? { kind: "sell", quantityUnits: decimalToQuantityUnits(action.quantity) } : { kind: "advance" });
  assert.deepEqual(replayTraining(first.setup, actions), first.state, "the result is reproducible from stored actions and the frozen series");
  const evaluation = evaluateTraining(first.setup, first.state);
  assert.equal(evaluation.sellsOutsidePlan, 1);
  assert.equal(evaluation.contributedMinor, 10_000_000n + 24n * 250_025n);
  assert.equal(evaluation.twr.status, "available");
  assert.equal(evaluation.mwr.status, "available");
  console.log("PASS: deterministic replay from the stored log, end of scenario enforced, sale outside the IPS band rule reported, MWR/TWR available.");

  const history = await loadScenarioSeries(portfolioMarketData.service, backtestHistoryPlans.deterministic, "history-2022-v1");
  const historical = await startTrainingSession(owner, { scenarioId: "history-2022-v1", requestId: randomUUID(), series: history });
  const [stored] = await sql`select series from training_session where id=${historical.sessionId}`;
  assert.equal(stored.series.source.kind, "history"); assert.equal(stored.series.source.sample, true); assert.equal(stored.series.points.length, 25);
  assert.equal((await loadLatestTraining(owner))!.session.id, historical.sessionId);
  await startTrainingSession(demo, { scenarioId: "model-crisis-v1", requestId: randomUUID(), series }).then(() => assert.fail("demo has no plan yet"), (error) => assert.ok(code("NoPlan")(error)));
  await savePlan(demo); await startTrainingSession(demo, { scenarioId: "model-crisis-v1", requestId: randomUUID(), series });
  console.log("PASS: historical sample series frozen with provenance; isolated demo can train with its own plan.");

  assert.deepEqual(await protectedRows(), before, "training never touches the personal portfolio, trades, rewards, unlocks or progress");
  const viewAfter = await loadPortfolioView(owner);
  for (const key of ["availableCashMinor", "portfolioTotalMinor", "earnedPracticeCapitalMinor", "investmentGainLossMinor"] as const) assert.equal(viewAfter[key], viewBefore[key], key);
  const exported = JSON.parse(serializeAccountExport(buildAccountExport((await readAccountExportRows(db, owner))!)));
  assert.equal(exported.trainingSessions.length, 2);
  assert.equal(exported.trainingSessions[0].actions.length, (await sql`select * from training_action where session_id=${sessionId}`).length);
  await deleteLearnerArtifact(owner, plan.id);
  assert.equal((await sql`select ips_artifact_id from training_session where id=${sessionId}`)[0].ips_artifact_id, null, "deleting the IPS keeps the training snapshot");
  for (const id of [demo, owner]) await sql`delete from "user" where id=${id}`;
  assert.equal((await sql`select * from training_session where user_id in ${sql([demo, owner])}`).length, 0);
  assert.equal((await sql`select * from training_action where session_id=${sessionId}`).length, 0);
  console.log("PASS: Practice Capital and the portfolio unchanged, full export, IPS deletion keeps the snapshot, user deletion cascades.");
} finally {
  await sql`delete from "user" where id in ${sql(ids)}`;
  await sql.end();
  await (globalThis as unknown as { client?: { end: () => Promise<void> } }).client?.end();
}
