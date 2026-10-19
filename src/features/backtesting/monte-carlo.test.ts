import { describe, expect, it } from "vitest";
import { FinancialInputError } from "@/features/finance/returns";
import { monthlyReturnsOf, percentileOf, seededRandom, SIMULATION_PERCENTILES, simulateFuturePaths, type SimulationSpec } from "./monte-carlo";

/** 36 varied months: a rough equity-like history with gains and losses. */
const history = Array.from({ length: 36 }, (_, index) => [0.04, -0.06, 0.012, 0.025, -0.018, 0.031][index % 6] + index * 0.0004);
const spec = (overrides: Partial<SimulationSpec> = {}): SimulationSpec => ({ returns: history, initialAmount: 10_000, monthlyContribution: 0, horizonMonths: 120, paths: 1_000, blockMonths: 6, seed: 42, ...overrides });

describe("seeded random numbers", () => {
  it("repeats the same sequence for the same seed and stays in [0, 1)", () => {
    const a = seededRandom(7), b = seededRandom(7), c = seededRandom(8);
    const first = Array.from({ length: 1_000 }, a);
    expect(Array.from({ length: 1_000 }, b)).toEqual(first);
    expect(Array.from({ length: 1_000 }, c)).not.toEqual(first);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("percentiles", () => {
  it("interpolates linearly between the closest ranks", () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentileOf(sorted, 0)).toBe(1);
    expect(percentileOf(sorted, 5)).toBeCloseTo(1.2, 12);
    expect(percentileOf(sorted, 25)).toBe(2);
    expect(percentileOf(sorted, 50)).toBe(3);
    expect(percentileOf(sorted, 95)).toBeCloseTo(4.8, 12);
    expect(percentileOf(sorted, 100)).toBe(5);
    expect(percentileOf([0.1], 75)).toBe(0.1);
  });
  it("refuses an empty set instead of returning zero", () => {
    expect(() => percentileOf([], 50)).toThrow(FinancialInputError);
  });
});

describe("future paths from the history's monthly returns", () => {
  it("gives the same result for the same seed and a different draw for another seed", () => {
    const first = simulateFuturePaths(spec());
    expect(simulateFuturePaths(spec())).toEqual(first);
    expect(simulateFuturePaths(spec({ seed: 43 })).finalValues).not.toEqual(first.finalValues);
  });
  it("reports ordered percentiles for the start and every month of the horizon", () => {
    const result = simulateFuturePaths(spec({ monthlyContribution: 250 }));
    expect(result.months).toHaveLength(121);
    expect(result.months.map((row) => row.month)).toEqual(Array.from({ length: 121 }, (_, month) => month));
    for (const row of result.months) {
      const levels = SIMULATION_PERCENTILES.map((percentile) => row[`p${percentile}`]);
      levels.slice(1).forEach((level, index) => expect(level).toBeGreaterThanOrEqual(levels[index]));
    }
    expect(result.months.at(-1)!.p5).toBeLessThan(result.months.at(-1)!.p95);
  });
  it("starts every path at the initial amount", () => {
    const [start] = simulateFuturePaths(spec()).months;
    expect(start).toEqual({ month: 0, contributed: 10_000, p5: 10_000, p25: 10_000, p50: 10_000, p75: 10_000, p95: 10_000 });
  });
  it("keeps every final value, ascending, and the last month's percentiles are theirs", () => {
    const result = simulateFuturePaths(spec());
    expect(result.finalValues).toHaveLength(1_000);
    result.finalValues.slice(1).forEach((value, index) => expect(value).toBeGreaterThanOrEqual(result.finalValues[index]));
    const last = result.months.at(-1)!;
    for (const percentile of SIMULATION_PERCENTILES) expect(last[`p${percentile}`]).toBe(percentileOf(result.finalValues, percentile));
    expect(result).toMatchObject({ paths: 1_000, historyMonths: 36, blockMonths: 6, seed: 42 });
  });
  it("makes every path identical when the history never varies", () => {
    const result = simulateFuturePaths(spec({ returns: Array(30).fill(0.01), horizonMonths: 24, monthlyContribution: 100 }));
    // 10 000 × 1.01^24 plus 100 at each month end, itself compounding: 100 × (1.01^24 − 1) ÷ 0.01.
    const expected = 10_000 * 1.01 ** 24 + 100 * (1.01 ** 24 - 1) / 0.01;
    for (const value of result.finalValues) expect(value).toBeCloseTo(expected, 8);
    for (const row of result.months) expect(row.p95 - row.p5).toBeCloseTo(0, 8);
  });
  it("counts contributions separately from growth", () => {
    const result = simulateFuturePaths(spec({ returns: Array(24).fill(0), horizonMonths: 12, monthlyContribution: 500 }));
    for (const row of result.months) {
      expect(row.contributed).toBe(10_000 + 500 * row.month);
      expect(row.p50).toBeCloseTo(row.contributed, 10);
    }
  });
  it("draws whole blocks of consecutive months and wraps around the end of the history", () => {
    // A block as long as the history is a rotation of it: every path holds each month exactly
    // once, so every path ends at the same value whatever month its block starts at.
    const returns = history.slice(0, 24);
    const result = simulateFuturePaths(spec({ returns, horizonMonths: 24, blockMonths: 24 }));
    const whole = returns.reduce((value, rate) => value * (1 + rate), 10_000);
    expect(result.finalValues[0]).toBeCloseTo(whole, 8);
    expect(result.finalValues.at(-1)!).toBeCloseTo(whole, 8);
    // With single-month blocks the paths do not hold every month once, so they spread out.
    const single = simulateFuturePaths(spec({ returns, horizonMonths: 24, blockMonths: 1 }));
    expect(single.finalValues.at(-1)! - single.finalValues[0]).toBeGreaterThan(1);
  });
  it("never loses more than everything", () => {
    const result = simulateFuturePaths(spec({ returns: [...Array(23).fill(0.02), -1], horizonMonths: 60, blockMonths: 1 }));
    expect(result.finalValues[0]).toBe(0);
    expect(result.months.every((row) => row.p5 >= 0)).toBe(true);
  });
  it("refuses inputs it cannot simulate honestly", () => {
    const refused = (overrides: Partial<SimulationSpec>) => expect(() => simulateFuturePaths(spec(overrides))).toThrow(FinancialInputError);
    refused({ returns: history.slice(0, 23) });
    refused({ returns: [...history.slice(0, 30), Number.NaN] });
    refused({ returns: [...history.slice(0, 30), -1.01] });
    refused({ initialAmount: 0 });
    refused({ monthlyContribution: -1 });
    refused({ horizonMonths: 0 });
    refused({ horizonMonths: 241 });
    refused({ horizonMonths: 12.5 });
    refused({ paths: 1 });
    refused({ paths: 10_001 });
    refused({ blockMonths: 0 });
    refused({ blockMonths: 37 });
    refused({ seed: 1.5 });
  });
});

describe("monthly returns of a value path", () => {
  it("divides each value by the one before it", () => {
    const returns = monthlyReturnsOf([100, 110, 99, 99]);
    expect(returns[0]).toBeCloseTo(0.1, 12);
    expect(returns[1]).toBeCloseTo(-0.1, 12);
    expect(returns[2]).toBe(0);
  });
  it("refuses a path through zero or a missing value", () => {
    expect(() => monthlyReturnsOf([100, 0, 50])).toThrow(FinancialInputError);
    expect(() => monthlyReturnsOf([100, Number.NaN])).toThrow(FinancialInputError);
  });
});
