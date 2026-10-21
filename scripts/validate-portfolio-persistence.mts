import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import postgres from "postgres";
import { db } from "../src/db";
import { lesson, lessonAward, portfolio, portfolioTrade, user } from "../src/db/schema";
import { executeTrade, executeAllocation, getOrCreateActivePortfolio, resetActivePortfolio, reviewTrade, setBrokerFeeProfile } from "../src/features/portfolio/repository";
import { loadPortfolioView } from "../src/features/portfolio/service";

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname), "Requires local DB.");
const sql = postgres(databaseUrl, { prepare: false });
const prefix = `portfolio_qa_${randomUUID().replaceAll("-", "")}`;
const userIds: string[] = [];
const lessonIds = (await db.select({ id: lesson.id }).from(lesson).where(eq(lesson.isPublished, true))).map(({ id }) => id);
assert.ok(lessonIds.length >= 6, "Seeded published lessons are required.");

async function createOwner(capitalReceipts = 1, isAnonymous = false) {
  const id = `${prefix}_${userIds.length}`;
  userIds.push(id);
  const now = new Date();
  await db.insert(user).values({ id, email: `${id}@example.com`, name: "Portfolio QA", isAnonymous, createdAt: now, updatedAt: now });
  if (capitalReceipts) await db.insert(lessonAward).values(lessonIds.slice(0, capitalReceipts).map((lessonId, index) => ({
    userId: id, lessonId, xp: 60, practiceCapitalMinor: 200_000n, rewardPolicyVersion: 1,
    learningDate: `2026-09-${String(index + 1).padStart(2, "0")}`, timeZone: "UTC", awardedAt: new Date(`2026-09-${String(index + 1).padStart(2, "0")}T12:00:00Z`),
  })));
  return id;
}

async function tradeCount(portfolioId: string) {
  return (await db.select().from(portfolioTrade).where(eq(portfolioTrade.portfolioId, portfolioId))).length;
}

try {
  const primary = await createOwner(2);
  const first = await getOrCreateActivePortfolio(primary);
  assert.equal(first.openingCapitalMinor, 400_000n, "lazy creation snapshots exact opening entitlement");
  assert.equal((await getOrCreateActivePortfolio(primary)).id, first.id, "lazy creation is idempotent");
  await assert.rejects(() => db.insert(portfolio).values({ id: randomUUID(), userId: primary, baseCurrency: "CZK", openedAt: new Date(), openingCapitalMinor: 400_000n }));

  const buyKey = randomUUID();
  assert.equal((await executeTrade(primary, { instrumentId: "US-XNAS:AAPL", quantity: "0.25", side: "BUY", clientIdempotencyKey: buyKey })).duplicate, false);
  assert.equal((await executeTrade(primary, { instrumentId: "US-XNAS:AAPL", quantity: "0.25", side: "BUY", clientIdempotencyKey: buyKey })).duplicate, true);
  assert.equal(await tradeCount(first.id), 1, "duplicate buy inserts once");
  const [persistedBuy] = await db.select().from(portfolioTrade).where(eq(portfolioTrade.clientIdempotencyKey, buyKey));
  assert.equal(persistedBuy.feeProfileId, "investi-standard-v1");
  assert.equal(persistedBuy.tradeFeeRateBps, 10);
  assert.equal(persistedBuy.tradeFeeMinMinor, 1_000n);
  assert.equal(persistedBuy.tradeFeeMaxMinor, 20_000n);
  assert.equal(persistedBuy.fxMarkupBps, 50);
  assert.equal(persistedBuy.feeBaseMinor, 1_000n);
  assert.equal(persistedBuy.fxMarkupBaseMinor, 324n);
  const estimate = await reviewTrade(primary, { instrumentId: "US-XNAS:AAPL", quantity: "0.25", side: "BUY" });
  assert.equal(estimate.cashDeltaBaseMinor, persistedBuy.cashDeltaBaseMinor.toString(), "review and execution share exact arithmetic");
  await setBrokerFeeProfile(primary, "investi-low-fx-v1");
  const duplicateAfterChange = await executeTrade(primary, { instrumentId: "US-XNAS:AAPL", quantity: "0.25", side: "BUY", clientIdempotencyKey: buyKey });
  assert.deepEqual(duplicateAfterChange.trade, persistedBuy, "changing profiles never reprices a retry or alters history");
  await assert.rejects(() => executeTrade(primary, { instrumentId: "US-XNAS:AAPL", quantity: "0.25", side: "BUY", clientIdempotencyKey: randomUUID(), expectedFeeProfileId: "investi-standard-v1" }), /Profil poplatků se změnil/);
  assert.equal((await loadPortfolioView(primary)).feeProfileId, "investi-low-fx-v1");
  await setBrokerFeeProfile(primary, "investi-standard-v1");
  assert.equal(persistedBuy.marketDataProvider, "investi-deterministic", "security provenance remains independent");
  assert.equal(persistedBuy.fxRateProvider, "investi-deterministic", "FX provider provenance is persisted separately");
  assert.equal(persistedBuy.fxReferenceDate, "2026-01-16", "FX calendar reference date is preserved exactly");
  const sellKey = randomUUID();
  await executeTrade(primary, { instrumentId: "US-XNAS:AAPL", quantity: "0.1", side: "SELL", clientIdempotencyKey: sellKey });
  assert.equal((await executeTrade(primary, { instrumentId: "US-XNAS:AAPL", quantity: "0.1", side: "SELL", clientIdempotencyKey: sellKey })).duplicate, true);
  assert.equal(await tradeCount(first.id), 2, "duplicate sell inserts once");
  assert.equal((await loadPortfolioView(primary)).holdings[0].quantity, "0.15");

  const buyer = await createOwner(1);
  const simultaneousBuys = await Promise.allSettled([
    executeTrade(buyer, { instrumentId: "US-XNAS:AAPL", quantity: "0.5", side: "BUY", clientIdempotencyKey: randomUUID() }),
    executeTrade(buyer, { instrumentId: "US-XNAS:AAPL", quantity: "0.5", side: "BUY", clientIdempotencyKey: randomUUID() }),
  ]);
  assert.deepEqual(simultaneousBuys.map(({ status }) => status).sort(), ["fulfilled", "rejected"], "concurrent buys cannot overspend");

  // Two gross notionals fit, but two minimum commissions do not. The learner lock must include fees.
  const feeBuyer = await createOwner(1);
  const feeRace = await Promise.allSettled([1, 2].map(() => executeTrade(feeBuyer, { instrumentId: "CZ-XPRA:CZGB35", quantity: "9.9", side: "BUY", clientIdempotencyKey: randomUUID() })));
  assert.deepEqual(feeRace.map(({ status }) => status).sort(), ["fulfilled", "rejected"], "fees alone prevent the second concurrent buy");
  const feeView = await loadPortfolioView(feeBuyer);
  assert.equal(feeView.availableCashMinor, "99406");
  assert.equal(feeView.investmentGainLossMinor, "-1000", "domestic trades incur commission, no FX cost");
  const feeTrade = await db.select().from(portfolioTrade).where(eq(portfolioTrade.portfolioId, feeView.portfolioId));
  assert.equal(feeTrade[0].fxMarkupBps, 0);

  const tinySale = await executeTrade(feeBuyer, { instrumentId: "CZ-XPRA:CZGB35", quantity: "0.0001", side: "SELL", clientIdempotencyKey: randomUUID() });
  assert.equal(tinySale.trade.cashDeltaBaseMinor, -999n, "a tiny sale pays the minimum commission from existing cash");
  assert.equal((await loadPortfolioView(feeBuyer)).availableCashMinor, "98407");
  const exhausted = await createOwner(1);
  await executeAllocation(exhausted, { lines: [{ instrumentId: "CZ-XPRA:CZGB35", weightBasisPoints: 10_000 }], cashWeightBasisPoints: 0, clientIdempotencyKey: randomUUID() });
  assert.equal((await loadPortfolioView(exhausted)).availableCashMinor, "0");
  await assert.rejects(() => executeTrade(exhausted, { instrumentId: "CZ-XPRA:CZGB35", quantity: "0.0001", side: "SELL", clientIdempotencyKey: randomUUID() }), /včetně nákladů/, "sale cannot overdraw cash when commission exceeds proceeds");

  const seller = await createOwner(2);
  await executeTrade(seller, { instrumentId: "US-XNAS:AAPL", quantity: "1", side: "BUY", clientIdempotencyKey: randomUUID() });
  const simultaneousSells = await Promise.allSettled([
    executeTrade(seller, { instrumentId: "US-XNAS:AAPL", quantity: "0.75", side: "SELL", clientIdempotencyKey: randomUUID() }),
    executeTrade(seller, { instrumentId: "US-XNAS:AAPL", quantity: "0.75", side: "SELL", clientIdempotencyKey: randomUUID() }),
  ]);
  assert.deepEqual(simultaneousSells.map(({ status }) => status).sort(), ["fulfilled", "rejected"], "concurrent sells cannot oversell");

  const rewardRace = await createOwner(1);
  await Promise.all([
    executeTrade(rewardRace, { instrumentId: "US-XNAS:AAPL", quantity: "0.5", side: "BUY", clientIdempotencyKey: randomUUID() }),
    db.transaction(async (tx) => {
      await tx.select({ id: user.id }).from(user).where(eq(user.id, rewardRace)).for("update");
      await tx.insert(lessonAward).values({ userId: rewardRace, lessonId: lessonIds[1], xp: 60, practiceCapitalMinor: 200_000n, rewardPolicyVersion: 1, learningDate: "2026-09-02", timeZone: "UTC", awardedAt: new Date() });
    }),
  ]);
  const rewardRaceView = await loadPortfolioView(rewardRace);
  assert.equal(rewardRaceView.earnedPracticeCapitalMinor, "400000");
  assert.equal(rewardRaceView.availableCashMinor, "268677", "concurrent reward is neither lost nor double credited");
  assert.equal(rewardRaceView.investmentGainLossMinor, "-1648", "reward contribution is not performance; commission and FX are costs");

  const beforeResetTrades = await tradeCount(first.id);
  const resetKey = randomUUID();
  const reset = await resetActivePortfolio(primary, resetKey);
  const duplicateReset = await resetActivePortfolio(primary, resetKey);
  assert.equal(duplicateReset.duplicate, true);
  assert.equal(duplicateReset.portfolio.id, reset.portfolio.id);
  const generations = await db.select().from(portfolio).where(eq(portfolio.userId, primary));
  assert.equal(generations.length, 2);
  assert.equal(generations.filter(({ closedAt }) => closedAt === null).length, 1);
  assert.equal(await tradeCount(first.id), beforeResetTrades, "reset retains old trades");
  const resetView = await loadPortfolioView(primary);
  assert.equal(resetView.availableCashMinor, resetView.earnedPracticeCapitalMinor, "reset restores all receipt entitlement");
  assert.equal(resetView.holdings.length, 0);
  assert.equal(resetView.feeProfileId, "investi-standard-v1", "reset preserves the saved user-level tariff");

  const isolated = await createOwner(0);
  const isolatedView = await loadPortfolioView(isolated);
  assert.equal(isolatedView.availableCashMinor, "0");
  assert.equal(isolatedView.holdings.length, 0);

  const demoA = await createOwner(6, true), demoB = await createOwner(6, true);
  const [demoAView, demoBView] = await Promise.all([loadPortfolioView(demoA), loadPortfolioView(demoB)]);
  assert.equal(demoAView.holdings.length, 2);
  assert.equal(demoBView.holdings.length, 2);
  assert.notEqual(demoAView.portfolioId, demoBView.portfolioId);
  await executeTrade(demoA, { instrumentId: "US-XNAS:AAPL", quantity: "0.1", side: "SELL", clientIdempotencyKey: randomUUID() });
  assert.equal((await loadPortfolioView(demoB)).holdings.find(({ symbol }) => symbol === "AAPL")?.quantity, "1", "demo mutations are isolated");

  const cascade = await createOwner(1);
  const cascadePortfolio = await getOrCreateActivePortfolio(cascade);
  await executeTrade(cascade, { instrumentId: "CZ-XPRA:CZGB35", quantity: "1", side: "BUY", clientIdempotencyKey: randomUUID() });
  await db.delete(user).where(eq(user.id, cascade));
  userIds.splice(userIds.indexOf(cascade), 1);
  assert.equal((await db.select().from(portfolio).where(eq(portfolio.id, cascadePortfolio.id))).length, 0);
  assert.equal((await db.select().from(portfolioTrade).where(eq(portfolioTrade.portfolioId, cascadePortfolio.id))).length, 0);

  const activeCount = await db.select().from(portfolio).where(and(eq(portfolio.userId, primary), isNull(portfolio.closedAt)));
  assert.equal(activeCount.length, 1);
  console.log("PASS: portfolio persistence, ownership/isolation, idempotency, generations/reset, demo seeding, cascades, and buy/sell/reward concurrency.");
} finally {
  for (const id of userIds) await db.delete(user).where(eq(user.id, id));
  await sql.end();
  const client = (globalThis as unknown as { client?: { end: () => Promise<void> } }).client;
  if (client) await client.end();
}
