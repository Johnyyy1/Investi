import { describe, expect, it, vi } from "vitest";
import { adjustmentPolicies, type HistoricalSeries } from "@/features/market-data/contracts";
import { fxUnitsFromNumber, grossBaseMinor, parseQuantity, priceUnitsFromNumber } from "./decimal";
import { loadPortfolioPerformance } from "./performance-loader";

const openedAt = "2026-01-01T12:00:00.000Z";
const flowAt = "2026-01-16T12:00:00.000Z";
const endedAt = "2026-02-01T12:00:00.000Z";
const provenance = { provider: "test", dataset: "daily", dataKind: "historical" as const, isDeterministic: false, isDemo: false, observedAt: "2026-01-15T23:59:59.999Z", retrievedAt: endedAt, adjustmentMode: "raw" as const, completeness: "complete" as const };
const series: HistoricalSeries = { instrumentId: "X", currency: "USD", interval: "daily", timeZone: "UTC", adjustment: adjustmentPolicies.raw, points: [{ date: "2026-01-15", open: 10, high: 10, low: 10, close: 10 }], provenance };
function gateway() {
  return {
    getHistoricalPrices: vi.fn().mockResolvedValue(series),
    getFxRate: vi.fn().mockResolvedValue({ baseCurrency: "USD", quoteCurrency: "CZK", rate: 22.123456789012, referenceDate: "2026-01-15", retrievedAt: endedAt, provenance: { ...provenance, adjustmentMode: null, referenceDate: "2026-01-15" } }),
  };
}
const input = {
  openedAt, endedAt, openingCapitalMinor: 500_000n, earnedPracticeCapitalMinor: 700_000n,
  receipts: [{ at: openedAt, amountMinor: 500_000n }, { at: flowAt, amountMinor: 200_000n }],
  trades: [], endingMinor: 700_000n, baseCurrency: "CZK" as const,
};
function buy(quantity = "1.3333") {
  const gross = grossBaseMinor(parseQuantity(quantity), priceUnitsFromNumber(10), fxUnitsFromNumber(22.123456789012));
  return { instrumentId: "X", instrumentSymbol: "X", instrumentName: "X", instrumentAssetType: "equity", quoteCurrency: "USD", side: "BUY" as const, quantity, grossAmountBaseMinor: gross, feeBaseMinor: 10n, cashDeltaBaseMinor: -gross - 10n, executedAt: new Date("2026-01-02T12:00:00Z") };
}

describe("performance reconstruction", () => {
  it("all-cash returns need no market data and zero receipts do not create boundaries", async () => {
    const service = gateway();
    const result = await loadPortfolioPerformance(service, { ...input, receipts: [...input.receipts, { at: "2026-01-17T12:00:00Z", amountMinor: 0n }] });
    expect(result.twr).toMatchObject({ status: "available", basisPoints: "0" });
    expect(result.mwr).toMatchObject({ status: "available", basisPoints: "0" });
    expect(service.getHistoricalPrices).not.toHaveBeenCalled();
    expect(service.getFxRate).not.toHaveBeenCalled();
  });

  it.each(["0.1", "0.25", "1.3333"])("values %s using exact quantities, historical FX, cash and recorded costs", async (quantity) => {
    const service = gateway();
    const trade = buy(quantity);
    const result = await loadPortfolioPerformance(service, { ...input, trades: [trade], endingMinor: 699_990n });
    expect(result.twr).toMatchObject({ status: "available", basisPoints: "0" }); // 10 haléř cost rounds below one bp
    expect(result.twrMethod).toBe("prior-daily-close-estimate");
    expect(service.getHistoricalPrices).toHaveBeenCalledWith(expect.objectContaining({ instrumentId: "X", startDate: "2026-01-08", endDate: "2026-01-15", adjustment: adjustmentPolicies.raw }));
    expect(service.getFxRate).toHaveBeenCalledWith("USD", "CZK", "2026-01-15T23:59:59.999Z");
  });

  it("never uses future prices, adjusted history, partial series or later FX", async () => {
    for (const invalid of [
      { ...series, points: [{ ...series.points[0], date: "2026-01-16" }] },
      { ...series, adjustment: adjustmentPolicies["split-adjusted"] },
      { ...series, provenance: { ...provenance, completeness: "partial" } },
      { ...series, currency: "EUR" },
      { ...series, points: [] },
    ]) {
      const service = gateway();
      service.getHistoricalPrices.mockResolvedValue(invalid);
      const result = await loadPortfolioPerformance(service, { ...input, trades: [buy()] });
      expect(result.twr).toEqual({ status: "unavailable", reason: "missing-valuation" });
      expect(result.mwr.status).toBe("available");
    }
    const service = gateway();
    service.getFxRate.mockResolvedValue({ ...(await gateway().getFxRate()), referenceDate: "2026-01-16" });
    expect((await loadPortfolioPerformance(service, { ...input, trades: [buy()] })).twr.status).toBe("unavailable");
  });

  it("loads history once per instrument across several flows and never uses a later boundary's price early", async () => {
    const service = gateway();
    service.getHistoricalPrices.mockResolvedValue({ ...series, points: [...series.points, { ...series.points[0], date: "2026-01-20", close: 11 }] });
    const result = await loadPortfolioPerformance(service, { ...input, trades: [buy()], receipts: [...input.receipts, { at: "2026-01-21T12:00:00.000Z", amountMinor: 200_000n }], earnedPracticeCapitalMinor: 900_000n, endingMinor: 899_990n });
    expect(result.twr.status).toBe("available");
    expect(service.getHistoricalPrices).toHaveBeenCalledTimes(1);
    expect(service.getHistoricalPrices).toHaveBeenCalledWith(expect.objectContaining({ startDate: "2026-01-08", endDate: "2026-01-20" }));
    expect(service.getFxRate.mock.calls.map((call) => call[2])).toEqual(["2026-01-15T23:59:59.999Z", "2026-01-20T23:59:59.999Z"]);
  });

  it("provider errors affect TWR independently and missing final value affects both", async () => {
    const service = gateway();
    service.getFxRate.mockRejectedValue(new Error("FX unavailable"));
    const result = await loadPortfolioPerformance(service, { ...input, trades: [buy()] });
    expect(result.twr.status).toBe("unavailable");
    expect(result.mwr.status).toBe("available");
    const missing = await loadPortfolioPerformance(service, { ...input, endingMinor: null });
    expect(missing.twr.status).toBe("unavailable");
    expect(missing.mwr.status).toBe("unavailable");
  });

  it("counts sell proceeds and fees internally, including instruments already sold before a contribution", async () => {
    const service = gateway();
    const trade = buy("0.25");
    const sell = { ...trade, side: "SELL" as const, cashDeltaBaseMinor: trade.grossAmountBaseMinor - 10n, executedAt: new Date("2026-01-03T12:00:00Z") };
    const result = await loadPortfolioPerformance(service, { ...input, trades: [trade, sell], endingMinor: 699_980n });
    expect(result.twr.status).toBe("available");
    expect(result.twrMethod).toBe("cash-flow-boundaries");
    expect(service.getHistoricalPrices).not.toHaveBeenCalled();
  });

  it("rejects ambiguous trade/flow ordering and inconsistent opening entitlement", async () => {
    const service = gateway();
    expect((await loadPortfolioPerformance(service, { ...input, trades: [{ ...buy(), executedAt: new Date(flowAt) }] })).twr.status).toBe("unavailable");
    const bad = await loadPortfolioPerformance(service, { ...input, openingCapitalMinor: 400_000n, receipts: [{ ...input.receipts[0], at: "2025-12-01T00:00:00.000Z" }, input.receipts[1]] });
    expect(bad.twr).toEqual({ status: "unavailable", reason: "invalid-ledger" });
    expect(bad.mwr.status).toBe("unavailable");
  });

  it("reset ignores old receipts and starts from restored capital with no old trades", async () => {
    const service = gateway();
    const reset = await loadPortfolioPerformance(service, { ...input, openedAt: "2026-01-17T00:00:00.000Z", openingCapitalMinor: 700_000n });
    expect(reset.twr).toMatchObject({ basisPoints: "0" });
    expect(reset.startedAt).toBe("2026-01-17T00:00:00.000Z");
    expect(service.getHistoricalPrices).not.toHaveBeenCalled();
  });
});
