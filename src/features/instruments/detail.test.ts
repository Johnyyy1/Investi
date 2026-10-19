import { describe, expect, it, vi } from "vitest";
import { MarketDataError } from "@/features/market-data/errors";
import { createDeterministicMarketDataService } from "@/features/market-data/deterministic/service";
import { historicalRequest } from "./history";
import { loadInstrumentDetail } from "./detail";

const now = new Date("2026-01-16T20:50:00.000Z");

describe("instrument detail loading", () => {
  it.each([["US-XNAS:AAPL", "equity"], ["IE-XETR:VWCE", "etf"]])("loads deterministic %s identity, quote and split-adjusted closes", async (id, assetType) => {
    const detail = await loadInstrumentDetail(createDeterministicMarketDataService(), id, "1Y", now);
    expect(detail.instrument?.assetType).toBe(assetType);
    expect(detail.quote?.price).toBeGreaterThan(0);
    expect(detail.points.length).toBe(id === "US-XNAS:AAPL" ? 260 : 10);
    expect(detail.historyMessage).toBeNull();
    if (assetType === "equity") {
      expect(detail.fundamentals?.valuation.marketCap).toBeGreaterThan(0);
      expect(detail.fundamentals?.provenance.isDeterministic).toBe(true);
    } else {
      expect(detail.fundamentals).toBeNull();
      expect(detail.fundamentalsMessage).toBeNull();
      expect(detail.etfAnalytics?.holdings?.value.rows.length).toBeGreaterThanOrEqual(10);
      expect(detail.etfAnalytics?.sectors?.value.length).toBeGreaterThan(0);
      expect(detail.etfAnalytics?.countries?.value.length).toBeGreaterThan(0);
    }
  });
  it("preserves quote when history is unavailable", async () => {
    const service = createDeterministicMarketDataService();
    vi.spyOn(service, "getHistoricalPrices").mockRejectedValue(new MarketDataError("HistoricalDataUnavailable", "upstream failure"));
    const detail = await loadInstrumentDetail(service, "US-XNAS:AAPL", "1Y", now);
    expect(detail.quote?.price).toBe(114);
    expect(detail.points).toEqual([]);
    expect(detail.historyMessage).toMatch(/není dostupná/);
  });
  it("keeps the expanded AAPL weekday series explicitly synthetic", async () => {
    const service = createDeterministicMarketDataService();
    const series = await service.getHistoricalPrices(historicalRequest("US-XNAS:AAPL", "1Y", now));
    expect(series.provenance).toMatchObject({ dataKind: "synthetic", isDeterministic: true, isDemo: true, adjustmentMode: "split-adjusted" });
    const month = await loadInstrumentDetail(service, "US-XNAS:AAPL", "1M", now);
    expect(month.points.length).toBeGreaterThan(10);
    expect(month.points.length).toBeLessThan(series.points.length);
    expect(month.points.at(-1)).toMatchObject({ date: "2026-01-16", close: 114, open: expect.any(Number), high: expect.any(Number), low: expect.any(Number) });
  });
  it("preserves chart when quote is unavailable", async () => {
    const service = createDeterministicMarketDataService();
    vi.spyOn(service, "getQuote").mockRejectedValue(new MarketDataError("QuoteUnavailable", "upstream failure"));
    const detail = await loadInstrumentDetail(service, "US-XNAS:AAPL", "1Y", now);
    expect(detail.quote).toBeNull();
    expect(detail.quoteMessage).toMatch(/není dostupná/);
    expect(detail.points.length).toBe(260);
  });
  it("keeps the chart and quote when all company metrics fail", async () => {
    const service = createDeterministicMarketDataService();
    vi.spyOn(service, "getEquityFundamentals").mockRejectedValue(new MarketDataError("ProviderConfiguration", "restricted"));
    const detail = await loadInstrumentDetail(service, "US-XNAS:AAPL", "1Y", now);
    expect(detail.fundamentals).toBeNull();
    expect(detail.fundamentalsMessage).toMatch(/nejsou dostupné/);
    expect(detail.quote?.price).toBe(114);
    expect(detail.points.length).toBe(260);
  });
  it("keeps the ETF chart and quote when all ETF analytics fail", async () => {
    const service = createDeterministicMarketDataService();
    vi.spyOn(service, "getEtfAnalytics").mockRejectedValue(new MarketDataError("ProviderConfiguration", "restricted"));
    const detail = await loadInstrumentDetail(service, "IE-XETR:VWCE", "1Y", now);
    expect(detail.etfAnalytics).toBeNull();
    expect(detail.etfAnalyticsMessage).toMatch(/není dostupné/);
    expect(detail.quote?.price).toBe(124);
    expect(detail.points.length).toBe(10);
  });
  it("handles an empty requested range without manufacturing dates", async () => {
    const detail = await loadInstrumentDetail(createDeterministicMarketDataService(), "US-XNAS:AAPL", "1M", new Date("2026-09-21T00:00:00.000Z"));
    expect(detail.points).toEqual([]);
    expect(detail.historyMessage).toMatch(/není dostupná/);
  });
  it.each([["UnsupportedInstrument", "zdroj nepokrývá"], ["RateLimited", "dočasně omezený"]] as const)("explains ETF %s while retaining prices and history", async (code, message) => {
    const service = createDeterministicMarketDataService();
    vi.spyOn(service, "getEtfAnalytics").mockRejectedValue(new MarketDataError(code, "unavailable"));
    const detail = await loadInstrumentDetail(service, "IE-XETR:VWCE", "1Y", now);
    expect(detail.etfAnalyticsMessage).toContain(message);
    expect(detail.quote?.price).toBe(124);
    expect(detail.points.length).toBe(10);
  });
  it("keeps a missing instrument distinct from a missing quote", async () => {
    const detail = await loadInstrumentDetail(createDeterministicMarketDataService(), "FMP:NASDAQ:AAPL", "1Y", now);
    expect(detail.instrument).toBeNull();
    expect(detail.metadataMessage).toMatch(/není.*k dispozici/);
    expect(detail.instrumentMissing).toBe(true);
  });
  it("keeps an unreachable source distinct from an unknown instrument", async () => {
    const service = createDeterministicMarketDataService();
    vi.spyOn(service, "getInstrumentMetadata").mockRejectedValue(new MarketDataError("ProviderUnavailable", "upstream failure"));
    const detail = await loadInstrumentDetail(service, "US-XNAS:AAPL", "1Y", now);
    expect(detail.instrument).toBeNull();
    expect(detail.instrumentMissing).toBe(false);
    expect(detail.metadataMessage).toMatch(/není.*k dispozici/);
  });
  it("derives price-only metrics from the loaded closes", async () => {
    const detail = await loadInstrumentDetail(createDeterministicMarketDataService(), "US-XNAS:AAPL", "1Y", now);
    expect(detail.metrics?.observationCount).toBe(detail.points.length);
    expect(detail.metrics?.periodReturn).toBeCloseTo(detail.points.at(-1)!.close / detail.points[0].close - 1, 12);
  });
  it("converts a non-CZK quote with a dated reference rate", async () => {
    const detail = await loadInstrumentDetail(createDeterministicMarketDataService(), "US-XNAS:AAPL", "1Y", now);
    expect(detail.homeCurrency?.rate).toBeGreaterThan(0);
    expect(detail.homeCurrency?.referenceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(detail.homeCurrencyMessage).toBeNull();
  });
  it("keeps the quote and reports the conversion as unavailable when FX fails", async () => {
    const service = createDeterministicMarketDataService();
    vi.spyOn(service, "getFxRate").mockRejectedValue(new MarketDataError("FxUnavailable", "no rate"));
    const detail = await loadInstrumentDetail(service, "US-XNAS:AAPL", "1Y", now);
    expect(detail.quote?.price).toBe(114);
    expect(detail.homeCurrency).toBeNull();
    expect(detail.homeCurrencyMessage).toMatch(/Přepočet do korun teď není dostupný/);
  });
  it("leaves the metrics empty when history is unavailable instead of inventing returns", async () => {
    const service = createDeterministicMarketDataService();
    vi.spyOn(service, "getHistoricalPrices").mockRejectedValue(new MarketDataError("HistoricalDataUnavailable", "upstream failure"));
    const detail = await loadInstrumentDetail(service, "US-XNAS:AAPL", "1Y", now);
    expect(detail.metrics).toBeNull();
  });
});
