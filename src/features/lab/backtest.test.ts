import { describe, expect, it } from "vitest";
import { BACKTEST_RISK_FREE_RATE, calculateBacktestMetrics, calculateCagr, calculateGrowthSeries, calculateMaxDrawdown, calculateSharpeRatio, calculateTotalReturn, calculateVolatility, selectMonthlySample } from "./backtest";
import { syntheticMonthlyData } from "./sample-data";
describe("backtesting math", () => {
  it("CAGR reflects intervals, not number of observations", () => {
    expect(calculateCagr(100, 121, 2)).toBeCloseTo(0.1, 12);
    expect(calculateCagr(100, 0, 1)).toBe(-1);
    expect(calculateCagr(100, 81, 2)).toBeCloseTo(-0.1, 12);
  });
  it("drawdown includes the initial peak and can reach 100%", () => {
    expect(calculateMaxDrawdown([100, 80, 120, 90, 130])).toBeCloseTo(0.25);
    expect(calculateMaxDrawdown([100, 80, 0])).toBe(1);
    expect(calculateMaxDrawdown([100, 110, 120])).toBe(0);
  });
  it("uses sample volatility and explicit monthly annualization", () => {
    expect(calculateVolatility([0.1, -0.1], 12)).toBeCloseTo(0.4898979485566356, 12);
    expect(calculateVolatility([0.1, 0.1, 0.1], 12)).toBeCloseTo(0, 12);
  });
  it("compounds sequentially and preserves total loss", () => {
    expect(calculateGrowthSeries(100, [0.1, -0.1])).toEqual([100, 110.00000000000001, 99.00000000000001]);
    expect(calculateGrowthSeries(100, [-1, 0.5])).toEqual([100, 0, 0]);
  });
  it("known two-month metrics: +10%, −10%", () => {
    const result = calculateBacktestMetrics(100, [0.1, -0.1]);
    expect(result.finalValue).toBeCloseTo(99, 12);
    expect(result.cagr).toBeCloseTo(-0.058519850599, 10);
    expect(result.maxDrawdown).toBeCloseTo(0.1, 12);
  });
  it("total return is the whole-period change, not annualized like CAGR", () => {
    expect(calculateTotalReturn(100, 121)).toBeCloseTo(0.21, 12);
    expect(calculateCagr(100, 121, 2)).toBeCloseTo(0.1, 12);
    expect(calculateTotalReturn(100, 0)).toBe(-1);
    expect(calculateTotalReturn(100, 100)).toBe(0);
    expect(calculateBacktestMetrics(100, [0.1, -0.1]).totalReturn).toBeCloseTo(-0.01, 12);
    expect(() => calculateTotalReturn(0, 100)).toThrow();
    expect(() => calculateTotalReturn(100, NaN)).toThrow();
  });
  it.each([0.1, 0.25, 1.3333])("total return does not depend on a decimal starting amount of %s", (initial) => {
    expect(calculateBacktestMetrics(initial, [0.1, 0.25, -0.2]).totalReturn).toBeCloseTo(1.1 * 1.25 * 0.8 - 1, 12);
  });
});
describe("Sharpe ratio", () => {
  // Twelve months alternating +2 % and −1 %: mean 0.5 %, sample deviation 1.5 % × √(12/11).
  const alternating = Array.from({ length: 12 }, (_, index) => index % 2 ? -0.01 : 0.02);
  it("hand example: mean ÷ sample deviation × √12 = √11 / 3 at a 0 % rate", () => {
    expect(calculateSharpeRatio(alternating, 12, 0)).toBeCloseTo(Math.sqrt(11) / 3, 12);
    expect(BACKTEST_RISK_FREE_RATE).toBe(0);
    expect(calculateSharpeRatio(alternating, 12)).toBe(calculateSharpeRatio(alternating, 12, 0));
  });
  it("subtracts the annual rate spread geometrically over the months", () => {
    const monthly = 1.03 ** (1 / 12) - 1;
    const deviation = 0.015 * Math.sqrt(12 / 11);
    expect(calculateSharpeRatio(alternating, 12, 0.03)).toBeCloseTo((0.005 - monthly) / deviation * Math.sqrt(12), 12);
    expect(calculateSharpeRatio(alternating, 12, 0.03)).toBeCloseTo(0.5602288323500281, 10);
  });
  it("is negative when the excess return is negative", () => {
    expect(calculateSharpeRatio(alternating.map((value) => -value), 12, 0)).toBeCloseTo(-Math.sqrt(11) / 3, 12);
    // Positive returns, but below a 10 % annual rate.
    expect(calculateSharpeRatio(alternating.map((value) => value / 4), 12, 0.1)).toBeLessThan(0);
  });
  it("uses the same deviation as volatility, so Sharpe × volatility is the annualized mean excess return", () => {
    const returns = [0.1, 0.25, 1.3333, -0.1, 0.1, 0.25, 1.3333, -0.1, 0.1, 0.25, 1.3333, -0.1];
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    expect(calculateSharpeRatio(returns, 12, 0)! * calculateVolatility(returns, 12)).toBeCloseTo(mean * 12, 12);
    expect(calculateSharpeRatio(returns, 12, 0)).toBeCloseTo(2.3640880579575323, 10);
  });
  it("is unavailable (null), not infinite or zero, without variation or a full year of returns", () => {
    expect(calculateSharpeRatio(Array(12).fill(0.1), 12, 0)).toBeNull();
    expect(calculateSharpeRatio(Array(24).fill(0), 12, 0)).toBeNull();
    expect(calculateSharpeRatio(alternating.slice(1), 12, 0)).toBeNull();
    expect(calculateBacktestMetrics(100, [0.1, -0.1]).sharpeRatio).toBeNull();
    expect(calculateBacktestMetrics(100, alternating)).toMatchObject({ sharpeRatio: expect.closeTo(Math.sqrt(11) / 3, 12), riskFreeRate: 0 });
  });
  it("rejects invalid returns, frequencies and rates", () => {
    expect(() => calculateSharpeRatio([...alternating, NaN], 12, 0)).toThrow();
    expect(() => calculateSharpeRatio([...alternating, -1.01], 12, 0)).toThrow();
    expect(() => calculateSharpeRatio(alternating, 0, 0)).toThrow();
    expect(() => calculateSharpeRatio(alternating, 12, -1)).toThrow();
    expect(() => calculateSharpeRatio(alternating, 12, Infinity)).toThrow();
  });
});
describe("backtesting input validation", () => {
  it.each([0, -1, NaN, Infinity])("rejects starting amount %s", (value) => expect(() => calculateBacktestMetrics(value, [0.1, 0.2])).toThrow());
  it.each<[number[]]>([[[]], [[0.1]], [[NaN, 0.1]], [[Infinity, 0.1]], [[-1.01, 0.1]]])("rejects insufficient or invalid returns %j", (returns) => expect(() => calculateBacktestMetrics(100, returns)).toThrow());
  it("rejects invalid time, terminal values, observations and overflowing results", () => {
    expect(() => calculateCagr(100, -10, 1)).toThrow();
    expect(() => calculateCagr(100, 110, 0)).toThrow();
    expect(() => calculateMaxDrawdown([100, NaN])).toThrow();
    expect(() => calculateMaxDrawdown([100, -1])).toThrow();
    expect(() => calculateVolatility([0, 1], 0)).toThrow();
    expect(() => calculateGrowthSeries(1e308, [10, 10])).toThrow();
  });
});
describe("explicit, complete monthly fixture", () => {
  it("has 132 deterministic monthly samples and 133 growth observations", () => {
    const rows = selectMonthlySample(syntheticMonthlyData, 2015, 2025);
    expect(rows).toHaveLength(132);
    expect(calculateBacktestMetrics(100000, rows.map((row) => row.stocks)).values).toHaveLength(133);
    expect(selectMonthlySample(rows, 2020, 2020)).toHaveLength(12);
    expect(syntheticMonthlyData[62].stocks).toBe(-0.24);
  });
  it("rejects missing, duplicate, unordered, non-finite and incomplete data", () => {
    expect(() => selectMonthlySample(syntheticMonthlyData.slice(1), 2015, 2025)).toThrow();
    for (const data of [[...syntheticMonthlyData].reverse(), syntheticMonthlyData.map((row, i) => i === 1 ? syntheticMonthlyData[0] : row), syntheticMonthlyData.map((row, i) => i === 1 ? { ...row, bonds: NaN } : row)]) expect(() => selectMonthlySample(data, 2015, 2025)).toThrow();
    expect(() => selectMonthlySample(syntheticMonthlyData, 2025, 2015)).toThrow();
    expect(() => selectMonthlySample(syntheticMonthlyData, 2014, 2020)).toThrow();
  });
});
