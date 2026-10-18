import { describe, expect, it } from "vitest";
import type { HistoricalPricePoint } from "@/features/market-data/contracts";
import { alignMonthlyCloses, monthEndCloses } from "./monthly";
import { BacktestDataError } from "./spec";

const bar = (date: string, close: number): HistoricalPricePoint => ({ date, open: close, high: close, low: close, close });
// Test-only closes; not market data.
const daily = [bar("2020-01-30", 9), bar("2020-01-31", 10), bar("2020-02-27", 11), bar("2020-02-28", 12), bar("2020-03-31", 13)];

describe("month-end closes", () => {
  it("takes the last close inside each month", () => {
    expect(monthEndCloses(daily, ["2020-01", "2020-02", "2020-03"])).toEqual({
      closes: [{ month: "2020-01", date: "2020-01-31", close: 10 }, { month: "2020-02", date: "2020-02-28", close: 12 }, { month: "2020-03", date: "2020-03-31", close: 13 }],
      missing: [],
    });
  });
  it("reports a month without any close instead of carrying the previous one forward", () => {
    expect(monthEndCloses(daily.filter((point) => !point.date.startsWith("2020-02")), ["2020-01", "2020-02", "2020-03"]).missing).toEqual(["2020-02"]);
  });
  it("reports a month whose data stops more than a week before its end", () => {
    const stopsMidMonth = [bar("2020-01-31", 10), bar("2020-02-14", 11), bar("2020-03-31", 13)];
    expect(monthEndCloses(stopsMidMonth, ["2020-01", "2020-02", "2020-03"]).missing).toEqual(["2020-02"]);
    // A month ending on a weekend after a holiday is still a month end.
    expect(monthEndCloses([bar("2020-05-29", 1)], ["2020-05"]).missing).toEqual([]);
  });
});

describe("aligning instruments", () => {
  it("pairs closes by calendar month even when the closing days differ", () => {
    const other = [bar("2020-01-30", 50), bar("2020-02-27", 55), bar("2020-03-30", 60)];
    expect(alignMonthlyCloses([{ label: "A", points: daily }, { label: "B", points: other }], ["2020-01", "2020-02", "2020-03"])).toEqual({
      months: ["2020-01", "2020-02", "2020-03"],
      closes: [[10, 12, 13], [50, 55, 60]],
    });
  });
  it("refuses the whole run when one instrument misses a month, naming it", () => {
    const gap = [bar("2020-01-31", 50), bar("2020-03-31", 60)];
    const run = () => alignMonthlyCloses([{ label: "A", points: daily }, { label: "B", points: gap }], ["2020-01", "2020-02", "2020-03"]);
    expect(run).toThrow(BacktestDataError);
    expect(run).toThrow(/Historie B je neúplná: chybí měsíční uzávěrka za 2020-02/);
  });
  it("refuses a period that reaches beyond the history", () => {
    expect(() => alignMonthlyCloses([{ label: "A", points: daily }], ["2019-12", "2020-01"])).toThrow(/2019-12/);
  });
});
