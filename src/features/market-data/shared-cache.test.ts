import { describe, expect, it, vi } from "vitest";

import { loadInstrumentDetail } from "@/features/instruments/detail";
import {
  InMemoryMarketDataCache,
  NoopMarketDataCache,
  TieredMarketDataCache,
  TtlStore,
  type MarketDataCacheFamily,
  type SharedMarketDataCacheStore,
} from "./cache";
import { createMarketDataService } from "./composition";
import { adjustmentPolicies, type HistoricalPriceRequest } from "./contracts";
import { FIXTURE_RETRIEVED_AT } from "./deterministic/fixtures";
import { DeterministicMarketDataProvider } from "./deterministic/provider";
import type { FmpFetch } from "./fmp/client";
import { MarketDataService } from "./service";

const AAPL = "US-XNAS:AAPL";

/** Stores JSON text like a database column, so a hit is a structural copy rather than the same object. */
class FakeSharedStore implements SharedMarketDataCacheStore {
  readonly rows = new Map<string, { json: string; expiresAt: number }>();
  reads = 0;
  failing = false;

  async get(family: MarketDataCacheFamily, key: string, now: number) {
    this.reads += 1;
    if (this.failing) throw new Error("connection refused: postgres://secret@db");
    const row = this.rows.get(`${family}|${key}`);
    return row && row.expiresAt > now ? { value: JSON.parse(row.json) as unknown, expiresAt: row.expiresAt } : undefined;
  }

  async set(family: MarketDataCacheFamily, key: string, value: unknown, expiresAt: number) {
    if (this.failing) throw new Error("connection refused: postgres://secret@db");
    this.rows.set(`${family}|${key}`, { json: JSON.stringify(value), expiresAt });
  }

  families() {
    return [...this.rows.keys()].map((key) => key.slice(0, key.indexOf("|"))).sort();
  }
}

describe("process-local TTL store", () => {
  it("expires entries after their TTL", () => {
    let now = 0;
    const store = new TtlStore<string>(1_000, () => now);
    store.set("a", "value");
    now = 999;
    expect(store.get("a")).toBe("value");
    now = 1_000;
    expect(store.get("a")).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it("evicts the least recently used entry once the limit is reached", () => {
    const store = new TtlStore<number>(60_000, () => 0, 3);
    store.set("a", 1);
    store.set("b", 2);
    store.set("c", 3);
    expect(store.get("a")).toBe(1);
    store.set("d", 4);
    expect(store.size).toBe(3);
    expect(store.get("b")).toBeUndefined();
    expect([store.get("a"), store.get("c"), store.get("d")]).toEqual([1, 3, 4]);
  });

  it("sweeps expired entries of other keys periodically on writes", () => {
    let now = 0;
    const store = new TtlStore<number>(1_000, () => now, 100, 5_000);
    for (let index = 0; index < 50; index += 1) store.set(`search-${index}`, index);
    now = 4_000;
    store.set("early", 1);
    expect(store.size).toBe(51);
    now = 5_000;
    store.set("late", 2);
    expect(store.size).toBe(1);
    expect(store.get("late")).toBe(2);
  });

  it("never extends an entry beyond its own TTL and ignores already-expired entries", () => {
    let now = 0;
    const store = new TtlStore<string>(1_000, () => now);
    store.set("long", "value", 60_000);
    store.set("expired", "value", 0);
    expect(store.get("expired")).toBeUndefined();
    now = 1_000;
    expect(store.get("long")).toBeUndefined();
  });

  it("bounds every family of the in-memory market-data cache", async () => {
    const cache = new InMemoryMarketDataCache({ clock: () => 0, maxEntries: { search: 2 } });
    for (const query of ["a", "b", "c", "d"]) await cache.setSearch(query, []);
    expect(cache.localSize("search")).toBe(2);
    await expect(cache.getSearch("a")).resolves.toBeUndefined();
    await expect(cache.getSearch("d")).resolves.toEqual([]);
    expect(() => new InMemoryMarketDataCache({ maxEntries: { history: 0 } })).toThrow(RangeError);
  });
});

describe("tiered market-data cache", () => {
  it("serves a shared hit to a fresh instance and keeps only its remaining lifetime locally", async () => {
    let now = 0;
    const shared = new FakeSharedStore();
    const provider = new DeterministicMarketDataProvider(() => new Date(FIXTURE_RETRIEVED_AT));
    const instrument = await provider.getInstrumentMetadata(AAPL);
    await new TieredMarketDataCache({ clock: () => now, shared }).setInstrument("key", instrument);

    now = 23 * 60 * 60 * 1_000;
    const otherInstance = new TieredMarketDataCache({ clock: () => now, shared });
    await expect(otherInstance.getInstrument("key")).resolves.toEqual(instrument);
    expect(shared.reads).toBe(1);
    await otherInstance.getInstrument("key");
    expect(shared.reads).toBe(1);

    now = 24 * 60 * 60 * 1_000;
    await expect(otherInstance.getInstrument("key")).resolves.toBeUndefined();
    await expect(new TieredMarketDataCache({ clock: () => now, shared }).getInstrument("key")).resolves.toBeUndefined();
  });

  it("keeps quotes short-lived in the shared layer too", async () => {
    let now = 0;
    const shared = new FakeSharedStore();
    const quote = await new DeterministicMarketDataProvider(() => new Date(FIXTURE_RETRIEVED_AT)).getQuote(AAPL);
    await new TieredMarketDataCache({ clock: () => now, shared }).setQuote("key", quote);
    now = 29_000;
    await expect(new TieredMarketDataCache({ clock: () => now, shared }).getQuote("key")).resolves.toEqual(quote);
    now = 30_000;
    await expect(new TieredMarketDataCache({ clock: () => now, shared }).getQuote("key")).resolves.toBeUndefined();
  });

  it("keeps free-text search out of the shared store", async () => {
    const shared = new FakeSharedStore();
    const cache = new TieredMarketDataCache({ clock: () => 0, shared });
    await cache.setSearch("apple", []);
    await cache.getSearch("unknown");
    expect(shared.rows.size).toBe(0);
    expect(shared.reads).toBe(0);
  });

  it("degrades to the provider when the shared store fails, without leaking the error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const shared = new FakeSharedStore();
    shared.failing = true;
    const provider = new DeterministicMarketDataProvider(() => new Date(FIXTURE_RETRIEVED_AT));
    const service = new MarketDataService(provider, {
      cache: new TieredMarketDataCache({ clock: () => Date.parse(FIXTURE_RETRIEVED_AT), shared }),
      clock: () => new Date(FIXTURE_RETRIEVED_AT),
    });
    await expect(service.getInstrumentMetadata(AAPL)).resolves.toMatchObject({ instrumentId: AAPL });
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
    warn.mockRestore();
  });

  it("separates cache keys by provider and by price-adjustment mode", async () => {
    class RecordingCache extends NoopMarketDataCache {
      readonly history: string[] = [];
      readonly instruments: string[] = [];
      override async getHistory(key: string) { this.history.push(key); return undefined; }
      override async getInstrument(key: string) { this.instruments.push(key); return undefined; }
    }
    class OtherProvider extends DeterministicMarketDataProvider {
      override readonly providerId = "other-provider" as never;
    }
    const request = (mode: "raw" | "split-adjusted"): HistoricalPriceRequest => ({
      instrumentId: AAPL,
      startDate: "2026-01-05",
      endDate: "2026-01-16",
      interval: "daily",
      timeZone: "UTC",
      adjustment: adjustmentPolicies[mode],
    });
    const cache = new RecordingCache();
    const clock = () => new Date(FIXTURE_RETRIEVED_AT);
    const first = new MarketDataService(new DeterministicMarketDataProvider(clock), { cache, clock });
    const second = new MarketDataService(new OtherProvider(clock), { cache, clock });
    await first.getHistoricalPrices(request("raw"));
    await first.getHistoricalPrices(request("split-adjusted"));
    await second.getHistoricalPrices(request("raw")).catch(() => undefined);
    await first.getInstrumentMetadata(AAPL);
    await second.getInstrumentMetadata(AAPL).catch(() => undefined);

    const historyKeys = [...new Set(cache.history)].map((key) => JSON.parse(key) as string[]);
    expect(historyKeys.map((key) => [key[0], key.at(-1)])).toEqual([
      ["investi-deterministic", "raw"],
      ["investi-deterministic", "split-adjusted"],
      ["other-provider", "raw"],
    ]);
    expect(new Set(cache.instruments)).toEqual(new Set([JSON.stringify(["investi-deterministic", AAPL]), JSON.stringify(["other-provider", AAPL])]));
  });
});

describe("FMP requests per instrument detail view", () => {
  const NOW = "2026-09-21T10:00:00.000Z";
  const profiles: Record<string, unknown> = {
    AAPL: { symbol: "AAPL", companyName: "Apple Inc.", currency: "USD", exchange: "NASDAQ", isEtf: false, isFund: false },
    SPY: { symbol: "SPY", companyName: "SPDR S&P 500 ETF", currency: "USD", exchange: "NYSE", isEtf: true, isFund: false },
  };
  const payloads: Record<string, (symbol: string) => unknown> = {
    profile: (symbol) => [profiles[symbol]],
    quote: (symbol) => [{ symbol, price: 245.5, timestamp: Date.parse("2026-09-18T19:55:00.000Z") / 1_000 }],
    full: (symbol) => [
      { symbol, date: "2026-09-18", open: 244, high: 247, low: 243, close: 246, volume: 1_200 },
      { symbol, date: "2026-09-17", open: 240, high: 243, low: 239, close: 242, volume: 1_000 },
    ],
    "key-metrics-ttm": (symbol) => [{ symbol, evToEBITDATTM: 24.8, returnOnEquityTTM: 1.452 }],
    "ratios-ttm": (symbol) => [{ symbol, priceToEarningsRatioTTM: 31.4 }],
    "income-statement": (symbol) => [{ symbol, date: "2025-09-27", filingDate: "2025-10-31", period: "FY", reportedCurrency: "USD", revenue: 391_000_000_000, netIncome: 96_000_000_000, epsDiluted: 6.42 }],
    "cash-flow-statement": (symbol) => [{ symbol, date: "2025-09-27", filingDate: "2025-10-31", period: "FY", reportedCurrency: "USD", freeCashFlow: 108_000_000_000 }],
  };

  function instance(fmpRequests: string[], sharedCache?: SharedMarketDataCacheStore) {
    const fetch = vi.fn<FmpFetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const endpoint = url.pathname.split("/").at(-1)!;
      fmpRequests.push(url.pathname.replace("/stable/", ""));
      return Response.json(payloads[endpoint](url.searchParams.get("symbol")!));
    });
    return createMarketDataService({
      provider: "fmp",
      fxProvider: "deterministic",
      fmpApiKey: "test-only",
      fmpBaseUrl: "https://fmp.test/stable",
      fetch,
      tickerinsideFetch: async () => {
        fmpRequests.push("tickerinside/fund/spy.json");
        return Response.json({ ticker: "SPY", expense_ratio: 0.09, holdings: { AAPL: 100 }, holdings_as_of: "2026-06-01", breakdown: { sectors_pct: { technology: 100 }, sectors_stated: true, countries_pct: { US: 100 } } });
      },
      clock: () => new Date(NOW),
      ...(sharedCache ? { sharedCache } : {}),
    });
  }

  async function viewTwiceFromDifferentInstances(instrumentId: string, sharedCache?: SharedMarketDataCacheStore) {
    const first: string[] = [];
    const second: string[] = [];
    const detail = await loadInstrumentDetail(instance(first, sharedCache), instrumentId, "5Y", new Date(NOW));
    expect(detail.instrument).not.toBeNull();
    expect(detail.points.length).toBeGreaterThan(0);
    const repeated = await loadInstrumentDetail(instance(second, sharedCache), instrumentId, "5Y", new Date(NOW));
    expect(repeated.points).toEqual(detail.points);
    expect(repeated.fundamentals ?? repeated.etfAnalytics).toEqual(detail.fundamentals ?? detail.etfAnalytics);
    return { first: first.sort(), second: second.sort() };
  }

  it("calls FMP for the whole equity detail again on another instance without a shared layer", async () => {
    const { first, second } = await viewTwiceFromDifferentInstances("FMP:NASDAQ:AAPL");
    expect(first).toHaveLength(9);
    expect(second).toEqual(first);
  });

  it("serves metadata, history and fundamentals to another instance from the shared layer", async () => {
    const shared = new FakeSharedStore();
    const { first, second } = await viewTwiceFromDifferentInstances("FMP:NASDAQ:AAPL", shared);
    expect(first).toHaveLength(9);
    // Within the 30 s quote TTL the repeated view needs no FMP request at all.
    expect(second).toEqual([]);
    expect(shared.families()).toEqual(["equity-fundamentals", "history", "instrument", "quote"]);
  });

  it("only refreshes the quote once its short TTL has passed", async () => {
    let now = Date.parse(NOW);
    const shared = new FakeSharedStore();
    // The service clock stays fixed; only the shared store observes time passing.
    const timedShared: SharedMarketDataCacheStore = {
      get: (family, key) => shared.get(family, key, now),
      set: (family, key, value, expiresAt) => shared.set(family, key, value, expiresAt),
    };
    await loadInstrumentDetail(instance([], timedShared), "FMP:NASDAQ:AAPL", "5Y", new Date(NOW));
    now += 60_000;
    const requests: string[] = [];
    await loadInstrumentDetail(instance(requests, timedShared), "FMP:NASDAQ:AAPL", "5Y", new Date(NOW));
    // The FMP adapter resolves the quote currency through its own profile request.
    expect(requests.sort()).toEqual(["profile", "quote"]);
  });

  it("serves every ETF dataset to another instance from the shared layer", async () => {
    const withoutShared = await viewTwiceFromDifferentInstances("FMP:NYSE:SPY");
    expect(withoutShared.first).toHaveLength(6);
    expect(withoutShared.first.filter((path) => path.startsWith("tickerinside/"))).toEqual(["tickerinside/fund/spy.json"]);
    expect(withoutShared.first.some((path) => path.startsWith("etf/"))).toBe(false);
    expect(withoutShared.second).toEqual(withoutShared.first);

    const shared = new FakeSharedStore();
    const withShared = await viewTwiceFromDifferentInstances("FMP:NYSE:SPY", shared);
    expect(withShared.second).toEqual([]);
    expect(shared.families()).toEqual(["etf-countries", "etf-holdings", "etf-info", "etf-sectors", "history", "instrument", "quote"]);
  });
});
