import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { db } from "../src/db";
import { lesson, lessonAward, portfolioAllocation, portfolioTrade, user } from "../src/db/schema";
import { PortfolioInputError } from "../src/features/portfolio/decimal";
import { executeAllocation, executeTrade, getOrCreateActivePortfolio, reviewAllocation } from "../src/features/portfolio/repository";
import { loadPortfolioView } from "../src/features/portfolio/service";

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname), "Requires a local database.");
assert.equal(process.env.MARKET_DATA_PROVIDER, "deterministic");
assert.equal(process.env.FX_DATA_PROVIDER, "deterministic");
assert.equal(process.env.DETERMINISTIC_MARKET_NOW, "2026-01-17T12:00:00.000Z");

const sql = postgres(databaseUrl, { prepare: false });
const userId = `closed_market_${randomUUID().replaceAll("-", "")}`;

try {
  const now = new Date("2026-01-17T12:00:00.000Z");
  await db.insert(user).values({ id: userId, email: `${userId}@example.com`, name: "Closed Market QA", isAnonymous: false, createdAt: now, updatedAt: now });
  const [published] = await db.select({ id: lesson.id }).from(lesson).where(eq(lesson.isPublished, true)).limit(1);
  assert.ok(published, "A seeded published lesson is required.");
  await db.insert(lessonAward).values({
    userId,
    lessonId: published.id,
    xp: 60,
    practiceCapitalMinor: 200_000n,
    rewardPolicyVersion: 1,
    learningDate: "2026-01-17",
    timeZone: "Europe/Prague",
    awardedAt: now,
  });
  const active = await getOrCreateActivePortfolio(userId);
  const key = randomUUID();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(
      () => executeTrade(userId, { instrumentId: "US-XNAS:AAPL", quantity: "0.25", side: "BUY", clientIdempotencyKey: key }),
      (error) => error instanceof PortfolioInputError && error.code === "MarketClosed",
      "each rejected idempotent retry remains a normalized market-closed failure",
    );
  }
  const mix = { lines: [{ instrumentId: "US-XNAS:AAPL", weightBasisPoints: 9_000 }], cashWeightBasisPoints: 1_000 };
  const isMarketClosed = (error: unknown) => error instanceof PortfolioInputError && error.code === "MarketClosed";
  await assert.rejects(() => reviewAllocation(userId, mix), isMarketClosed, "a closed market blocks the mix review");
  await assert.rejects(() => executeAllocation(userId, { ...mix, clientIdempotencyKey: randomUUID() }), isMarketClosed, "a closed market blocks saving a mix");
  assert.equal((await db.select().from(portfolioAllocation).where(eq(portfolioAllocation.portfolioId, active.id))).length, 0, "a blocked mix is never stored");
  const trades = await db.select().from(portfolioTrade).where(eq(portfolioTrade.portfolioId, active.id));
  assert.equal(trades.length, 0, "a rejected closed-market execution is never persisted");
  const view = await loadPortfolioView(userId);
  assert.equal(view.availableCashMinor, "200000", "a rejected execution does not deduct Practice Capital");
  assert.equal(view.holdings.length, 0);
  console.log("PASS: closed-market execution and mixes reject repeatably without a trade, a stored mix or a Practice Capital mutation.");
} finally {
  await db.delete(user).where(eq(user.id, userId));
  await sql.end();
  const client = (globalThis as unknown as { client?: { end: () => Promise<void> } }).client;
  if (client) await client.end();
}
