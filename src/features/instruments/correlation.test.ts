import { describe, expect, it } from "vitest";
import { MIN_CORRELATION_OBSERVATIONS, returnCorrelation } from "./correlation";

const DAY_MS = 86_400_000;

function daily(start: string, closes: number[]) {
  const first = Date.parse(`${start}T00:00:00.000Z`);
  return closes.map((close, index) => ({ date: new Date(first + index * DAY_MS).toISOString().slice(0, 10), close }));
}

/** Prices whose simple returns are exactly the given ones (up to floating point). */
function pricesFromReturns(returns: number[], start = 100) {
  return returns.reduce((prices, value) => [...prices, prices[prices.length - 1] * (1 + value)], [start]);
}

/** Irregular but deterministic returns between −3 % and +3 %. */
const varied = Array.from({ length: 40 }, (_, index) => Math.sin(index * 1.7) * 0.03);

describe("return correlation", () => {
  it("is +1 for series whose returns move together, even at different price levels", () => {
    const first = daily("2026-01-01", pricesFromReturns(varied));
    const second = daily("2026-01-01", pricesFromReturns(varied.map((value) => value * 2), 37.5));
    const result = returnCorrelation(first, second);
    expect(result.status).toBe("ok");
    expect(result.coefficient).toBeCloseTo(1, 12);
    expect(result.coefficient).toBeLessThanOrEqual(1);
    expect(result).toMatchObject({ observationCount: 40, startDate: "2026-01-01", endDate: "2026-02-10", frequency: "daily" });
  });

  it("is −1 for series whose returns move exactly against each other", () => {
    const first = daily("2026-01-01", pricesFromReturns(varied));
    const second = daily("2026-01-01", pricesFromReturns(varied.map((value) => -value)));
    const result = returnCorrelation(first, second);
    expect(result.coefficient).toBeCloseTo(-1, 12);
    expect(result.coefficient).toBeGreaterThanOrEqual(-1);
  });

  it("correlates returns, not prices: two steadily rising series are not +1", () => {
    // Both prices rise every day, so a price correlation would be close to +1.
    const first = daily("2026-01-01", pricesFromReturns(varied.map((value) => 0.04 + value)));
    const second = daily("2026-01-01", pricesFromReturns(varied.map((value, index) => 0.04 + (index % 2 ? value : -value))));
    const result = returnCorrelation(first, second);
    expect(result.status).toBe("ok");
    expect(Math.abs(result.coefficient ?? 1)).toBeLessThan(0.5);
  });

  it("matches a hand-computed coefficient and stays unrounded", () => {
    const a = [0.01, -0.02, 0.03, 0.005, -0.01];
    const b = [0.02, -0.01, 0.01, -0.005, 0.0];
    const returnsA = Array.from({ length: 20 }, (_, index) => a[index % 5]);
    const returnsB = Array.from({ length: 20 }, (_, index) => b[index % 5]);
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const meanA = mean(returnsA);
    const meanB = mean(returnsB);
    const covariance = returnsA.reduce((sum, value, index) => sum + (value - meanA) * (returnsB[index] - meanB), 0);
    const expected = covariance / Math.sqrt(returnsA.reduce((sum, value) => sum + (value - meanA) ** 2, 0) * returnsB.reduce((sum, value) => sum + (value - meanB) ** 2, 0));
    const result = returnCorrelation(daily("2026-01-01", pricesFromReturns(returnsA)), daily("2026-01-01", pricesFromReturns(returnsB)));
    expect(result.coefficient).toBeCloseTo(expected, 10);
    expect(result.coefficient).not.toBe(Number(expected.toFixed(2)));
  });

  it("returns no coefficient for a constant series instead of 0", () => {
    const flat = daily("2026-01-01", Array.from({ length: 30 }, () => 100));
    const moving = daily("2026-01-01", pricesFromReturns(varied.slice(0, 29)));
    expect(returnCorrelation(flat, moving)).toMatchObject({ status: "no-variation", coefficient: null, observationCount: 29 });
    expect(returnCorrelation(moving, flat)).toMatchObject({ status: "no-variation", coefficient: null });
  });

  it("treats a constant return with floating-point noise as no variation", () => {
    const steady = daily("2026-01-01", pricesFromReturns(Array.from({ length: 30 }, () => 0.01)));
    const moving = daily("2026-01-01", pricesFromReturns(varied.slice(0, 30)));
    expect(returnCorrelation(steady, moving)).toMatchObject({ status: "no-variation", coefficient: null });
  });

  it("uses only dates both series traded and never forward-fills", () => {
    const first = daily("2026-01-01", pricesFromReturns(varied));
    // Same price path, but the second series misses every fifth day. Each paired return spans
    // the same two dates for both, so they still move identically. Forward-filling the missing
    // days would instead give the second series a zero return that the first one does not have.
    const second = first.filter((_, index) => index % 5 !== 2);
    const result = returnCorrelation(first, second);
    expect(result.status).toBe("ok");
    expect(result.coefficient).toBeCloseTo(1, 12);
    expect(result.observationCount).toBe(second.length - 1);
    expect(returnCorrelation(second, first)).toEqual(result);
  });

  it("returns insufficient data when the series share no dates", () => {
    const first = daily("2026-01-01", pricesFromReturns(varied));
    const second = daily("2026-06-01", pricesFromReturns(varied));
    expect(returnCorrelation(first, second)).toEqual({ status: "insufficient-data", coefficient: null, observationCount: 0, startDate: null, endDate: null, frequency: "daily" });
  });

  it("excludes gaps longer than four days instead of bridging them", () => {
    const before = daily("2026-01-01", pricesFromReturns(varied.slice(0, 14)));
    const after = daily("2026-03-01", pricesFromReturns(varied.slice(15)));
    const series = [...before, ...after];
    const result = returnCorrelation(series, series);
    expect(result.observationCount).toBe(series.length - 2);
    expect(result).toMatchObject({ status: "ok", startDate: "2026-01-01", endDate: after.at(-1)?.date });

    // A weekend-sized gap of three days is still a single return.
    const weekend = [...daily("2026-01-01", [100, 101]), ...daily("2026-01-05", [102, 101])];
    expect(returnCorrelation(weekend, weekend).observationCount).toBe(3);
  });

  it(`needs at least ${MIN_CORRELATION_OBSERVATIONS} paired returns`, () => {
    const enough = daily("2026-01-01", pricesFromReturns(varied.slice(0, MIN_CORRELATION_OBSERVATIONS)));
    const tooFew = enough.slice(0, -1);
    expect(returnCorrelation(enough, enough)).toMatchObject({ status: "ok", observationCount: MIN_CORRELATION_OBSERVATIONS });
    expect(returnCorrelation(tooFew, tooFew)).toEqual({
      status: "insufficient-data", coefficient: null, observationCount: MIN_CORRELATION_OBSERVATIONS - 1,
      startDate: "2026-01-01", endDate: tooFew.at(-1)?.date, frequency: "daily",
    });
    expect(returnCorrelation([], enough)).toMatchObject({ status: "insufficient-data", coefficient: null, observationCount: 0 });
  });

  it("weekly returns use the last common close of each ISO week", () => {
    // 2026-01-05 is a Monday. 25 weeks of Monday-to-Friday closes.
    const weekdays = Array.from({ length: 25 * 7 }, (_, index) => index).filter((index) => index % 7 < 5);
    const weeklyReturns = Array.from({ length: 25 }, (_, week) => varied[week]);
    const closeOn = (returns: number[]) => {
      const fridays = pricesFromReturns(returns);
      return weekdays.map((index) => {
        const week = Math.floor(index / 7);
        // Mid-week noise must not affect weekly returns; only Friday closes do.
        return { date: new Date(Date.parse("2026-01-05T00:00:00.000Z") + index * DAY_MS).toISOString().slice(0, 10), close: index % 7 === 4 ? fridays[week + 1] : 50 + index };
      });
    };
    const first = closeOn(weeklyReturns);
    const second = closeOn(weeklyReturns.map((value) => -value));
    const weekly = returnCorrelation(first, second, "weekly");
    expect(weekly).toMatchObject({ status: "ok", observationCount: 24, startDate: "2026-01-09", endDate: "2026-06-26", frequency: "weekly" });
    expect(weekly.coefficient).toBeCloseTo(-1, 12);
  });

  it("weekly returns exclude a week without any common date", () => {
    const series = daily("2026-01-05", pricesFromReturns(Array.from({ length: 30 * 7 - 1 }, (_, index) => varied[index % varied.length])));
    const missingWeek = series.filter((point) => point.date < "2026-02-02" || point.date > "2026-02-08");
    const contiguous = returnCorrelation(series, series, "weekly");
    const withGap = returnCorrelation(series, missingWeek, "weekly");
    expect(contiguous.observationCount).toBe(29);
    expect(withGap.observationCount).toBe(27);
  });

  it("keeps the coefficient within [−1, 1] for many irregular series", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const a = Array.from({ length: 60 }, (_, index) => Math.sin(index * seed * 0.37) * 0.02 + 0.1 / 3);
      const b = Array.from({ length: 60 }, (_, index) => Math.cos(index * seed * 0.11) * 0.0133 + a[index] * 0.25);
      const result = returnCorrelation(daily("2026-01-01", pricesFromReturns(a, 1.3333)), daily("2026-01-01", pricesFromReturns(b, 0.1)));
      expect(result.status).toBe("ok");
      expect(result.coefficient).toBeGreaterThanOrEqual(-1);
      expect(result.coefficient).toBeLessThanOrEqual(1);
    }
  });
});
