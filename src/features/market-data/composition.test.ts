import { describe, expect, it, vi } from "vitest";

import { createMarketDataService } from "./composition";
import { FIXTURE_RETRIEVED_AT } from "./deterministic/fixtures";
import { defaultMarketDataCacheTtls, type SharedMarketDataCacheStore } from "./cache";
import { adjustmentPolicies } from "./contracts";

describe("market-data provider composition", () => {
  it("selects deterministic data explicitly", async () => {
    const service = createMarketDataService({ provider: "deterministic", fxProvider: "deterministic" });
    await expect(service.searchInstruments("AAPL")).resolves.toEqual([
      expect.objectContaining({ instrumentId: "US-XNAS:AAPL", provider: "investi-deterministic" }),
    ]);
  });

  it("fails fast when FMP is selected without a server credential", () => {
    expect(() => createMarketDataService({ provider: "fmp", fxProvider: "frankfurter", fmpApiKey: "" })).toThrowError(expect.objectContaining({
      code: "ProviderConfiguration",
    }));
  });

  it("requires an explicit FX provider when live security data is selected", () => {
    expect(() => createMarketDataService({ provider: "fmp", fmpApiKey: "server-only-test-key" })).toThrowError(expect.objectContaining({
      code: "ProviderConfiguration",
      context: expect.objectContaining({ reason: "missing-fx-provider" }),
    }));
  });

  it("rejects unknown provider names without a fallback", () => {
    expect(() => createMarketDataService({ provider: "unknown", fxProvider: "deterministic" })).toThrowError(expect.objectContaining({
      code: "ProviderConfiguration",
    }));
  });

  it("can serve the CZK identity rate in FMP plus Frankfurter mode without a network call", async () => {
    const fetchMock = vi.fn();
    const frankfurterFetch = vi.fn();
    const service = createMarketDataService({
      provider: "fmp",
      fxProvider: "frankfurter",
      fmpApiKey: "server-only-test-key",
      fetch: fetchMock,
      frankfurterFetch,
      clock: () => new Date(FIXTURE_RETRIEVED_AT),
    });

    await expect(service.getFxRate("CZK", "CZK", FIXTURE_RETRIEVED_AT)).resolves.toMatchObject({ rate: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(frankfurterFetch).not.toHaveBeenCalled();
  });

  it("routes security capabilities to FMP and FX capability to Frankfurter", async () => {
    const fmpFetch = vi.fn(async (input: string | URL | Request) => {
      void input;
      return Response.json([
        { symbol: "AAPL", name: "Apple Inc.", currency: "USD", exchange: "NASDAQ", exchangeFullName: "NASDAQ Global Select" },
      ]);
    });
    const frankfurterFetch = vi.fn(async (input: string | URL | Request) => {
      void input;
      return Response.json({ date: "2026-01-16", base: "USD", quote: "CZK", rate: 22.1 });
    });
    const service = createMarketDataService({
      provider: "fmp",
      fxProvider: "frankfurter",
      fmpApiKey: "server-only-test-key",
      fetch: fmpFetch,
      frankfurterFetch,
      clock: () => new Date(FIXTURE_RETRIEVED_AT),
    });

    await expect(service.searchInstruments("AAPL")).resolves.toEqual([
      expect.objectContaining({ instrumentId: "FMP:NASDAQ:AAPL", provider: "financial-modeling-prep" }),
    ]);
    await expect(service.getFxRate("USD", "CZK", FIXTURE_RETRIEVED_AT)).resolves.toMatchObject({
      rate: 22.1,
      referenceDate: "2026-01-16",
      provenance: { provider: "frankfurter" },
    });
    expect(new URL(fmpFetch.mock.calls[0][0].toString()).pathname).toContain("/stable/search-symbol");
    expect(new URL(frankfurterFetch.mock.calls[0][0].toString()).pathname).toBe("/v2/rate/USD/CZK");
  });

  it("routes ETF analytics to TickerInside with JSON shared caching, independent expiry and partial sections", async () => {
    let time = Date.parse("2026-10-19T12:00:00.000Z");
    const stored = new Map<string, { value: unknown; expiresAt: number }>();
    const sharedCache: SharedMarketDataCacheStore = {
      async get(family, key, now) { const hit = stored.get(`${family}:${key}`); return hit && hit.expiresAt > now ? hit : undefined; },
      async set(family, key, value, expiresAt) { stored.set(`${family}:${key}`, { value: JSON.parse(JSON.stringify(value)), expiresAt }); },
    };
    const fmpFetch = vi.fn(async (input: string | URL | Request) => {
      const path = new URL(input.toString()).pathname;
      if (path.endsWith("/profile")) return Response.json([{ symbol: "SPY", companyName: "SPDR S&P 500 ETF Trust", currency: "USD", exchange: "AMEX", isEtf: true, isFund: false }]);
      throw new Error(`Unexpected FMP endpoint: ${path}`);
    });
    let countriesAvailable = false;
    const tickerinsideFetch = vi.fn(async () => Response.json({ ticker: "SPY", page_url: "https://tickerinside.com/etf/spy/", cite_as: "TickerInside, SPY, issuer file 2026-10-15, CC BY 4.0", expense_ratio: 0.09, aum_b: 500, holdings_as_of: "2026-10-15", holdings: { NVDA: 100 }, breakdown: { sectors_pct: { technology: 100 }, sectors_stated: true, countries_pct: countriesAvailable ? { US: 100 } : null } }));
    const options = { provider: "fmp", fxProvider: "deterministic", fmpApiKey: "test-key", fetch: fmpFetch, tickerinsideFetch, sharedCache, clock: () => new Date(time) };
    const firstService = createMarketDataService(options);
    const [first, same] = await Promise.all([firstService.getEtfAnalytics("FMP:AMEX:SPY"), firstService.getEtfAnalytics("FMP:AMEX:SPY")]);
    expect(first).toEqual(same);
    expect(first.unavailableDatasets).toEqual(["countries"]);
    expect(tickerinsideFetch).toHaveBeenCalledTimes(1);
    const second = await createMarketDataService(options).getEtfAnalytics("FMP:AMEX:SPY");
    expect(second).toEqual(first);
    // The unavailable country dataset is retried; the other three survive a fresh process cache.
    expect(tickerinsideFetch).toHaveBeenCalledTimes(2);
    countriesAvailable = true;
    time += defaultMarketDataCacheTtls.etfHoldingsMilliseconds + 1;
    const refreshed = await firstService.getEtfAnalytics("FMP:AMEX:SPY");
    expect(refreshed.unavailableDatasets).toEqual([]);
    expect(refreshed.info?.retrievedAt).toBe(first.info?.retrievedAt);
    expect(refreshed.holdings?.retrievedAt).not.toBe(first.holdings?.retrievedAt);
    expect(refreshed.info?.source).toEqual(first.info?.source);
    const calls = tickerinsideFetch.mock.calls.length;
    expect(await createMarketDataService(options).getEtfAnalytics("FMP:AMEX:SPY")).toEqual(refreshed);
    expect(tickerinsideFetch).toHaveBeenCalledTimes(calls);
    expect([...stored.keys()].filter((key) => key.startsWith("etf-")).every((key) => key.includes("tickerinside"))).toBe(true);
    expect(fmpFetch).toHaveBeenCalledTimes(1);
  });

  it.each([["SPY", "AMEX", "USD"], ["VWCE", "XETRA", "EUR"]])("keeps FMP prices/history independent of analytics coverage for %s", async (symbol, exchange, currency) => {
    const fmpFetch = vi.fn(async (input: string | URL | Request) => {
      const path = new URL(input.toString()).pathname;
      if (path.endsWith("/profile")) return Response.json([{ symbol, companyName: "Test ETF", currency, exchange, isEtf: true, isFund: false }]);
      if (path.endsWith("/quote")) return Response.json([{ symbol, price: 600, timestamp: Date.parse("2026-10-16T20:00:00.000Z") / 1_000 }]);
      if (path.includes("historical-price-eod")) return Response.json([{ symbol, date: "2026-10-15", open: 590, high: 605, low: 580, close: 600, volume: 1_000 }]);
      throw new Error(`Unexpected FMP endpoint: ${path}`);
    });
    const tickerinsideFetch = vi.fn(async () => new Response("missing", { status: 404 }));
    const service = createMarketDataService({ provider: "fmp", fxProvider: "deterministic", fmpApiKey: "test-key", fetch: fmpFetch, tickerinsideFetch, clock: () => new Date("2026-10-17T12:00:00.000Z") });
    const instrumentId = `FMP:${exchange}:${symbol}`;
    await expect(service.getEtfAnalytics(instrumentId)).rejects.toMatchObject({ code: "UnsupportedInstrument" });
    expect(tickerinsideFetch).toHaveBeenCalledTimes(symbol === "SPY" ? 1 : 0);
    expect((await service.getQuote(instrumentId)).price).toBe(600);
    expect((await service.getHistoricalPrices({ instrumentId, startDate: "2026-10-15", endDate: "2026-10-16", interval: "daily", timeZone: "UTC", adjustment: adjustmentPolicies["split-adjusted"] })).points[0].close).toBe(600);
    expect(fmpFetch.mock.calls.every(([input]) => !new URL(input.toString()).pathname.includes("/etf/"))).toBe(true);
  });
});
