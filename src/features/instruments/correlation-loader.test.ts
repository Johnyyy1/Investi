import { describe, expect, it, vi } from "vitest";
import { MarketDataError } from "@/features/market-data/errors";
import { createDeterministicMarketDataService } from "@/features/market-data/deterministic/service";
import { loadInstrumentCorrelation } from "./correlation-loader";

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

describe("instrument correlation loading", () => {
  it("correlates two deterministic histories loaded through the market data service", async () => {
    const result = await loadInstrumentCorrelation(serviceWithInverseMsft(), "US-XNAS:AAPL", "US-XNAS:MSFT", "1Y", now);
    expect(result.message).toBeNull();
    expect(result.correlation).toMatchObject({ status: "ok", frequency: "daily", endDate: "2026-01-16" });
    expect(result.correlation?.coefficient).toBeLessThan(-0.99);
    expect(result.correlation?.observationCount).toBeGreaterThanOrEqual(200);
    expect(result.provenance?.map((provenance) => provenance.dataKind)).toEqual(["synthetic", "synthetic"]);
    expect(result.historyPartial).toBe(false);
  });

  it("is +1 for an instrument against itself and supports weekly returns", async () => {
    const service = createDeterministicMarketDataService();
    const daily = await loadInstrumentCorrelation(service, "US-XNAS:AAPL", "US-XNAS:AAPL", "1Y", now);
    const weekly = await loadInstrumentCorrelation(service, "US-XNAS:AAPL", "US-XNAS:AAPL", "1Y", now, "weekly");
    expect(daily.correlation?.coefficient).toBeCloseTo(1, 12);
    expect(weekly.correlation).toMatchObject({ status: "ok", frequency: "weekly" });
    expect(weekly.correlation?.observationCount).toBeLessThan(daily.correlation?.observationCount ?? 0);
  });

  it("reports insufficient data for short histories instead of a zero coefficient", async () => {
    const result = await loadInstrumentCorrelation(createDeterministicMarketDataService(), "US-XNAS:AAPL", "IE-XETR:VWCE", "1Y", now);
    expect(result.correlation).toMatchObject({ status: "insufficient-data", coefficient: null });
    expect(result.correlation?.observationCount).toBeLessThan(20);
    expect(result.message).toMatch(/alespoň 20 společných denních výnosů/);
  });

  it("keeps a partial history flagged", async () => {
    const result = await loadInstrumentCorrelation(createDeterministicMarketDataService(), "US-XNAS:AAPL", "CZ-XPRA:CZGB35", "1Y", now);
    expect(result.historyPartial).toBe(true);
  });

  it("returns no correlation when either history is unavailable", async () => {
    const service = createDeterministicMarketDataService();
    const original = service.getHistoricalPrices.bind(service);
    vi.spyOn(service, "getHistoricalPrices").mockImplementation(async (request) => {
      if (request.instrumentId === "US-XNAS:MSFT") throw new MarketDataError("HistoricalDataUnavailable", "upstream failure");
      return original(request);
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await loadInstrumentCorrelation(service, "US-XNAS:AAPL", "US-XNAS:MSFT", "1Y", now);
    expect(result).toMatchObject({ correlation: null, provenance: null, startDate: "2025-01-16", endDate: "2026-01-16" });
    expect(result.message).toMatch(/není dostupná/);
    consoleError.mockRestore();
  });

  it("explains a rate limit without leaking provider details", async () => {
    const service = createDeterministicMarketDataService();
    vi.spyOn(service, "getHistoricalPrices").mockRejectedValue(new MarketDataError("RateLimited", "provider said 429"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await loadInstrumentCorrelation(service, "US-XNAS:AAPL", "US-XNAS:MSFT", "1Y", now);
    expect(result.message).toMatch(/dočasně omezená/);
    expect(result.message).not.toMatch(/429/);
    consoleError.mockRestore();
  });

  it("rejects a history whose currency differs from the instrument quote currency", async () => {
    const service = createDeterministicMarketDataService();
    const original = service.getHistoricalPrices.bind(service);
    vi.spyOn(service, "getHistoricalPrices").mockImplementation(async (request) => ({ ...(await original(request)), currency: "EUR" as const }));
    const result = await loadInstrumentCorrelation(service, "US-XNAS:AAPL", "US-XNAS:AAPL", "1Y", now);
    expect(result.correlation).toBeNull();
    expect(result.message).toMatch(/není dostupná/);
  });

  it("returns no correlation for an unknown instrument", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await loadInstrumentCorrelation(createDeterministicMarketDataService(), "US-XNAS:AAPL", "FMP:NASDAQ:AAPL", "1Y", now);
    expect(result.correlation).toBeNull();
    consoleError.mockRestore();
  });
});
