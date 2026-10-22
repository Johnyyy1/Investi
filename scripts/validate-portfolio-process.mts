import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { db } from "../src/db";
import { saveLearnerArtifact, deleteLearnerArtifact } from "../src/features/artifacts/repository";
import { exampleIps } from "../src/features/ips/test-fixtures";
import { executeTrade, getOrCreateActivePortfolio, resetActivePortfolio } from "../src/features/portfolio/repository";
import { loadPortfolioView } from "../src/features/portfolio/service";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Requires local DB.");
assert.equal(process.env.PROCESS_QA_DISPOSABLE, "1", "Use an isolated disposable database.");
assert.equal(process.env.MARKET_DATA_PROVIDER, "deterministic");
const sql = postgres(url.toString(), { prepare: false });
const owner = `process_qa_${randomUUID()}`;
const other = `process_qa_${randomUUID()}`;
const save = (userId: string, payload: typeof exampleIps) => saveLearnerArtifact(userId, {
  content: { kind: "investment_plan", payload }, requestId: randomUUID(), consent: true, sourceLessonId: null,
});
const snapshot = async () => ({
  trades: await sql`select * from portfolio_trade where portfolio_id in (select id from portfolio where user_id=${owner}) order by id`,
  awards: await sql`select * from lesson_award where user_id=${owner}`,
  unlocks: await sql`select * from progression_unlock where user_id=${owner}`,
  progress: await sql`select * from lesson_progress where user_id=${owner}`,
});
try {
  for (const id of [owner, other]) await sql`insert into "user" (id,name,email,created_at,updated_at) values (${id},'Process QA',${`${id}@example.com`},now(),now())`;
  await sql`insert into progression_unlock (user_id,unlock_id,practice_capital_minor,reason,unlocked_at) values (${owner},'PORTFOLIO_LAB',5000000,'test_fixture',now())`;
  const generation = await getOrCreateActivePortfolio(owner);
  for (const quantity of [...Array<string>(9).fill("0.01"), "0.1", "0.25", "1.3333"]) {
    await executeTrade(owner, { instrumentId: "US-XNAS:AAPL", side: "BUY", quantity, clientIdempotencyKey: randomUUID() });
  }
  const noPlan = await loadPortfolioView(owner);
  assert.equal(noPlan.process.ipsVersion, null);
  assert.equal(noPlan.process.allocation.reason, "no-ips");
  assert.equal(noPlan.recentActivity.length, 8);
  assert.equal(noPlan.process.turnover.tradeCount, 12, "process reads all trades, not the activity preview");
  const [costs] = await sql`select sum(fee_base_minor)::text as fees,sum(coalesce(fx_markup_base_minor,0))::text as fx,sum(gross_amount_base_minor)::text as gross from portfolio_trade where portfolio_id=${generation.id}`;
  assert.equal(noPlan.process.costs.feesMinor, costs.fees);
  assert.equal(noPlan.process.costs.fxMarkupMinor, costs.fx);
  assert.equal(noPlan.process.costs.value, (BigInt(costs.fees) + BigInt(costs.fx)).toString());
  assert.equal(noPlan.process.turnover.grossMinor, costs.gross);
  await save(other, exampleIps);
  assert.equal((await loadPortfolioView(owner)).process.ipsVersion, null, "another owner's plan is never used");
  const first = await save(owner, exampleIps);
  assert.equal((await loadPortfolioView(owner)).process.allocation.status, "outside-plan");
  const cashBps = Number(noPlan.cashWeightBasisPoints);
  const latest = await save(owner, { ...exampleIps, allocation: { lines: [{ instrumentId: "US-XNAS:AAPL", weightBps: 10000 - cashBps }], cashBps } });
  const before = await snapshot();
  for (let i = 0; i < 3; i++) {
    const view = await loadPortfolioView(owner);
    assert.equal(view.process.ipsVersion, latest.version);
    assert.equal(view.process.allocation.status, "within-plan");
    assert.equal(view.investmentGainLossMinor, noPlan.investmentGainLossMinor);
    assert.equal(view.availableCashMinor, noPlan.availableCashMinor);
  }
  assert.deepEqual(await snapshot(), before, "reading feedback cannot mutate trades, awards, access or progress");
  await resetActivePortfolio(owner, randomUUID());
  const reset = await loadPortfolioView(owner);
  assert.notEqual(reset.portfolioId, generation.id);
  assert.equal(reset.process.costs.value, "0");
  assert.equal(reset.process.turnover.tradeCount, 0);
  assert.equal(reset.process.hhi.reason, "no-holdings");
  assert.equal(reset.process.ipsVersion, latest.version);
  assert.equal((await sql`select count(*)::int as count from portfolio_trade where portfolio_id=${generation.id}`)[0].count, 12);
  await deleteLearnerArtifact(owner, first.id);
  assert.equal((await loadPortfolioView(owner)).process.allocation.reason, "no-ips");
  console.log("PASS: full ledger costs/volume, exact decimal executions, latest owned IPS, read-only feedback, reset isolation and retained history.");
} finally {
  await sql`delete from "user" where id in (${owner},${other})`;
  await sql.end();
  await db.$client.end();
}
