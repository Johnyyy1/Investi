import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, like } from "drizzle-orm";
import { db } from "../src/db";
import { marketDataCache } from "../src/db/schema";
import { TieredMarketDataCache } from "../src/features/market-data/cache";
import { adjustmentPolicies, type HistoricalPriceRequest, type InstrumentId } from "../src/features/market-data/contracts";
import { FIXTURE_RETRIEVED_AT } from "../src/features/market-data/deterministic/fixtures";
import { DeterministicEtfAnalyticsProvider } from "../src/features/market-data/deterministic/etf-analytics";
import { DeterministicEquityFundamentalsProvider } from "../src/features/market-data/deterministic/fundamentals";
import { DeterministicMarketDataProvider } from "../src/features/market-data/deterministic/provider";
import { MARKET_DATA_CACHE_FORMAT_VERSION, PostgresMarketDataCacheStore } from "../src/features/market-data/postgres-cache";
import { MarketDataService } from "../src/features/market-data/service";
import { TickerInsideEtfAnalyticsProvider } from "../src/features/market-data/tickerinside/etf-analytics";

/** Shared Postgres market-data cache: lossless round trips, expiry, upserts, purge and cross-instance reuse. */
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname), "Requires a local database.");

const run = `validation-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const key = (name: string) => JSON.stringify([run, name]);
const store = new PostgresMarketDataCacheStore(db);
const fixtureClock = () => new Date(FIXTURE_RETRIEVED_AT);
const now = Date.parse(FIXTURE_RETRIEVED_AT);
const HOUR = 60 * 60 * 1_000;

try {
  // Real normalized values survive the jsonb round trip unchanged.
  const provider = new DeterministicMarketDataProvider(fixtureClock);
  const aapl = await provider.getInstrumentMetadata("US-XNAS:AAPL");
  const vwce = await provider.getInstrumentMetadata("IE-XETR:VWCE");
  const etf = new DeterministicEtfAnalyticsProvider(fixtureClock);
  const values = {
    instrument: aapl,
    quote: await provider.getQuote("US-XNAS:AAPL"),
    history: await provider.getHistoricalPrices({ instrumentId: "US-XNAS:AAPL", startDate: "2026-01-05", endDate: "2026-01-16", interval: "daily", timeZone: "UTC", adjustment: adjustmentPolicies["split-adjusted"] }),
    fx: await provider.getFxRate("USD", "CZK", FIXTURE_RETRIEVED_AT),
    "equity-fundamentals": await new DeterministicEquityFundamentalsProvider(fixtureClock).getEquityFundamentals(aapl),
    "etf-info": await etf.getEtfInfo(vwce),
    "etf-holdings": await etf.getEtfHoldings(vwce),
    "etf-sectors": await etf.getEtfSectors(vwce),
    "etf-countries": await etf.getEtfCountries(vwce),
  } as const;
  for (const [family, value] of Object.entries(values)) {
    await store.set(family as keyof typeof values, key("round-trip"), value, now + HOUR, now);
    const entry = await store.get(family as keyof typeof values, key("round-trip"), now);
    assert.deepEqual(entry?.value, value, `${family} round-trips losslessly through jsonb`);
    assert.equal(typeof entry?.value, "object", `${family} is stored as a JSON document, not a JSON string`);
    assert.equal(entry?.expiresAt, now + HOUR, `${family} keeps its exact expiry`);
  }
  // Optional source, coverage and per-metric dates use the existing JSONB format, without migration.
  const tickerinside = new TickerInsideEtfAnalyticsProvider({ clock: fixtureClock, fetch: async () => Response.json({
    ticker: "SPY", page_url: "https://tickerinside.com/etf/spy/", cite_as: "TickerInside, SPY, issuer file 2026-01-15, CC BY 4.0",
    expense_ratio: 0.09, expense_ratio_as_of: "2025-12-31", aum_b: 500, aum_date: "2026-01-16", holdings_as_of: "2026-01-15",
    breakdown: { sectors_pct: { technology: 40 }, sector_coverage_pct: 40, no_sector_pct: 60, sectors_stated: false },
  }) });
  const spy = { ...vwce, instrumentId: "FMP:AMEX:SPY", symbol: "SPY", exchangeMic: "XASE", quoteCurrency: "USD" as const };
  for (const [family, value] of [
    ["etf-info", await tickerinside.getEtfInfo(spy)],
    ["etf-sectors", await tickerinside.getEtfSectors(spy)],
  ] as const) {
    await store.set(family, key("tickerinside"), value, now + HOUR, now);
    assert.deepEqual((await store.get(family, key("tickerinside"), now))?.value, value, `${family} preserves TickerInside dates, attribution and coverage`);
  }
  const decimals = { rate: 0.1, quarter: 0.25, ratio: 1.3333, fx: 23.456789, tiny: 1e-7, large: 3_420_000_000_000 };
  await store.set("fx", key("decimals"), decimals, now + HOUR, now);
  assert.deepEqual((await store.get("fx", key("decimals"), now))?.value, decimals, "decimal edge cases round-trip exactly");

  // Expired rows are never served, even before the purge runs.
  await store.set("quote", key("expiry"), values.quote, now + 30_000, now);
  assert.ok(await store.get("quote", key("expiry"), now + 29_999), "a quote is served inside its TTL");
  assert.equal(await store.get("quote", key("expiry"), now + 30_000), undefined, "a quote is not served at its expiry");

  // Upserts replace value and expiry; concurrent writers of one key do not fail.
  await store.set("instrument", key("upsert"), { ...aapl, name: "first" }, now + HOUR, now);
  await store.set("instrument", key("upsert"), { ...aapl, name: "second" }, now + 2 * HOUR, now + 1);
  const upserted = await store.get("instrument", key("upsert"), now);
  assert.equal((upserted?.value as { name: string }).name, "second");
  assert.equal(upserted?.expiresAt, now + 2 * HOUR);
  await Promise.all(Array.from({ length: 12 }, (_, index) => store.set("instrument", key("race"), { ...aapl, name: `w${index}` }, now + HOUR, now)));
  const raced = await db.select().from(marketDataCache).where(and(eq(marketDataCache.family, "instrument"), eq(marketDataCache.cacheKey, key("race"))));
  assert.equal(raced.length, 1, "concurrent upserts leave one row");

  // Rows from another format version, lossy values and oversized keys are ignored.
  await db.insert(marketDataCache).values({ family: "history", cacheKey: key("old-format"), formatVersion: MARKET_DATA_CACHE_FORMAT_VERSION - 1, value: { stale: true }, storedAt: new Date(now), expiresAt: new Date(now + HOUR) });
  assert.equal(await store.get("history", key("old-format"), now), undefined, "rows from an older format are not served");
  await store.set("equity-fundamentals", key("nan"), { ...values["equity-fundamentals"], broken: Number.NaN }, now + HOUR, now);
  assert.equal(await store.get("equity-fundamentals", key("nan"), now), undefined, "a value JSON cannot represent is not shared");
  await store.set("instrument", `${run}${"x".repeat(600)}`, aapl, now + HOUR, now);
  assert.equal((await db.select().from(marketDataCache).where(like(marketDataCache.cacheKey, `${run}x%`))).length, 0, "oversized keys are not written");

  // Purge removes expired rows only.
  await store.set("quote", key("purge-expired"), values.quote, now + 1_000, now);
  await store.set("history", key("purge-live"), values.history, now + HOUR, now);
  await store.purgeExpired(now + 30_000);
  const remaining = new Set((await db.select({ cacheKey: marketDataCache.cacheKey }).from(marketDataCache).where(like(marketDataCache.cacheKey, `%${run}%`))).map((row) => row.cacheKey));
  assert.ok(!remaining.has(key("purge-expired")) && !remaining.has(key("expiry")), "expired rows are purged");
  assert.ok(remaining.has(key("purge-live")), "live rows survive the purge");

  // Two instances sharing the table: the second performs no provider calls for slow-changing data.
  class CountingProvider extends DeterministicMarketDataProvider {
    override readonly providerId = run as never;
    readonly calls: string[] = [];
    override async getInstrumentMetadata(instrumentId: InstrumentId) { this.calls.push("metadata"); return super.getInstrumentMetadata(instrumentId); }
    override async getQuote(instrumentId: InstrumentId) { this.calls.push("quote"); return super.getQuote(instrumentId); }
    override async getHistoricalPrices(request: HistoricalPriceRequest) { this.calls.push("history"); return super.getHistoricalPrices(request); }
  }
  const instance = () => {
    const counting = new CountingProvider(fixtureClock);
    const service = new MarketDataService(counting, { cache: new TieredMarketDataCache({ clock: () => now, shared: store }), clock: fixtureClock });
    return { counting, service };
  };
  const request: HistoricalPriceRequest = { instrumentId: "US-XNAS:AAPL", startDate: "2026-01-05", endDate: "2026-01-16", interval: "daily", timeZone: "UTC", adjustment: adjustmentPolicies["split-adjusted"] };
  const first = instance();
  const firstView = await Promise.all([first.service.getQuote("US-XNAS:AAPL"), first.service.getHistoricalPrices(request)]);
  assert.deepEqual([...new Set(first.counting.calls)].sort(), ["history", "metadata", "quote"], "the first instance loads from the provider");
  const second = instance();
  const secondView = await Promise.all([second.service.getQuote("US-XNAS:AAPL"), second.service.getHistoricalPrices(request)]);
  assert.deepEqual(second.counting.calls, [], "another instance reuses metadata, quote and history");
  assert.deepEqual(secondView, firstView, "shared hits return the same normalized data and provenance");
  const raw = instance();
  await raw.service.getHistoricalPrices({ ...request, adjustment: adjustmentPolicies.raw });
  assert.ok(raw.counting.calls.includes("history"), "a different adjustment mode is a different cache entry");

  console.log("market-data shared cache: ok");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.delete(marketDataCache).where(like(marketDataCache.cacheKey, `%${run}%`));
  process.exit(process.exitCode ?? 0);
}
