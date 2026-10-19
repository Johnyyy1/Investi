import { describe, expect, it } from "vitest";
import { periodReturnLabel, periodStatistics } from "./period-statistics";

const point = (date: string, close: number) => ({ date, close });

describe("selected-period split-adjusted price statistics", () => {
  it("uses first and last available observations and includes the period high and low", () => {
    const result = periodStatistics([point("2026-01-05", 100), point("2026-01-08", 95.2), point("2026-01-12", 120), point("2026-01-16", 114)]);
    expect(result).toMatchObject({ start: point("2026-01-05", 100), end: point("2026-01-16", 114), change: 14, low: 95.2, high: 120, observationCount: 4 });
    expect(result?.returnPercent).toBeCloseTo(14);
  });
  it("reports negative and flat price returns", () => {
    expect(periodStatistics([point("2026-01-05", 100), point("2026-01-16", 80)])?.returnPercent).toBeCloseTo(-20);
    expect(periodStatistics([point("2026-01-05", 100), point("2026-01-16", 100)])).toMatchObject({ change: 0, returnPercent: 0, low: 100, high: 100 });
  });
  it("does not invent a return from one observation or an unavailable series", () => {
    expect(periodStatistics([point("2026-01-16", 114)])).toMatchObject({ start: point("2026-01-16", 114), end: point("2026-01-16", 114), change: null, returnPercent: null, low: 114, high: 114 });
    expect(periodStatistics([])).toBeNull();
    expect(periodStatistics(null)).toBeNull();
    expect(periodStatistics(undefined)).toBeNull();
  });
  it("rejects malformed, non-positive, and out-of-order observations", () => {
    expect(periodStatistics([point("2026-01-05", 0), point("2026-01-16", 114)])).toBeNull();
    expect(periodStatistics([point("2026-01-05", Number.NaN)])).toBeNull();
    expect(periodStatistics([point("bad", 100)])).toBeNull();
    expect(periodStatistics([point("2026-02-30", 100)])).toBeNull();
    expect(periodStatistics([point("2026-01-16", 114), point("2026-01-05", 100)])).toBeNull();
  });
  it("exposes only price statistics with no total-return field", () => {
    expect(Object.keys(periodStatistics([point("2026-01-05", 100), point("2026-01-16", 114)]) ?? {})).toEqual(["start", "end", "change", "returnPercent", "low", "lowDate", "high", "highDate", "observationCount"]);
    expect(periodReturnLabel("1M")).toBe("Cenový výnos za 1 měsíc");
    expect(periodReturnLabel("3M")).toBe("Cenový výnos za 3 měsíce");
    expect(periodReturnLabel("6M")).toBe("Cenový výnos za 6 měsíců");
    expect(periodReturnLabel("YTD")).toBe("Cenový výnos od začátku roku");
    expect(periodReturnLabel("1Y")).toBe("Cenový výnos za 1 rok");
    expect(periodReturnLabel("5Y")).toBe("Cenový výnos za 5 let");
    expect(periodReturnLabel("Max")).toBe("Cenový výnos za celé období");
    expect(periodReturnLabel("1M")).not.toMatch(/total return/i);
  });
  it("dates the period low and high at their first occurrence", () => {
    const result = periodStatistics([point("2026-01-05", 100), point("2026-01-06", 90), point("2026-01-07", 130), point("2026-01-08", 90), point("2026-01-09", 130)]);
    expect(result).toMatchObject({ low: 90, lowDate: "2026-01-06", high: 130, highDate: "2026-01-07" });
    expect(periodStatistics([point("2026-01-05", 0.1)])).toMatchObject({ low: 0.1, lowDate: "2026-01-05", high: 0.1, highDate: "2026-01-05", change: null, returnPercent: null });
  });
  it("keeps decimal prices exact in the change and return", () => {
    const result = periodStatistics([point("2026-01-05", 0.25), point("2026-01-06", 1.3333)]);
    expect(result?.change).toBeCloseTo(1.0833, 12);
    expect(result?.returnPercent).toBeCloseTo(433.32, 10);
  });
});
