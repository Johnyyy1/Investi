import { describe, expect, it } from "vitest";
import { adjustmentPolicies, type HistoricalSeries } from "@/features/market-data/contracts";
import { chartPoints, historicalDateRange, historicalRequest, parseChartRange } from "./history";

const now = new Date("2026-09-21T15:00:00.000Z");
describe("instrument price history", () => {
  it("uses calendar periods including YTD", () => {
    expect(historicalDateRange("1M", now)).toEqual({ startDate: "2026-08-21", endDate: "2026-09-21" });
    expect(historicalDateRange("1Y", now)).toEqual({ startDate: "2025-09-21", endDate: "2026-09-21" });
    expect(historicalDateRange("YTD", now)).toEqual({ startDate: "2026-01-01", endDate: "2026-09-21" });
    expect(historicalDateRange("3M", now).startDate).toBe("2026-06-21");
    expect(historicalDateRange("6M", now).startDate).toBe("2026-03-21");
    expect(historicalDateRange("5Y", now).startDate).toBe("2021-09-21");
    expect(historicalDateRange("Max", now).startDate).toBe("1900-01-01");
    expect(historicalDateRange("1M", new Date("2026-03-31T00:00:00.000Z")).startDate).toBe("2026-02-28");
  });
  it("defaults unsupported range values to 1Y", () => {
    expect(parseChartRange(undefined)).toBe("5Y");
    expect(parseChartRange("intraday")).toBe("5Y");
    expect(parseChartRange(["1M"])).toBe("5Y");
  });
  it("requests daily split-adjusted prices, not total return", () => {
    expect(historicalRequest("FMP:NASDAQ:AAPL", "1Y", now)).toMatchObject({ instrumentId: "FMP:NASDAQ:AAPL", interval: "daily", timeZone: "UTC", adjustment: adjustmentPolicies["split-adjusted"] });
  });
  it("preserves only chronological observations without forward filling", () => {
    const series = { instrumentId: "US-XNAS:AAPL", currency: "USD", interval: "daily", timeZone: "UTC", adjustment: adjustmentPolicies["split-adjusted"], points: [{ date: "2026-01-05", open: 100, high: 100, low: 100, close: 100 }, { date: "2026-01-08", open: 102, high: 102, low: 102, close: 102 }], provenance: { provider: "test", dataset: "test", dataKind: "synthetic", isDeterministic: true, isDemo: true, observedAt: "2026-01-08T00:00:00.000Z", retrievedAt: "2026-01-08T00:00:00.000Z", adjustmentMode: "split-adjusted", completeness: "complete" } } satisfies HistoricalSeries;
    expect(chartPoints(series, "2026-01-01", "2026-01-31").map(({ date }) => date)).toEqual(["2026-01-05", "2026-01-08"]);
    expect(chartPoints({ ...series, points: [...series.points].reverse() }, "2026-01-01", "2026-01-31")).toEqual([]);
    expect(chartPoints({ ...series, points: series.points.slice(0, 1) }, "2026-01-01", "2026-01-31")).toEqual(series.points.slice(0, 1));
    expect(chartPoints({ ...series, adjustment: adjustmentPolicies.raw }, "2026-01-01", "2026-01-31")).toEqual([]);
    expect(chartPoints({ ...series, points: [{ date: "2026-01-05", open: 100, high: 100, low: 100, close: Number.NaN }] }, "2026-01-01", "2026-01-31")).toEqual([]);
  });
});
