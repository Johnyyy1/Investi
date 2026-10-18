import { describe, expect, it } from "vitest";
import { buildBacktestResult } from "@/components/lab/backtest-model";
import { syntheticMonthlyData } from "@/features/lab/sample-data";
import { simulateBacktest, simulateBuyAndHold } from "./simulate";
import { BacktestDataError, buyAndHoldFor, monthRange, type BacktestSpec } from "./spec";

const base = { frequency: "monthly", currency: "USD", adjustment: "split-adjusted", initialAmount: 100 } as const;
const mix = (rebalance: "none" | "monthly" | "annual", startMonth = "2020-11", endMonth = "2021-01"): BacktestSpec => ({
  ...base, startMonth, endMonth, holdings: [{ instrumentId: "A", weightBps: 5_000 }, { instrumentId: "B", weightBps: 5_000 }], cashWeightBps: 0, rule: { kind: "fixed-weights", rebalance },
});
// Test-only closes, Oct 2020 – Jan 2021: A doubles, halves and doubles again; B stays flat.
const swing = { months: ["2020-10", "2020-11", "2020-12", "2021-01"], closes: [[10, 20, 10, 20], [10, 10, 10, 10]] };

describe("fixed-weight rebalancing", () => {
  it("never rebalances: the sleeves drift with their prices", () => {
    const result = simulateBacktest(mix("none"), swing);
    expect(result.values).toEqual([100, 150, 100, 150]);
    expect(result.rebalanceMonths).toEqual([]);
    expect(result.exposure).toEqual([1, 1, 1]);
  });
  it("rebalances monthly back to 50 / 50", () => {
    const result = simulateBacktest(mix("monthly"), swing);
    expect(result.values).toEqual([100, 150, 112.5, 168.75]);
    expect(result.rebalanceMonths).toEqual(["2020-11", "2020-12"]);
  });
  it("rebalances annually only at a December close, and never after the last month", () => {
    const result = simulateBacktest(mix("annual"), swing);
    expect(result.rebalanceMonths).toEqual(["2020-12"]);
    expect(result.values).toEqual([100, 150, 100, 150]);
    const longer = { months: monthRange("2019-11", "2021-12"), closes: [monthRange("2019-11", "2021-12").map((_, index) => 10 + index), monthRange("2019-11", "2021-12").map(() => 5)] };
    expect(simulateBacktest(mix("annual", "2019-12", "2021-12"), longer).rebalanceMonths).toEqual(["2019-12", "2020-12"]);
  });
  it("keeps cash flat and reports the invested share", () => {
    const spec: BacktestSpec = { ...mix("none"), holdings: [{ instrumentId: "A", weightBps: 6_000 }], cashWeightBps: 4_000 };
    const result = simulateBacktest(spec, { months: swing.months, closes: [swing.closes[0]] });
    expect(result.values).toEqual([100, 160, 100, 160]);
    expect(result.exposure[0]).toBeCloseTo(0.6, 12);
    expect(result.exposure[1]).toBeCloseTo(0.75, 12);
  });
  it("monthly rebalancing on price indices reproduces the synthetic Mix 60 / 30 / 10", () => {
    const rows = syntheticMonthlyData;
    const index = (key: "stocks" | "bonds" | "cash") => rows.reduce((levels, row) => [...levels, levels.at(-1)! * (1 + row[key])], [1]);
    const spec: BacktestSpec = { ...base, initialAmount: 100_000, startMonth: "2015-01", endMonth: "2025-12", holdings: [{ instrumentId: "S", weightBps: 6_000 }, { instrumentId: "B", weightBps: 3_000 }, { instrumentId: "C", weightBps: 1_000 }], cashWeightBps: 0, rule: { kind: "fixed-weights", rebalance: "monthly" } };
    const result = simulateBacktest(spec, { months: monthRange("2014-12", "2025-12"), closes: [index("stocks"), index("bonds"), index("cash")] });
    const reference = buildBacktestResult({ strategy: "mixed", start: 2015, end: 2025, amount: "100000" });
    expect(result.metrics.finalValue).toBeCloseTo(reference.metrics.finalValue, 6);
    expect(result.metrics.maxDrawdown).toBeCloseTo(reference.metrics.maxDrawdown, 10);
    expect(result.metrics.volatility).toBeCloseTo(reference.metrics.volatility, 10);
    expect(result.metrics.cagr).toBeCloseTo(reference.metrics.cagr, 10);
  });
  it.each([0.1, 0.25, 1.3333])("scales linearly with a decimal starting amount of %s", (initialAmount) => {
    const result = simulateBacktest({ ...mix("monthly"), initialAmount }, swing);
    expect(result.metrics.finalValue / initialAmount).toBeCloseTo(1.6875, 12);
  });
});

describe("trend filter", () => {
  const trend = (startMonth: string, endMonth: string, smaMonths = 3): BacktestSpec => ({ ...base, startMonth, endMonth, holdings: [{ instrumentId: "A", weightBps: 10_000 }], cashWeightBps: 0, rule: { kind: "trend-filter", smaMonths } });
  // Lookback Oct–Dec 2019, then Jan–Jun 2020. Test-only closes.
  const months = monthRange("2019-10", "2020-06");
  const closes = [10, 11, 12, 13, 9, 8, 9, 12, 13];

  it("holds the instrument only after a close above its moving average, else cash", () => {
    const result = simulateBacktest(trend("2020-01", "2020-06"), { months, closes: [closes] });
    // Decisions at Dec…May closes: 12>11 in, 13>12 in, 9<11.33 out, 8<10 out, 9>8.67 in, 12>9.67 in.
    expect(result.exposure).toEqual([1, 1, 0, 0, 1, 1]);
    expect(result.switches).toBe(2);
    expect(result.months).toEqual(monthRange("2019-12", "2020-06"));
    expect(result.values.map((value) => Number(value.toFixed(10)))).toEqual([100, 108.3333333333, 75, 75, 75, 100, 108.3333333333]);
  });
  it("does not look ahead: changing any later close never changes earlier values or decisions", () => {
    const full = simulateBacktest(trend("2020-01", "2020-06"), { months, closes: [closes] });
    for (let cut = 3; cut < months.length - 1; cut += 1) {
      const altered = closes.map((close, index) => index > cut ? close * (index % 2 ? 3 : 0.2) : close);
      const result = simulateBacktest(trend("2020-01", "2020-06"), { months, closes: [altered] });
      // values[0] is the December 2019 close (index 2), so values[cut - 2] is the value at month `cut`.
      const seen = cut - 2;
      expect(result.values.slice(0, seen + 1)).toEqual(full.values.slice(0, seen + 1));
      // exposure[cut - 2] is the month after `cut`, decided at the close of `cut`.
      expect(result.exposure.slice(0, seen + 1)).toEqual(full.exposure.slice(0, seen + 1));
      expect(result.values).not.toEqual(full.values);
    }
  });
  it("refuses to start without the whole moving-average window", () => {
    expect(() => simulateBacktest(trend("2020-01", "2020-06"), { months: months.slice(1), closes: [closes.slice(1)] })).toThrow(BacktestDataError);
  });
});

describe("refusing incomplete input", () => {
  it.each([
    ["a missing month", { months: ["2020-10", "2020-12", "2021-01"], closes: [[10, 10, 20], [10, 10, 10]] }],
    ["a missing close", { months: swing.months, closes: [[10, 20, 10], [10, 10, 10, 10]] }],
    ["a zero close", { months: swing.months, closes: [[10, 0, 10, 20], [10, 10, 10, 10]] }],
    ["a non-finite close", { months: swing.months, closes: [[10, Number.NaN, 10, 20], [10, 10, 10, 10]] }],
    ["a missing instrument", { months: swing.months, closes: [[10, 20, 10, 20]] }],
  ])("rejects %s rather than filling it", (_, data) => expect(() => simulateBacktest(mix("monthly"), data)).toThrow(BacktestDataError));
});

describe("buy-and-hold benchmark", () => {
  // Test-only closes, Nov 2020 – Jan 2021, of the instrument a single-holding strategy owns.
  const single = { months: ["2020-11", "2020-12", "2021-01"], closes: [[10, 13, 7.3]] };
  const own = (rebalance: "none" | "monthly" | "annual"): BacktestSpec => ({ ...base, startMonth: "2020-12", endMonth: "2021-01", holdings: [{ instrumentId: "A", weightBps: 10_000 }], cashWeightBps: 0, rule: { kind: "fixed-weights", rebalance } });

  it("is identical to a strategy that holds the same instrument at 100 % without rebalancing", () => {
    const strategy = simulateBacktest(own("none"), single);
    const benchmark = simulateBuyAndHold(buyAndHoldFor(own("none"), "A"), single);
    expect(benchmark.values).toEqual(strategy.values);
    expect(benchmark.metrics).toEqual(strategy.metrics);
    // With a single holding, rebalancing changes nothing either.
    expect(simulateBacktest(own("monthly"), single).values).toEqual(benchmark.values);
  });
  it("buys once at the start value and never trades again", () => {
    const result = simulateBuyAndHold(buyAndHoldFor(own("none"), "A"), single);
    expect(result.values).toEqual([100, 130, 73]);
    expect(result.rebalanceMonths).toEqual([]);
    expect(result.exposure).toEqual([1, 1]);
  });
  it.each([0.1, 0.25, 1.3333])("scales linearly with a decimal starting amount of %s", (initialAmount) => {
    const result = simulateBuyAndHold(buyAndHoldFor({ ...own("none"), initialAmount }, "A"), single);
    expect(result.metrics.finalValue / initialAmount).toBeCloseTo(0.73, 12);
  });
  it("refuses other return semantics and incomplete closes", () => {
    expect(() => simulateBuyAndHold({ ...buyAndHoldFor(own("none"), "A"), adjustment: "total-return" }, single)).toThrow(BacktestDataError);
    expect(() => simulateBuyAndHold(buyAndHoldFor(own("none"), "A"), { months: single.months.slice(1), closes: [single.closes[0].slice(1)] })).toThrow(BacktestDataError);
  });
});
