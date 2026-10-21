import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { db } from "../src/db";
import { saveLearnerArtifact as save, listLearnerArtifactHistory as history, deleteLearnerArtifact as remove } from "../src/features/artifacts/repository";
import { artifactExamples } from "../src/features/artifacts/test-fixtures";
import { exampleIps } from "../src/features/ips/test-fixtures";
import { applyIpsTarget, readIpsPortfolioId } from "../src/features/ips/repository";
import { executeTrade, getOrCreateActivePortfolio, loadLatestAllocation, resetActivePortfolio } from "../src/features/portfolio/repository";
import { loadPortfolioView } from "../src/features/portfolio/service";
import { portfolioMarketData } from "../src/features/portfolio/environment";
import { buildAccountExport, readAccountExportRows, serializeAccountExport } from "../src/features/account/export";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/investi_artifacts_qa");
assert.equal(process.env.IPS_QA_DISPOSABLE, "1");
assert.equal(process.env.MARKET_DATA_PROVIDER, "deterministic");
const sql = postgres(url.toString(), { prepare: false });
const ids = ["owner", "other", "guest", "demo"].map((suffix) => `ipsqa_${randomUUID()}_${suffix}`);
const [owner, other, guest, demo] = ids;
const savePlan = (userId: string, payload: unknown, requestId = randomUUID()) => save(userId, {
  content: { kind: "investment_plan", payload }, sourceLessonId: null, consent: true, requestId,
} as Parameters<typeof save>[1]);
const protectedRows = async () => ({ trades: await sql`select * from portfolio_trade where portfolio_id in (select id from portfolio where user_id=${owner}) order by id`, awards: await sql`select * from lesson_award where user_id=${owner}`, unlocks: await sql`select * from progression_unlock where user_id=${owner}`, progress: await sql`select * from lesson_progress where user_id=${owner}` });
try {
  for (const id of ids) await sql`insert into "user" (id,name,email,is_anonymous,anonymous_kind,created_at,updated_at) values (${id},'IPS QA',${`${id}@example.com`},${id === guest || id === demo},${id === guest ? "guest" : id === demo ? "demo" : null},now(),now())`;
  await sql`insert into progression_unlock (user_id,unlock_id,practice_capital_minor,reason,unlocked_at) values (${owner},'PORTFOLIO_LAB',500000,'legacy','2026-10-01T10:00:00Z')`;
  const generation = await getOrCreateActivePortfolio(owner);
  assert.equal(await readIpsPortfolioId(owner), generation.id);
  const original = await savePlan(owner, artifactExamples.investment_plan);
  const originalRow = await sql`select * from learner_artifact where id=${original.id}`;
  const requestId = randomUUID();
  const current = await savePlan(owner, exampleIps, requestId);
  assert.equal(current.version, 2);
  assert.ok((await Promise.all(Array.from({ length: 5 }, () => savePlan(owner, exampleIps, requestId)))).every((row) => row.id === current.id));
  await assert.rejects(() => savePlan(owner, { ...exampleIps, changeReason: "Jiná změna" }, requestId));
  assert.deepEqual(await sql`select * from learner_artifact where id=${original.id}`, originalRow);
  assert.deepEqual((await history(owner, "investment_plan")).map((row) => row.version), [2, 1]);
  const otherPlan = await savePlan(other, exampleIps);
  assert.deepEqual((await history(other, "investment_plan")).map((row) => row.id), [otherPlan.id]);
  await assert.rejects(() => savePlan(guest, exampleIps));
  await savePlan(demo, exampleIps);
  console.log("PASS: legacy payload compatibility, append-only history, reason, retry concurrency, changed-input rejection and isolated ownership.");

  const before = await protectedRows();
  const initialView = await loadPortfolioView(owner);
  const input = { artifactId: current.id, portfolioId: generation.id, requestId: randomUUID() };
  // Saving intent requires metadata, never a quote/FX or an open market.
  const quote = portfolioMarketData.service.getQuote;
  portfolioMarketData.service.getQuote = async () => { throw new Error("No price available for target test"); };
  try {
    const results = await Promise.all(Array.from({ length: 6 }, () => applyIpsTarget(owner, input)));
    assert.equal(results.filter((r) => !r.duplicate).length, 1);
    assert.ok(results.every((r) => r.allocationId === results[0].allocationId));
  } finally { portfolioMarketData.service.getQuote = quote; }
  assert.deepEqual(await protectedRows(), before, "a target creates no trades/rewards and cannot mutate progress or grants");
  const afterView = await loadPortfolioView(owner);
  for (const key of ["availableCashMinor", "portfolioTotalMinor", "earnedPracticeCapitalMinor", "investmentGainLossMinor"] as const) assert.equal(afterView[key], initialView[key], key);
  const target = (await loadLatestAllocation(generation.id))!;
  assert.equal(target.lines[0].instrumentId, "IE-XETR:VWCE"); assert.equal(target.lines[0].weightBasisPoints, 8000); assert.equal(target.cashWeightBasisPoints, 2000);
  assert.equal((await sql`select * from portfolio_allocation where portfolio_id=${generation.id}`).length, 1);
  await assert.rejects(() => applyIpsTarget(owner, { ...input, artifactId: otherPlan.id }));
  await assert.rejects(() => applyIpsTarget(other, input));
  await assert.rejects(() => applyIpsTarget(owner, { ...input, artifactId: original.id }));

  const changed = await savePlan(owner, { ...exampleIps, changeReason: "Pravidelný přezkum" });
  await assert.rejects(() => applyIpsTarget(owner, input), "a stale tab cannot apply an older version");
  await assert.rejects(() => applyIpsTarget(owner, { ...input, artifactId: changed.id }), "a request key cannot change source version");
  const withTrade = { artifactId: changed.id, portfolioId: generation.id, requestId: randomUUID() };
  await Promise.all([applyIpsTarget(owner, withTrade), executeTrade(owner, { instrumentId: "US-XNAS:AAPL", quantity: "0.1", side: "BUY", clientIdempotencyKey: randomUUID() })]);
  assert.equal((await sql`select * from portfolio_trade where portfolio_id=${generation.id}`).length, 1);
  assert.deepEqual((await protectedRows()).unlocks, before.unlocks); assert.deepEqual((await protectedRows()).awards, before.awards);
  console.log("PASS: exact target weights, server metadata, no price dependency, no trade/cash/performance mutation, owner/current-version validation, key provenance and concurrent ordinary trade.");

  for (const allocation of [{ lines: [{ assetClass: "equity", weightBps: 8000 }], cashBps: 2000 }, { lines: [{ instrumentId: "NOT-A-SECURITY", weightBps: 8000 }], cashBps: 2000 }, { lines: [], cashBps: 10000 }, { lines: [{ instrumentId: "CASH:CZK", weightBps: 8000 }], cashBps: 2000 }, { lines: [{ instrumentId: "US-XCBO:SPX", weightBps: 8000 }], cashBps: 2000 }]) {
    const plan = await savePlan(owner, { ...exampleIps, allocation });
    await assert.rejects(() => applyIpsTarget(owner, { artifactId: plan.id, portfolioId: generation.id, requestId: randomUUID() }));
  }
  const last = await savePlan(owner, exampleIps);
  const oldAllocations = await sql`select * from portfolio_allocation where portfolio_id=${generation.id} order by created_at`;
  await resetActivePortfolio(owner, randomUUID());
  await assert.rejects(() => applyIpsTarget(owner, { artifactId: last.id, portfolioId: generation.id, requestId: randomUUID() }), "never apply a stale generation after reset");
  assert.deepEqual(await sql`select * from portfolio_allocation where portfolio_id=${generation.id} order by created_at`, oldAllocations);
  assert.equal((await sql`select * from portfolio_trade where portfolio_id=${generation.id}`).length, 1, "reset keeps trade history");
  const output = JSON.parse(serializeAccountExport(buildAccountExport((await readAccountExportRows(db, owner))!)));
  assert.equal(output.learnerArtifacts.length, (await history(owner, "investment_plan")).length);
  assert.equal(output.learnerArtifacts.find((row: { version: number }) => row.version === 2).payload.contribution.amountMinor, "250025");
  await remove(other, last.id); assert.ok((await history(owner, "investment_plan")).length > 0);
  await remove(owner, original.id); await remove(owner, original.id);
  assert.deepEqual(await history(owner, "investment_plan"), []);
  assert.deepEqual(await sql`select * from portfolio_allocation where portfolio_id=${generation.id} order by created_at`, oldAllocations, "deleting IPS preserves Lab audit history");
  const newPortfolioId = (await readIpsPortfolioId(owner))!;
  await assert.rejects(() => applyIpsTarget(owner, { artifactId: last.id, portfolioId: newPortfolioId, requestId: randomUUID() }));
  for (const id of [demo, other]) await sql`delete from "user" where id=${id}`;
  assert.equal((await sql`select * from learner_artifact where user_id in ${sql([demo, other])}`).length, 0);
  console.log("PASS: unavailable/class/cash-only targets rejected, stale generation after reset rejected, old targets/trades retained, full exact export, all-version deletion and lifecycle cascades.");
} finally {
  await sql`delete from "user" where id in ${sql(ids)}`;
  await sql.end();
  await (globalThis as unknown as { client?: { end: () => Promise<void> } }).client?.end();
}
