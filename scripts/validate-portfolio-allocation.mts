import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { db } from "../src/db";
import { lesson, lessonAward, portfolio, portfolioAllocation, portfolioAllocationLine, portfolioTrade, user } from "../src/db/schema";
import { PortfolioInputError } from "../src/features/portfolio/decimal";
import { executeAllocation, executeTrade, getOrCreateActivePortfolio, loadLatestAllocation, resetActivePortfolio, reviewAllocation } from "../src/features/portfolio/repository";
import { loadPortfolioView } from "../src/features/portfolio/service";

/** Target-mix execution against a disposable local database: exact arithmetic, idempotency,
 * the learner lock, rewards as contributions, rebalancing, reset, failures and cascades. */
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname), "Requires a local database.");
assert.equal(process.env.MARKET_DATA_PROVIDER ?? "deterministic", "deterministic", "Runs against deterministic sample data.");
const sql = postgres(databaseUrl, { prepare: false });
const prefix = `allocation_qa_${randomUUID().replaceAll("-", "")}`;
const userIds: string[] = [];
const lessonIds = (await db.select({ id: lesson.id }).from(lesson).where(eq(lesson.isPublished, true))).map(({ id }) => id);
assert.ok(lessonIds.length >= 6, "Seeded published lessons are required.");

async function createOwner(capitalReceipts = 2) {
  const id = `${prefix}_${userIds.length}`;
  userIds.push(id);
  const now = new Date();
  await db.insert(user).values({ id, email: `${id}@example.com`, name: "Allocation QA", isAnonymous: false, createdAt: now, updatedAt: now });
  if (capitalReceipts) await db.insert(lessonAward).values(lessonIds.slice(0, capitalReceipts).map((lessonId, index) => ({
    userId: id, lessonId, xp: 60, practiceCapitalMinor: 200_000n, rewardPolicyVersion: 1,
    learningDate: `2026-09-${String(index + 1).padStart(2, "0")}`, timeZone: "UTC", awardedAt: now,
  })));
  return id;
}
const tradesOf = (portfolioId: string) => db.select().from(portfolioTrade).where(eq(portfolioTrade.portfolioId, portfolioId));
const allocationsOf = (portfolioId: string) => db.select().from(portfolioAllocation).where(eq(portfolioAllocation.portfolioId, portfolioId));
const line = (instrumentId: string, percent: number) => ({ instrumentId, weightBasisPoints: percent * 100 });
const firstMix = { lines: [line("IE-XETR:VWCE", 40), line("US-XNAS:MSFT", 20), line("CZ-XPRA:CZGB35", 30)], cashWeightBasisPoints: 1_000 };
const rejectsWith = (code: PortfolioInputError["code"]) => (error: unknown) => error instanceof PortfolioInputError && error.code === code;
const isMarketDataFailure = (error: unknown) => (error as { name?: string })?.name === "MarketDataError";

try {
  // First mix: exact split of 4 000 Kč, cash keeps its weight and every rounding remainder.
  const owner = await createOwner(2);
  const generation = await getOrCreateActivePortfolio(owner);
  const review = await reviewAllocation(owner, firstMix);
  assert.equal(review.plan.totalValueMinor, 400_000n);
  assert.equal((await tradesOf(generation.id)).length, 0, "review writes nothing");
  assert.equal((await allocationsOf(generation.id)).length, 0, "review stores no mix");
  const key = randomUUID();
  const saved = await executeAllocation(owner, { ...firstMix, clientIdempotencyKey: key });
  assert.deepEqual({ duplicate: saved.duplicate, tradeCount: saved.tradeCount }, { duplicate: false, tradeCount: 3 });
  const trades = await tradesOf(generation.id);
  assert.equal(trades.length, 3);
  assert.ok(trades.every((trade) => trade.side === "BUY" && trade.clientIdempotencyKey.startsWith(`allocation:${key}:`)), "trades carry derived idempotency keys");
  const spent = trades.reduce((sum, trade) => sum + trade.grossAmountBaseMinor, 0n);
  for (const trade of trades) {
    const target = (400_000n * BigInt(firstMix.lines.find(({ instrumentId }) => instrumentId === trade.instrumentId)!.weightBasisPoints)) / 10_000n;
    assert.ok(trade.grossAmountBaseMinor <= target && target - trade.grossAmountBaseMinor < 100n, `${trade.instrumentSymbol} spends at most its target`);
    assert.equal(trade.marketDataIsDeterministic, true, "sample provenance is persisted");
  }
  const view = await loadPortfolioView(owner);
  assert.equal(view.availableCashMinor, (400_000n - spent).toString(), "cash is contributions minus buy costs");
  assert.ok(BigInt(view.availableCashMinor) >= 40_000n, "the cash weight stays uninvested");
  assert.equal(BigInt(view.availableCashMinor) + BigInt(view.holdingsMarketValueMinor!), BigInt(view.portfolioTotalMinor!), "total = cash + holdings");
  assert.equal(view.investmentGainLossMinor, "0", "an unchanged sample price creates no performance");
  assert.deepEqual(view.allocation?.lines.map(({ symbol, weightBasisPoints }) => [symbol, weightBasisPoints]), [["VWCE", 4_000], ["MSFT", 2_000], ["CZGB35", 3_000]]);
  assert.equal(view.allocation?.cashWeightBasisPoints, 1_000);
  assert.equal(view.allocation?.appliedValueMinor, "400000");
  const weightSum = view.holdings.reduce((sum, holding) => sum + BigInt(holding.portfolioWeightBasisPoints!), BigInt(view.cashWeightBasisPoints!));
  assert.ok(weightSum >= 9_998n && weightSum <= 10_002n, "portfolio weights include cash and sum to ~100 %");

  // Idempotent retries, sequential and concurrent.
  assert.equal((await executeAllocation(owner, { ...firstMix, clientIdempotencyKey: key })).duplicate, true);
  assert.equal((await tradesOf(generation.id)).length, 3, "a retried save inserts nothing");
  const raceOwner = await createOwner(2);
  const raceKey = randomUUID();
  const raced = await Promise.all([executeAllocation(raceOwner, { ...firstMix, clientIdempotencyKey: raceKey }), executeAllocation(raceOwner, { ...firstMix, clientIdempotencyKey: raceKey })]);
  assert.deepEqual(raced.map(({ duplicate }) => duplicate).sort(), [false, true], "concurrent identical saves execute once");
  const raceGeneration = await getOrCreateActivePortfolio(raceOwner);
  assert.equal((await allocationsOf(raceGeneration.id)).length, 1);
  assert.equal((await tradesOf(raceGeneration.id)).length, 3);

  // A mix and a single buy racing for the same cash serialize on the learner lock: never negative cash.
  const contender = await createOwner(1);
  const allIn = { lines: [line("US-XNAS:MSFT", 100)], cashWeightBasisPoints: 0 };
  await Promise.allSettled([
    executeAllocation(contender, { ...allIn, clientIdempotencyKey: randomUUID() }),
    executeTrade(contender, { instrumentId: "US-XNAS:AAPL", quantity: "0.5", side: "BUY", clientIdempotencyKey: randomUUID() }),
  ]);
  const contenderView = await loadPortfolioView(contender);
  assert.ok(BigInt(contenderView.availableCashMinor) >= 0n, "concurrent mix and buy cannot overspend");
  assert.equal(BigInt(contenderView.availableCashMinor) + BigInt(contenderView.holdingsMarketValueMinor!), 200_000n, "nothing is lost or created by the race");

  // Rewards are contributions: cash grows, gain does not; the new cash shows as cash drift.
  await db.insert(lessonAward).values({ userId: owner, lessonId: lessonIds[2], xp: 60, practiceCapitalMinor: 200_000n, rewardPolicyVersion: 1, learningDate: "2026-09-03", timeZone: "UTC", awardedAt: new Date() });
  const rewarded = await loadPortfolioView(owner);
  assert.equal(BigInt(rewarded.availableCashMinor) - BigInt(view.availableCashMinor), 200_000n, "the reward arrives as cash");
  assert.equal(rewarded.investmentGainLossMinor, "0", "the reward is not investment performance");
  assert.ok(Number(rewarded.cashWeightBasisPoints) > 3_000, "new cash raises the cash weight above its target");

  // Editing the mix rebalances against the new total: MSFT leaves (sold in full), the rest is topped up.
  const edit = { lines: [line("IE-XETR:VWCE", 50), line("CZ-XPRA:CZGB35", 40)], cashWeightBasisPoints: 1_000 };
  const editReview = await reviewAllocation(owner, edit);
  assert.equal(editReview.plan.totalValueMinor, BigInt(rewarded.portfolioTotalMinor!), "the plan distributes the whole portfolio value");
  assert.equal(editReview.plan.trades[0].side, "SELL", "sells come first");
  const edited = await executeAllocation(owner, { ...edit, clientIdempotencyKey: randomUUID() });
  assert.equal(edited.duplicate, false);
  const afterEdit = await loadPortfolioView(owner);
  assert.equal(afterEdit.holdings.find(({ symbol }) => symbol === "MSFT"), undefined, "a holding outside the mix is sold in full");
  assert.ok(BigInt(afterEdit.availableCashMinor) >= 60_000n, "cash keeps at least its target share");
  assert.equal(afterEdit.investmentGainLossMinor, "0", "rebalancing at unchanged prices creates no gain");
  assert.equal(afterEdit.allocation?.lines.length, 2, "the latest mix is the current target");
  assert.equal((await allocationsOf(generation.id)).length, 2, "older mix versions are retained for audit");
  const allTrades = await tradesOf(generation.id);
  assert.equal(allTrades.filter(({ side }) => side === "SELL").length, 1);
  assert.ok(allTrades.length > 3, "rebalancing appends trades and never rewrites them");

  // Invalid input, provider mismatch, unavailable held instruments: rejected without writes.
  const before = { trades: (await tradesOf(generation.id)).length, mixes: (await allocationsOf(generation.id)).length };
  await assert.rejects(() => executeAllocation(owner, { lines: [line("IE-XETR:VWCE", 50)], cashWeightBasisPoints: 4_000, clientIdempotencyKey: randomUUID() }), rejectsWith("InvalidAllocation"));
  await assert.rejects(() => executeAllocation(owner, { lines: [line("FMP:NASDAQ:NVDA", 100)], cashWeightBasisPoints: 0, clientIdempotencyKey: randomUUID() }), isMarketDataFailure);
  await assert.rejects(() => executeAllocation(owner, { lines: [line("CASH:CZK", 100)], cashWeightBasisPoints: 0, clientIdempotencyKey: randomUUID() }), rejectsWith("InvalidInstrument"));
  const now = new Date();
  await sql`insert into portfolio_trade (id, portfolio_id, instrument_id, instrument_symbol, instrument_name, instrument_asset_type, side, quantity, unit_price, quote_currency, fx_rate_to_base, gross_amount_base_minor, fee_base_minor, cash_delta_base_minor, quote_observed_at, executed_at, market_data_provider, market_data_dataset, market_data_kind, market_data_is_deterministic, client_idempotency_key)
    values (${randomUUID()}, ${generation.id}, 'FMP:NASDAQ:NVDA', 'NVDA', 'NVIDIA Corporation', 'equity', 'BUY', '0.01', '100', 'USD', '22', 2200, 0, -2200, ${now}, ${now}, 'fmp', 'quote', 'live', false, ${randomUUID()})`;
  await assert.rejects(() => executeAllocation(owner, { ...edit, clientIdempotencyKey: randomUUID() }), isMarketDataFailure, "an unvaluable holding blocks the whole mix");
  assert.equal((await allocationsOf(generation.id)).length, before.mixes, "rejected mixes store nothing");
  assert.equal((await tradesOf(generation.id)).length, before.trades + 1, "rejected mixes add no trade");
  const partial = await loadPortfolioView(owner);
  assert.equal(partial.portfolioTotalMinor, null, "a missing quote never becomes zero");
  assert.equal(partial.attribution, null, "attribution waits for a complete valuation");
  assert.equal(partial.cashWeightBasisPoints, null);

  // Price/FX attribution from a ledger with a different purchase price and FX.
  const historic = await createOwner(1);
  const historicGeneration = await getOrCreateActivePortfolio(historic);
  await sql`insert into portfolio_trade (id, portfolio_id, instrument_id, instrument_symbol, instrument_name, instrument_asset_type, side, quantity, unit_price, quote_currency, fx_rate_to_base, gross_amount_base_minor, fee_base_minor, cash_delta_base_minor, quote_observed_at, executed_at, market_data_provider, market_data_dataset, market_data_kind, market_data_is_deterministic, client_idempotency_key)
    values (${randomUUID()}, ${historicGeneration.id}, 'US-XNAS:AAPL', 'AAPL', 'Apple Inc.', 'equity', 'BUY', '0.25', '100', 'USD', '22', 55000, 0, -55000, ${now}, ${now}, 'investi-deterministic', 'investi-education-market-v1', 'synthetic', true, ${randomUUID()})`;
  const attributed = await loadPortfolioView(historic);
  // 0.25 × 114 USD × 22.75 = 648.375 → 648.38 Kč against 550 Kč paid; price effect 0.25 × 14 × 22 = 77 Kč;
  // FX 0.25 × 114 × 0.75 = 21.375 Kč, which takes the half-unit rounding so the parts sum exactly.
  assert.equal(attributed.investmentGainLossMinor, "9838");
  assert.equal(attributed.attribution?.priceEffectMinor, "7700");
  assert.equal(attributed.attribution?.fxEffectMinor, "2138");
  assert.deepEqual(attributed.attribution?.currencies.map(({ currency, purchaseFxRate, currentFxRate }) => [currency, Number(purchaseFxRate), Number(currentFxRate)]), [["USD", 22, 22.75]]);

  // Reset closes the generation with its mix; the new generation starts clean with full capital.
  const resetResult = await resetActivePortfolio(owner, randomUUID());
  const resetView = await loadPortfolioView(owner);
  assert.equal(resetView.allocation, null, "a new generation has no mix");
  assert.equal(await loadLatestAllocation(resetResult.portfolio.id), null);
  assert.equal(resetView.availableCashMinor, resetView.earnedPracticeCapitalMinor, "reset restores all earned capital");
  assert.equal((await allocationsOf(generation.id)).length, 2, "the closed generation keeps its mixes");
  const [closed] = await db.select().from(portfolio).where(eq(portfolio.id, generation.id));
  assert.ok(closed.closedAt, "the old generation is closed, not deleted");

  // Deleting the learner cascades to generations, trades, mixes and lines.
  const cascade = await createOwner(1);
  await executeAllocation(cascade, { lines: [line("CZ-XPRA:CZGB35", 100)], cashWeightBasisPoints: 0, clientIdempotencyKey: randomUUID() });
  const cascadeGeneration = await getOrCreateActivePortfolio(cascade);
  const [cascadeMix] = await allocationsOf(cascadeGeneration.id);
  await db.delete(user).where(eq(user.id, cascade));
  userIds.splice(userIds.indexOf(cascade), 1);
  assert.equal((await allocationsOf(cascadeGeneration.id)).length, 0);
  assert.equal((await db.select().from(portfolioAllocationLine).where(eq(portfolioAllocationLine.allocationId, cascadeMix.id))).length, 0);

  console.log("PASS: target mixes — exact split, review without writes, idempotent and concurrent saves, lock with single trades, rewards as contributions, rebalancing, failures without writes, price/FX attribution, reset and cascades.");
} finally {
  for (const id of userIds) await db.delete(user).where(eq(user.id, id));
  await sql.end();
  const client = (globalThis as unknown as { client?: { end: () => Promise<void> } }).client;
  if (client) await client.end();
}
