import { describe, expect, it } from "vitest";
import { calculateBacktestMetrics } from "@/features/lab/backtest";
import { syntheticMonthlyData } from "@/features/lab/sample-data";
import { backtestPeriods, buildBacktestResult, formatBacktestMoney, formatBacktestMoneyDifference, formatBacktestMonth, formatPercentagePoints, formatSharpeDifference, formatSharpeRatio } from "./backtest-model";

const config = { strategy: "mixed", start: 2015, end: 2025, amount: "100000" };
describe("Backtesting presentation snapshots", () => {
  it("preserves the established mixed fixture and every observation without interpolation", () => {
    const result = buildBacktestResult(config);
    expect(result.metrics.finalValue).toBeCloseTo(159732.4758937891, 8);
    expect(result.points).toHaveLength(133);
    expect(result.points[0]).toEqual({ label: "2014-12", value: 100000, benchmark: 100000 });
    expect(result.points.slice(1).map((point) => point.label)).toEqual(syntheticMonthlyData.map((row) => row.month));
    expect(result.points.map((point) => point.value)).toEqual(result.metrics.values);
    expect(result.points.map((point) => point.benchmark)).toEqual(result.benchmark.values);
    expect(result.benchmark).toEqual(calculateBacktestMetrics(100000, syntheticMonthlyData.map((row) => row.stocks)));
  });
  it("reproduces identical input and freezes the submitted configuration", () => {
    const input = { ...config };
    const result = buildBacktestResult(input);
    expect(buildBacktestResult(input)).toEqual(result);
    input.start = 2022;
    expect(result.config.start).toBe(2015);
  });
  it("never reads returns outside the selected period", () => {
    const input = { ...config, start: 2020, end: 2020 };
    const altered = syntheticMonthlyData.map((row) => row.month.startsWith("2020") ? row : { ...row, stocks: 0.99, bonds: -0.9 });
    expect(buildBacktestResult(input, altered)).toEqual(buildBacktestResult(input));
    expect(buildBacktestResult(input).points).toHaveLength(13);
  });
  it("equity strategy equals its benchmark, and bonds use their own series", () => {
    const stocks = buildBacktestResult({ ...config, strategy: "stocks" });
    expect(stocks.metrics).toEqual(stocks.benchmark);
    const bonds = buildBacktestResult({ ...config, strategy: "bonds" });
    expect(bonds.metrics).toEqual(calculateBacktestMetrics(100000, syntheticMonthlyData.map((row) => row.bonds)));
  });
  it.each(["0.1", "0.25", "1.3333"])("retains decimal precision for %s until the display boundary", (amount) => {
    const result = buildBacktestResult({ ...config, amount });
    expect(result.amount).toBe(Number(amount));
    expect(result.metrics.finalValue / Number(amount)).toBeCloseTo(buildBacktestResult(config).metrics.finalValue / 100000, 12);
  });
  it("only offers complete periods supported by the existing fixture", () => {
    for (const period of backtestPeriods) {
      const result = buildBacktestResult({ ...config, start: period.start, end: period.end });
      expect(result.months).toBe((period.end - period.start + 1) * 12);
      expect(result.points.at(-1)?.label).toBe(`${period.end}-12`);
    }
  });
  it.each([[], syntheticMonthlyData.slice(1), [...syntheticMonthlyData].reverse(), syntheticMonthlyData.map((row, index) => index === 1 ? syntheticMonthlyData[0] : row), syntheticMonthlyData.map((row, index) => index === 1 ? { ...row, bonds: NaN } : row)].map((data) => [data] as const))("rejects absent, partial, unordered, duplicate and invalid data rather than padding it", (data) => {
    expect(() => buildBacktestResult(config, data)).toThrow();
  });
  it.each(["", "0", "-1", "NaN", "Infinity"])("rejects invalid initial amount %s", (amount) => expect(() => buildBacktestResult({ ...config, amount })).toThrow());
  it("rejects unknown strategies and reversed periods", () => {
    expect(() => buildBacktestResult({ ...config, strategy: "VTI" })).toThrow();
    expect(() => buildBacktestResult({ ...config, start: 2025, end: 2020 })).toThrow();
  });
  it("uses Czech month names independently of machine timezone", () => expect(formatBacktestMonth("2020-01")).toBe("leden 2020"));
  it("names the sample benchmark as buying and holding the stock sample", () => {
    expect(buildBacktestResult(config).benchmarkName).toBe("Buy-and-hold akciového vzorku");
  });
  it("signs A − B differences without judging them, and leaves zero unsigned", () => {
    expect(formatPercentagePoints(0.0123)).toBe("+1,23 p. b.");
    expect(formatPercentagePoints(-0.25)).toBe("-25 p. b.");
    expect(formatPercentagePoints(0)).toBe("0 p. b.");
    expect(formatBacktestMoneyDifference(3321.4, "USD").replace(/\s/g, " ")).toBe("+3 321 $");
    expect(formatBacktestMoneyDifference(-0.25).replace(/\s/g, " ")).toBe("-0,25 Kč");
    expect(formatBacktestMoneyDifference(0).replace(/\s/g, " ")).toBe("0 Kč");
  });
  it("shows an undefined Sharpe ratio as unavailable, never as zero", () => {
    expect(formatSharpeRatio(Math.sqrt(11) / 3)).toBe("1,11");
    expect(formatSharpeRatio(-0.5)).toBe("-0,50");
    expect(formatSharpeRatio(0)).toBe("0,00");
    expect(formatSharpeRatio(null)).toBe("Nedostupné");
    expect(formatSharpeDifference(1.25, 0.5)).toBe("+0,75");
    expect(formatSharpeDifference(0.5, 0.5)).toBe("0,00");
    expect(formatSharpeDifference(0.46, 0.76)).toBe("-0,30");
    expect(formatSharpeDifference(null, 0.5)).toBe("Nedostupné");
  });
  it("reports total return and Sharpe ratio for the strategy and the benchmark", () => {
    const result = buildBacktestResult(config);
    expect(result.metrics.totalReturn).toBeCloseTo(result.metrics.finalValue / 100000 - 1, 12);
    expect(result.benchmark.totalReturn).toBeCloseTo(result.benchmark.finalValue / 100000 - 1, 12);
    expect(result.metrics.sharpeRatio).toEqual(expect.any(Number));
    expect(result.benchmark.sharpeRatio).toEqual(expect.any(Number));
    expect(result.metrics.riskFreeRate).toBe(0);
  });
  it("keeps small amounts readable at the presentation boundary", () => {
    expect(formatBacktestMoney(0.25)).toBe("0,25 Kč");
    expect(formatBacktestMoney(159732.4758937891)).toBe("159 732 Kč");
  });
});
