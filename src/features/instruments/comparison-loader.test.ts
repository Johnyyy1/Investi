import { describe, expect, it, vi } from "vitest";
import { MarketDataError } from "@/features/market-data/errors";
import { createDeterministicMarketDataService } from "@/features/market-data/deterministic/service";
import { loadInstrumentComparison } from "./comparison-loader";

const now = new Date("2026-01-16T20:50:00.000Z");

function serviceWithInverseMsft() {
  const service = createDeterministicMarketDataService();
  const original = service.getHistoricalPrices.bind(service);
  vi.spyOn(service, "getHistoricalPrices").mockImplementation(async (request) => {
    if (request.instrumentId !== "US-XNAS:MSFT") return original(request);
    const aapl = await original({ ...request, instrumentId: "US-XNAS:AAPL" });
    return { ...aapl, instrumentId: "US-XNAS:MSFT", points: aapl.points.map((point) => ({ ...point, close: 20_000 / point.close })) };
  });
  return service;
}

describe("instrument comparison loading", () => {
  it("compares two histories loaded through the market data service over their common dates", async () => {
    const result = await loadInstrumentComparison(serviceWithInverseMsft(), "US-XNAS:AAPL", "US-XNAS:MSFT", "1Y", now);
    expect(result).toMatchObject({ range: "1Y", startDate: "2025-01-16", endDate: "2026-01-16", instrumentMissing: false, correlationMessage: null });
    expect(result.instruments.map((side) => side.instrument?.symbol)).toEqual(["AAPL", "MSFT"]);
    expect(result.instruments.map((side) => side.provenance?.dataKind)).toEqual(["synthetic", "synthetic"]);
    const comparison = result.comparison!;
    expect(comparison.shorterThanRange).toBe(false);
    expect(comparison.points[0]).toMatchObject({ first: 100, second: 100 });
    expect(comparison.points.at(-1)?.date).toBe("2026-01-16");
    expect(comparison.correlation.status).toBe("ok");
    if (comparison.correlation.status === "ok") expect(comparison.correlation.coefficient).toBeLessThan(-0.99);
    expect(comparison.metrics[0]?.annualisedVolatility).not.toBeNull();
    expect(comparison.metrics[1]?.annualisedVolatility).not.toBeNull();
  });

  it("states a shorter common period and an insufficient correlation for short sample histories", async () => {
    const result = await loadInstrumentComparison(createDeterministicMarketDataService(), "US-XNAS:AAPL", "US-XNAS:MSFT", "1Y", now);
    expect(result.comparison).toMatchObject({ shorterThanRange: true, commonPeriod: { startDate: "2026-01-05", endDate: "2026-01-16", observationCount: 10 } });
    expect(result.comparison?.correlation).toMatchObject({ status: "insufficient-data", coefficient: null });
    expect(result.comparison?.metrics[0]?.annualisedReturn).toBeNull();
    expect(result.correlationMessage).toMatch(/alespoň 20 společných denních výnosů/);
  });

  it("keeps a partial history flagged on its own side", async () => {
    const result = await loadInstrumentComparison(createDeterministicMarketDataService(), "US-XNAS:AAPL", "CZ-XPRA:CZGB35", "1Y", now);
    expect(result.instruments.map((side) => side.historyPartial)).toEqual([false, true]);
  });

  it("marks one unavailable history as unavailable instead of comparing against zeros", async () => {
    const service = createDeterministicMarketDataService();
    const original = service.getHistoricalPrices.bind(service);
    vi.spyOn(service, "getHistoricalPrices").mockImplementation(async (request) => {
      if (request.instrumentId === "US-XNAS:MSFT") throw new MarketDataError("HistoricalDataUnavailable", "upstream failure");
      return original(request);
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await loadInstrumentComparison(service, "US-XNAS:AAPL", "US-XNAS:MSFT", "1Y", now);
    expect(result.comparison).toBeNull();
    expect(result.instruments[0]).toMatchObject({ historyAvailable: true, historyMessage: null });
    expect(result.instruments[1]).toMatchObject({ historyAvailable: false, provenance: null });
    expect(result.instruments[1].instrument?.symbol).toBe("MSFT");
    expect(result.instruments[1].historyMessage).toMatch(/není dostupná/);
    expect(result.correlationMessage).toMatch(/není dostupná/);
    consoleError.mockRestore();
  });

  it("treats an empty range as unavailable history", async () => {
    const result = await loadInstrumentComparison(createDeterministicMarketDataService(), "US-XNAS:AAPL", "US-XNAS:MSFT", "1M", new Date("2030-01-01T00:00:00.000Z"));
    expect(result.comparison).toBeNull();
    expect(result.instruments.every((side) => !side.historyAvailable && side.historyMessage !== null)).toBe(true);
  });

  it("explains a rate limit without leaking provider details", async () => {
    const service = createDeterministicMarketDataService();
    vi.spyOn(service, "getHistoricalPrices").mockRejectedValue(new MarketDataError("RateLimited", "provider said 429"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await loadInstrumentComparison(service, "US-XNAS:AAPL", "US-XNAS:MSFT", "1Y", now);
    expect(result.instruments[0].historyMessage).toMatch(/dočasně omezená/);
    expect(JSON.stringify(result)).not.toMatch(/429/);
    consoleError.mockRestore();
  });

  it("rejects a history whose currency differs from the instrument quote currency", async () => {
    const service = createDeterministicMarketDataService();
    const original = service.getHistoricalPrices.bind(service);
    vi.spyOn(service, "getHistoricalPrices").mockImplementation(async (request) => ({ ...(await original(request)), currency: "EUR" as const }));
    const result = await loadInstrumentComparison(service, "US-XNAS:AAPL", "US-XNAS:MSFT", "1Y", now);
    expect(result.comparison).toBeNull();
    expect(result.instruments.map((side) => side.historyAvailable)).toEqual([false, false]);
  });

  it("reports an identity the source does not know as missing, so the route can 404", async () => {
    const result = await loadInstrumentComparison(createDeterministicMarketDataService(), "US-XNAS:AAPL", "FMP:NASDAQ:AAPL", "1Y", now);
    expect(result.instrumentMissing).toBe(true);
    expect(result.instruments[1].instrument).toBeNull();
  });

  it("keeps a temporarily unreachable instrument as an explicit unavailable side, not a 404", async () => {
    const service = createDeterministicMarketDataService();
    const original = service.getInstrumentMetadata.bind(service);
    vi.spyOn(service, "getInstrumentMetadata").mockImplementation(async (id) => {
      if (id === "US-XNAS:MSFT") throw new MarketDataError("ProviderUnavailable", "timeout");
      return original(id);
    });
    const result = await loadInstrumentComparison(service, "US-XNAS:AAPL", "US-XNAS:MSFT", "1Y", now);
    expect(result.instrumentMissing).toBe(false);
    expect(result.instruments[1]).toMatchObject({ instrument: null, historyAvailable: false });
    expect(result.instruments[1].message).toMatch(/není z dostupného zdroje/);
    expect(result.comparison).toBeNull();
  });
});
