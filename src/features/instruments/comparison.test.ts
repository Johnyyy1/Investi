import { describe, expect, it } from "vitest";
import { COMMON_PERIOD_TOLERANCE_DAYS, comparePriceHistories, rebaseTo100 } from "./comparison";
import { MIN_CORRELATION_OBSERVATIONS } from "./correlation";

function weekdays(start: string, count: number, close: (index: number) => number) {
  const points: { date: string; close: number }[] = [];
  for (let time = Date.parse(`${start}T00:00:00.000Z`); points.length < count; time += 86_400_000) {
    const day = new Date(time).getUTCDay();
    if (day === 0 || day === 6) continue;
    points.push({ date: new Date(time).toISOString().slice(0, 10), close: close(points.length) });
  }
  return points;
}

const requested = { startDate: "2025-01-01", endDate: "2025-03-31", isMax: false };

describe("price comparison of two instruments", () => {
  it("rebases both series to 100 on the first common date, whatever their price level or currency", () => {
    const rebased = rebaseTo100([
      { date: "2025-01-02", first: 250, second: 0.1 },
      { date: "2025-01-03", first: 275, second: 0.25 },
      { date: "2025-01-06", first: 1.3333, second: 0.8 },
    ]);
    expect(rebased.map((point) => point.date)).toEqual(["2025-01-02", "2025-01-03", "2025-01-06"]);
    expect(rebased[0]).toMatchObject({ first: 100, second: 100 });
    expect(rebased[1].first).toBeCloseTo(110, 12);
    expect(rebased[1].second).toBeCloseTo(250, 12);
    expect(rebased[2].first).toBeCloseTo(0.53332, 12);
    expect(rebased[2].second).toBeCloseTo(800, 12);
    expect(rebaseTo100([])).toEqual([]);
  });

  it("uses only the dates both traded for the chart, the metrics and the correlation", () => {
    const first = weekdays("2025-01-01", 60, (index) => 100 + index + (index % 3));
    const second = weekdays("2025-01-01", 60, (index) => 50 + index / 2 + (index % 2)).filter((_, index) => index % 10 !== 4);
    const result = comparePriceHistories(first, second, requested);
    expect(result.points).toHaveLength(second.length);
    expect(result.points.map((point) => point.date)).toEqual(second.map((point) => point.date));
    expect(result.commonPeriod).toEqual({ startDate: "2025-01-01", endDate: second.at(-1)!.date, observationCount: second.length });
    expect(result.metrics[0]?.observationCount).toBe(second.length);
    expect(result.metrics[1]?.observationCount).toBe(second.length);
    // The first instrument's return is measured between the same two dates as the second's.
    expect(result.metrics[0]?.periodReturn).toBeCloseTo(first.find((point) => point.date === second.at(-1)!.date)!.close / first[0].close - 1, 12);
    expect(result.correlation.status).toBe("ok");
  });

  it("is never shorter than the range when the common dates cover it within the tolerance", () => {
    const series = weekdays("2025-01-01", 64, (index) => 100 + Math.sin(index) * 5);
    const result = comparePriceHistories(series, series, { ...requested, endDate: series.at(-1)!.date });
    expect(result.shorterThanRange).toBe(false);
    expect(result.correlation).toMatchObject({ status: "ok" });
    if (result.correlation.status === "ok") expect(result.correlation.coefficient).toBeCloseTo(1, 12);
  });

  it("flags a common period that starts well inside the requested range", () => {
    const first = weekdays("2025-01-01", 64, (index) => 100 + index);
    const second = weekdays("2025-02-03", 40, (index) => 100 + index * 2);
    const result = comparePriceHistories(first, second, { ...requested, endDate: first.at(-1)!.date });
    expect(result.commonPeriod?.startDate).toBe("2025-02-03");
    expect(result.shorterThanRange).toBe(true);
  });

  it("flags a common period that ends early, but tolerates a few missing days at either edge", () => {
    const series = weekdays("2025-01-06", 50, (index) => 100 + index);
    const endsEarly = comparePriceHistories(series, series.slice(0, 30), { ...requested, endDate: series.at(-1)!.date });
    expect(endsEarly.shorterThanRange).toBe(true);
    const lagging = comparePriceHistories(series, series.slice(0, -3), { startDate: "2025-01-01", endDate: series.at(-1)!.date, isMax: false });
    expect(COMMON_PERIOD_TOLERANCE_DAYS).toBeGreaterThanOrEqual(5);
    expect(lagging.shorterThanRange).toBe(false);
  });

  it("compares Max against the longer history instead of the placeholder start", () => {
    const longer = weekdays("2020-01-01", 300, (index) => 100 + index);
    const shorter = longer.slice(200);
    const max = { startDate: "1900-01-01", endDate: longer.at(-1)!.date, isMax: true };
    expect(comparePriceHistories(longer, shorter, max).shorterThanRange).toBe(true);
    expect(comparePriceHistories(longer, longer, max).shorterThanRange).toBe(false);
  });

  it("returns no points and no metrics without a common date, never zeros", () => {
    const result = comparePriceHistories(weekdays("2025-01-01", 10, () => 100), weekdays("2025-06-02", 10, () => 50), requested);
    expect(result).toMatchObject({ commonPeriod: null, shorterThanRange: true, points: [], metrics: [null, null] });
    expect(result.correlation).toMatchObject({ status: "insufficient-data", coefficient: null, observationCount: 0 });
  });

  it("keeps the correlation null when there are too few common returns", () => {
    const series = weekdays("2025-01-01", MIN_CORRELATION_OBSERVATIONS, (index) => 100 + index * (index % 2 ? 1 : -1));
    const result = comparePriceHistories(series, series, requested);
    expect(result.correlation).toMatchObject({ status: "insufficient-data", coefficient: null, observationCount: MIN_CORRELATION_OBSERVATIONS - 1 });
    expect(result.metrics[0]?.periodReturn).not.toBeNull();
  });
});
