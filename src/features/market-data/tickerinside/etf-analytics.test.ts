import { describe, expect, it, vi } from "vitest";
import type { Instrument } from "../contracts";
import { TickerInsideEtfAnalyticsProvider } from "./etf-analytics";

const spy: Instrument = { instrumentId: "FMP:AMEX:SPY", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "etf", exchangeMic: "XASE", quoteCurrency: "USD" };
// Small mocked current-file schema, not a stored live dataset. No history or flows.
const fundResponse = {
  ticker: "SPY", page_url: "https://tickerinside.com/etf/spy/",
  cite_as: "TickerInside, SPY, issuer file 2026-06-30, CC BY 4.0",
  cite_html: '<script>alert("untrusted")</script>',
  identifiers: { asset_type: "etf", exchange: "NYSE Arca" }, source_layer: "issuer",
  as_of: "2026-10-16", holdings_as_of: "2026-06-30",
  expense_ratio: 0.09, expense_ratio_as_of: "2026-01-15", aum_b: 500, aum_date: "2026-10-17",
  etf_class_net_assets_b: null, positions: 3, last_close: 650,
  holdings: { "BRK.B": 20, NVDA: 50, "7203.JP": 30 },
  breakdown: { sectors_pct: { technology: 50, financials: 20, consumer_discretionary: 30 }, sector_coverage_pct: 100, no_sector_pct: 0, sectors_stated: true, countries_pct: { US: 70, JP: 30 }, no_country_pct: 0 },
};
const now = () => new Date("2026-10-19T12:00:00.000Z");
function provider(payload: unknown = fundResponse) {
  const fetch = vi.fn(async () => Response.json(payload));
  return { fetch, source: new TickerInsideEtfAnalyticsProvider({ fetch, clock: now }) };
}

describe("TickerInside ETF analytics", () => {
  it("normalizes SPY with distinct source dates, provenance and safe attribution", async () => {
    const { source, fetch } = provider();
    const [info, holdings, sectors, countries] = await Promise.all([source.getEtfInfo(spy), source.getEtfHoldings(spy), source.getEtfSectors(spy), source.getEtfCountries(spy)]);
    expect(info).toMatchObject({ provider: "tickerinside", asOf: null, retrievedAt: now().toISOString(), isDeterministic: false, source: { name: "TickerInside", url: "https://tickerinside.com/etf/spy/", license: "CC BY 4.0" }, value: { expenseRatio: 0.0009, expenseRatioAsOf: "2026-01-15T00:00:00.000Z", assetsUnderManagement: 500_000_000_000, assetsCurrency: "USD", assetsAsOf: "2026-10-17T00:00:00.000Z", assetsScope: "fund", nav: null, navCurrency: null, inceptionDate: null, holdingsCount: null } });
    expect(holdings.asOf).toBe("2026-06-30T00:00:00.000Z");
    expect(holdings.value.totalCount).toBeNull();
    expect(holdings.value.rows.map((row) => [row.symbol, row.name, row.weight])).toEqual([["NVDA", "NVDA", 0.5], ["7203.JP", "7203.JP", 0.3], ["BRK.B", "BRK.B", 0.2]]);
    expect(holdings.value.rows.every((row) => row.isin === null && row.marketValue === null && row.shares === null)).toBe(true);
    expect(sectors.value[0]).toEqual({ name: "technology", weight: 0.5 });
    expect(countries.value).toEqual([{ name: "United States", weight: 0.7 }, { name: "Japan", weight: 0.3 }]);
    expect(sectors.asOf).toBe(holdings.asOf);
    expect(countries.completeness).toBe("complete");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("https://tickerinside.com/api/v1/fund/spy.json", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal), headers: { Accept: "application/json" } }));
    expect(JSON.stringify(info)).not.toContain("cite_html");
  });

  it.each([0, 0.09, 0.25, 1.3333])("converts expense ratio %s percentage points", async (expense_ratio) => {
    expect((await provider({ ...fundResponse, expense_ratio }).source.getEtfInfo(spy)).value.expenseRatio).toBe(expense_ratio / 100);
  });

  it("keeps missing/invalid optional values null and never substitutes net_assets or prices", async () => {
    const { source } = provider({ ticker: "SPY", net_assets: 9e12, last_close: 600, positions: 800, expense_ratio: null, aum_b: null });
    const info = await source.getEtfInfo(spy);
    expect(info.value).toMatchObject({ expenseRatio: null, assetsUnderManagement: null, assetsCurrency: null, assetsAsOf: null, expenseRatioAsOf: null, nav: null, holdingsCount: null, inceptionDate: null });
    for (const name of ["getEtfHoldings", "getEtfSectors", "getEtfCountries"] as const) await expect(source[name](spy)).rejects.toMatchObject({ code: "HistoricalDataUnavailable" });
    const invalid = await provider({ ...fundResponse, expense_ratio: "0.09", aum_b: -5, expense_ratio_as_of: "2026-02-30", aum_date: "invalid" }).source.getEtfInfo(spy);
    expect(invalid.value.expenseRatio).toBeNull();
    expect(invalid.value.assetsUnderManagement).toBeNull();
    expect(invalid.value.expenseRatioAsOf).toBeNull();
  });

  it("prefers explicitly dated ETF share-class assets and labels aggregate assets separately", async () => {
    const value = (await provider({ ...fundResponse, multi_class: true, etf_class_net_assets_b: 25.5, etf_class_net_assets_as_of: "2026-08-31" }).source.getEtfInfo(spy)).value;
    expect(value).toMatchObject({ assetsUnderManagement: 25_500_000_000, assetsCurrency: "USD", assetsScope: "etf-share-class", assetsAsOf: "2026-08-31T00:00:00.000Z" });
    expect((await provider({ ...fundResponse, multi_class: true }).source.getEtfInfo(spy)).value.assetsScope).toBe("all-share-classes");
    expect((await provider({ ...fundResponse, aum_b: 0 }).source.getEtfInfo(spy)).value.assetsUnderManagement).toBe(0);
  });

  it("retains every valid holding, rejects bad weights and marks missing coverage partial", async () => {
    const holdings = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`T${i}`, 2]));
    const { source } = provider({ ...fundResponse, holdings: { ...holdings, "005930.KR": 1.3333, "JPM.PFD": 0.1, BAD: -1, NULL: null, HUGE: 101 }, unmapped_pct: 2 });
    const result = await source.getEtfHoldings(spy);
    expect(result.value.rows).toHaveLength(42);
    expect(result.value.rows.find((row) => row.symbol === "005930.KR")?.weight).toBe(1.3333 / 100);
    expect(result.completeness).toBe("partial");
  });

  it("preserves incomplete original classifications and coverage without rescaling", async () => {
    const { source } = provider({ ...fundResponse, breakdown: { sectors_pct: { unusual_sector: 40, bad: -5 }, sector_coverage_pct: 40, no_sector_pct: 60, sectors_stated: false, countries_pct: { US: 70 }, no_country_pct: 30 } });
    expect(await source.getEtfSectors(spy)).toMatchObject({ completeness: "partial", value: [{ name: "unusual_sector", weight: 0.4 }], coverage: { knownWeight: 0.4, unclassifiedWeight: 0.6, inferred: true } });
    expect(await source.getEtfCountries(spy)).toMatchObject({ completeness: "partial", value: [{ name: "United States", weight: 0.7 }], coverage: { unclassifiedWeight: 0.3 } });
  });

  it.each([{}, null, []])("reports missing holdings/breakdowns as unavailable: %j", async (missing) => {
    const { source } = provider({ ...fundResponse, holdings: missing, breakdown: missing });
    await expect(source.getEtfInfo(spy)).resolves.toHaveProperty("value.expenseRatio", 0.0009);
    await expect(source.getEtfHoldings(spy)).rejects.toBeInstanceOf(Error);
    await expect(source.getEtfSectors(spy)).rejects.toBeInstanceOf(Error);
    await expect(source.getEtfCountries(spy)).rejects.toBeInstanceOf(Error);
  });

  it.each([[404, "UnsupportedInstrument"], [429, "RateLimited"], [500, "ProviderUnavailable"], [503, "ProviderUnavailable"]])("normalizes HTTP %s and allows retry", async (status, code) => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("failure", { status: status as number })).mockResolvedValueOnce(Response.json(fundResponse));
    const source = new TickerInsideEtfAnalyticsProvider({ fetch });
    await expect(source.getEtfInfo(spy)).rejects.toMatchObject({ code });
    await expect(source.getEtfInfo(spy)).resolves.toHaveProperty("provider", "tickerinside");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([[], null, { error: "failed" }, { ticker: "VOO" }, { ...fundResponse, kind: "mutual_fund" }, { ...fundResponse, identifiers: { asset_type: "etf", exchange: "XETRA" } }])("rejects malformed responses and mismatched securities: %j", async (payload) => {
    await expect(provider(payload).source.getEtfInfo(spy)).rejects.toMatchObject({ code: "MalformedProviderResponse" });
  });

  it("normalizes malformed JSON, network errors and bounded timeouts", async () => {
    const invalid = new TickerInsideEtfAnalyticsProvider({ fetch: async () => new Response("{") });
    await expect(invalid.getEtfInfo(spy)).rejects.toMatchObject({ code: "MalformedProviderResponse" });
    const offline = new TickerInsideEtfAnalyticsProvider({ fetch: async () => { throw new Error("offline"); } });
    await expect(offline.getEtfInfo(spy)).rejects.toMatchObject({ code: "ProviderUnavailable", context: { reason: "network" } });
    const timed = new TickerInsideEtfAnalyticsProvider({ timeoutMilliseconds: 5, fetch: async (_input, init) => new Promise((_resolve, reject) => { init!.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); }) });
    await expect(timed.getEtfInfo(spy)).rejects.toMatchObject({ code: "ProviderUnavailable", context: { reason: "timeout" } });
  });

  it.each([
    { instrumentId: "FMP:XETRA:VWCE", symbol: "VWCE", exchangeMic: "XETR", quoteCurrency: "EUR" },
    { instrumentId: "FMP:XETRA:SXR8", symbol: "SXR8", exchangeMic: "XETR" },
    { instrumentId: "FMP:LSE:SPY", exchangeMic: "XLON" },
    { instrumentId: "FMP:AMEX:SPY", exchangeMic: "XETR" },
    { instrumentId: "FMP:UNKNOWN:SPY", exchangeMic: null },
    { instrumentId: "FMP:AMEX:../SPY", symbol: "../SPY" },
    { instrumentId: "FMP:AMEX:SPY", symbol: "VOO" },
    { assetType: "equity" },
  ])("rejects unsupported or conflicting identities before HTTP: %j", async (override) => {
    const { source, fetch } = provider();
    await expect(source.getEtfInfo({ ...spy, ...override } as Instrument)).rejects.toMatchObject({ code: "UnsupportedInstrument" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["SPY", "VOO", "IVV", "QQQ", "VTI"])("accepts verified US listing %s", async (symbol) => {
    const exchange = symbol === "QQQ" ? "NASDAQ" : "AMEX";
    const result = await provider({ ...fundResponse, ticker: symbol }).source.getEtfInfo({ ...spy, symbol, instrumentId: `FMP:${exchange}:${symbol}`, exchangeMic: exchange === "NASDAQ" ? "XNAS" : "XASE" });
    expect(result.instrumentId).toBe(`FMP:${exchange}:${symbol}`);
  });

  it("coalesces across datasets and expires the bounded short snapshot cache", async () => {
    let time = now().getTime();
    const fetch = vi.fn(async () => Response.json(fundResponse));
    const source = new TickerInsideEtfAnalyticsProvider({ fetch, clock: () => new Date(time) });
    await Promise.all(Array.from({ length: 4 }, () => Promise.all([source.getEtfInfo(spy), source.getEtfHoldings(spy), source.getEtfSectors(spy), source.getEtfCountries(spy)])));
    expect(fetch).toHaveBeenCalledTimes(1);
    time += 60_001;
    await source.getEtfInfo(spy);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("never follows an untrusted attribution URL", async () => {
    expect((await provider({ ...fundResponse, page_url: "javascript:alert(1)" }).source.getEtfInfo(spy)).source?.url).toBe("https://tickerinside.com/api/v1/fund/spy.json");
  });
});
