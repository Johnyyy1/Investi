import { describe, expect, it } from "vitest";
import { adjustmentPolicies, type HistoricalSeries } from "@/features/market-data/contracts";
import { chartPoints, chartRanges, filterHistoryByTimeframe, historicalDateRange, historicalRequest, parseChartRange, timeframeWindow } from "./history";

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

/** Weekday closes from `from` to `to` inclusive, like a market that trades Monday–Friday. */
function weekdays(from: string, to: string) {
  const points: { date: string; close: number }[] = [];
  for (let day = new Date(`${from}T00:00:00.000Z`); day.toISOString().slice(0, 10) <= to; day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() % 6 !== 0) points.push({ date: day.toISOString().slice(0, 10), close: 100 + points.length });
  }
  return points;
}
const utc = (date: string) => new Date(`${date}T12:00:00.000Z`);

describe("timeframes over a loaded history", () => {
  // Friday 16 October 2026 is the latest close; the page is viewed on Monday morning.
  const history = weekdays("2019-03-01", "2026-10-16");
  const monday = utc("2026-10-19");

  it.each([
    ["1M", "2026-09-16"],
    ["3M", "2026-07-16"],
    ["6M", "2026-04-16"],
    ["YTD", "2026-01-01"],
    ["1Y", "2025-10-16"],
    ["5Y", "2021-10-16"],
    ["Max", "1900-01-01"],
  ] as const)("%s counts back calendar months from the latest close", (range, startDate) => {
    expect(timeframeWindow(history, range, monday)).toEqual({ startDate, endDate: "2026-10-16" });
    const points = filterHistoryByTimeframe(history, range, monday);
    expect(points[0].date >= startDate).toBe(true);
    expect(points.at(-1)?.date).toBe("2026-10-16");
    // Nothing before the window is kept and nothing inside it is dropped.
    const firstIndex = history.indexOf(points[0]);
    expect(firstIndex === 0 || history[firstIndex - 1].date < startDate).toBe(true);
    expect(points).toEqual(history.slice(firstIndex));
  });

  it("gives the same window over a weekend as on the Friday itself", () => {
    for (const range of chartRanges) {
      expect(timeframeWindow(history, range, monday)).toEqual(timeframeWindow(history, range, utc("2026-10-16")));
      expect(filterHistoryByTimeframe(history, range, utc("2026-10-18"))).toEqual(filterHistoryByTimeframe(history, range, utc("2026-10-16")));
    }
  });

  it("returns the loaded observations themselves, never copies or filled days", () => {
    const month = filterHistoryByTimeframe(history, "1M", monday);
    expect(month.every((point) => history.includes(point))).toBe(true);
    expect(month.some(({ date }) => [0, 6].includes(new Date(`${date}T00:00:00.000Z`).getUTCDay()))).toBe(false);
    expect(month).toHaveLength(23);
  });

  it("clamps month ends and leap days instead of rolling into the next month", () => {
    const leap = weekdays("2019-01-01", "2024-02-29");
    expect(timeframeWindow(leap, "1Y", utc("2024-02-29")).startDate).toBe("2023-02-28");
    expect(timeframeWindow(leap, "5Y", utc("2024-02-29")).startDate).toBe("2019-02-28");
    expect(timeframeWindow(leap, "1M", utc("2024-02-29")).startDate).toBe("2024-01-29");
    const may = weekdays("2024-01-01", "2024-05-31");
    expect(timeframeWindow(may, "1M", utc("2024-05-31")).startDate).toBe("2024-04-30");
    expect(timeframeWindow(may, "3M", utc("2024-05-31")).startDate).toBe("2024-02-29");
    expect(timeframeWindow(may, "6M", utc("2024-05-31")).startDate).toBe("2023-11-30");
  });

  it("crosses a year boundary for month ranges and starts YTD on 1 January", () => {
    const turn = weekdays("2025-06-02", "2026-01-09");
    expect(timeframeWindow(turn, "1M", utc("2026-01-09"))).toEqual({ startDate: "2025-12-09", endDate: "2026-01-09" });
    expect(filterHistoryByTimeframe(turn, "YTD", utc("2026-01-09")).map(({ date }) => date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]);
  });

  it("has no YTD observations on New Year's Day when the latest close is from last year", () => {
    const december = weekdays("2025-10-01", "2025-12-31");
    expect(timeframeWindow(december, "YTD", utc("2026-01-01"))).toEqual({ startDate: "2026-01-01", endDate: "2025-12-31" });
    expect(filterHistoryByTimeframe(december, "YTD", utc("2026-01-01"))).toEqual([]);
    expect(filterHistoryByTimeframe(december, "1M", utc("2026-01-01"))[0].date).toBe("2025-12-01");
  });

  it("keeps whatever exists when a range reaches past a young instrument's first close", () => {
    const young = weekdays("2026-08-03", "2026-10-16");
    expect(filterHistoryByTimeframe(young, "1Y", monday)).toEqual(young);
    expect(filterHistoryByTimeframe(young, "5Y", monday)).toEqual(young);
    expect(filterHistoryByTimeframe(young, "Max", monday)).toEqual(young);
    expect(filterHistoryByTimeframe(young, "1M", monday)[0].date).toBe("2026-09-16");
  });

  it("does not stretch a history that stopped months ago into the latest month", () => {
    const stale = weekdays("2025-01-01", "2026-01-16");
    expect(timeframeWindow(stale, "1M", utc("2026-03-20"))).toEqual({ startDate: "2026-02-20", endDate: "2026-03-20" });
    expect(filterHistoryByTimeframe(stale, "1M", utc("2026-03-20"))).toEqual([]);
    expect(filterHistoryByTimeframe(stale, "1Y", utc("2026-03-20"))[0].date).toBe("2025-03-20");
  });

  it("ignores observations after the reference date", () => {
    expect(filterHistoryByTimeframe(history, "1M", utc("2026-10-07")).at(-1)?.date).toBe("2026-10-07");
  });

  it("handles empty, single and sparse histories without inventing points", () => {
    for (const range of chartRanges) expect(filterHistoryByTimeframe([], range, monday)).toEqual([]);
    const single = [{ date: "2026-10-15", close: 10 }];
    expect(filterHistoryByTimeframe(single, "1M", monday)).toEqual(single);
    const sparse = [{ date: "2020-01-02", close: 1 }, { date: "2026-03-02", close: 2 }, { date: "2026-10-16", close: 3 }];
    expect(filterHistoryByTimeframe(sparse, "1M", monday)).toEqual(sparse.slice(2));
    expect(filterHistoryByTimeframe(sparse, "1Y", monday)).toEqual(sparse.slice(1));
    expect(filterHistoryByTimeframe(sparse, "Max", monday)).toEqual(sparse);
  });
});
