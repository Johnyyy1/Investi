import { describe, expect, it } from "vitest";
import { priceMetrics } from "./price-metrics";

function daily(start: string, closes: number[]) {
  const first = Date.parse(`${start}T00:00:00.000Z`);
  return closes.map((close, index) => ({ date: new Date(first + index * 86_400_000).toISOString().slice(0, 10), close }));
}

describe("price metrics", () => {
  it("returns null for an empty series", () => {
    expect(priceMetrics([])).toBeNull();
  });

  it("keeps a single observation without any return-based metric", () => {
    expect(priceMetrics([{ date: "2026-01-05", close: 100 }])).toEqual({
      startDate: "2026-01-05", endDate: "2026-01-05", observationCount: 1, spanDays: 0, periodReturn: null, annualisedReturn: null, maxDrawdown: null, annualisedVolatility: null,
    });
  });

  it("computes the simple price return and finds the largest drawdown with recovery", () => {
    const metrics = priceMetrics(daily("2026-01-01", [100, 120, 90, 110, 130]));
    expect(metrics?.periodReturn).toBeCloseTo(0.3, 12);
    expect(metrics?.maxDrawdown).toEqual({
      depth: 90 / 120 - 1,
      peakDate: "2026-01-02",
      peakClose: 120,
      troughDate: "2026-01-03",
      troughClose: 90,
      recoveryDate: "2026-01-05",
    });
  });

  it("reports no recovery while the trough is still below the peak", () => {
    const metrics = priceMetrics(daily("2026-01-01", [100, 80, 90]));
    expect(metrics?.maxDrawdown).toMatchObject({ peakDate: "2026-01-01", troughDate: "2026-01-02", recoveryDate: null });
    expect(metrics?.maxDrawdown?.depth).toBeCloseTo(-0.2, 12);
  });

  it("reports no drawdown for a series that only rises", () => {
    expect(priceMetrics(daily("2026-01-01", [100, 101, 103])))
      .toMatchObject({ maxDrawdown: null });
  });

  it("annualises only spans of at least one year", () => {
    const shortSpan = priceMetrics(daily("2026-01-01", [100, 110]));
    expect(shortSpan?.annualisedReturn).toBeNull();
    const oneYear = priceMetrics([{ date: "2025-01-01", close: 100 }, { date: "2026-01-01", close: 121 }]);
    expect(oneYear?.spanDays).toBe(365);
    expect(oneYear?.annualisedReturn).toBeCloseTo(Math.pow(1.21, 365.25 / 365) - 1, 12);
  });

  it("does not compute volatility from too few returns", () => {
    expect(priceMetrics(daily("2026-01-01", [100, 101, 102, 101])))
      .toMatchObject({ annualisedVolatility: null });
  });

  it("annualises volatility from returns and skips gaps longer than four days", () => {
    const alternating = Array.from({ length: 30 }, (_, index) => (index % 2 === 0 ? 100 : 101));
    const series = daily("2026-01-01", alternating);
    const bridged = [...series.slice(0, 15), ...daily("2026-03-01", alternating.slice(15))];
    const contiguous = priceMetrics(series)?.annualisedVolatility;
    const withGap = priceMetrics(bridged)?.annualisedVolatility;
    expect(contiguous).toBeGreaterThan(0);
    expect(withGap).toBeGreaterThan(0);
    expect(withGap).not.toBeNull();
  });
  it("takes the drawdown from a running peak, not from the global high and low", () => {
    // The global low (80) comes before the global high (150); the deepest fall is 150 → 110, not 150 → 80.
    const metrics = priceMetrics(daily("2026-01-01", [100, 80, 150, 110, 140]));
    expect(metrics?.maxDrawdown).toEqual({ depth: 110 / 150 - 1, peakDate: "2026-01-03", peakClose: 150, troughDate: "2026-01-04", troughClose: 110, recoveryDate: null });
  });

  it("keeps the deepest of several drawdowns and dates its recovery at the first close back at the peak", () => {
    const metrics = priceMetrics(daily("2026-01-01", [100, 90, 100, 130, 91, 125, 130, 135]));
    expect(metrics?.maxDrawdown).toMatchObject({ peakDate: "2026-01-04", peakClose: 130, troughDate: "2026-01-05", troughClose: 91, recoveryDate: "2026-01-07" });
    expect(metrics?.maxDrawdown?.depth).toBeCloseTo(-0.3, 12);
  });

  it("recomputes the drawdown for a shorter slice of the same history", () => {
    const history = daily("2026-01-01", [100, 60, 100, 110, 99, 112]);
    expect(priceMetrics(history)?.maxDrawdown).toMatchObject({ peakDate: "2026-01-01", troughDate: "2026-01-02" });
    expect(priceMetrics(history.slice(3))?.maxDrawdown).toMatchObject({ peakDate: "2026-01-04", troughDate: "2026-01-05", recoveryDate: "2026-01-06" });
    expect(priceMetrics(history.slice(3))?.maxDrawdown?.depth).toBeCloseTo(-0.1, 12);
  });
});
