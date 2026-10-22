import { describe, expect, it } from "vitest";
import { simulateBacktest, simulateBuyAndHold } from "./simulate";
import { backtestSpecSchema, buyAndHoldFor, monthRange, NO_COSTS, type BacktestSpec } from "./spec";
import { moneyWeightedReturn, splitSimulation } from "./experiments";

const spec: BacktestSpec = { holdings: [{ instrumentId: "A", weightBps: 10_000 }], cashWeightBps: 0, rule: { kind: "fixed-weights", rebalance: "none" }, startMonth: "2020-01", endMonth: "2020-12", initialAmount: 100, frequency: "monthly", currency: "USD", adjustment: "split-adjusted", costs: NO_COSTS };
const flat = { months: monthRange("2019-12", "2020-12"), closes: [Array(13).fill(10)] };

describe("educational cash-flow experiments", () => {
  it("keeps omitted and explicitly disabled settings identical", () => {
    expect(simulateBacktest({ ...spec, contributions: { monthlyAmount: 0 }, annualFundCostBps: 0, lumpSumSplit: { months: 1 } }, flat)).toEqual(simulateBacktest(spec, flat));
  });
  it.each([0.1, 0.25, 1.3333])("never counts a monthly contribution of %s as performance", (monthlyAmount) => {
    const result = simulateBacktest({ ...spec, contributions: { monthlyAmount } }, flat);
    expect(result.metrics.finalValue).toBeCloseTo(100 + 12 * monthlyAmount, 10);
    expect(result.metrics.totalReturn).toBeCloseTo(0, 12);
    expect(result.metrics.maxDrawdown).toBe(0);
    expect(result.education?.mwr).toBeCloseTo(0, 10);
    expect(result.education?.gain).toBeCloseTo(0, 10);
  });
  it("applies flows after the month's return, including the last month", () => {
    const short = { ...spec, endMonth: "2020-02", contributions: { monthlyAmount: 100 } };
    const result = simulateBacktest(short, { months: monthRange("2019-12", "2020-02"), closes: [[10, 20, 40]] });
    expect(result.values).toEqual([100, 300, 700]);
    expect(result.metrics.totalReturn).toBeCloseTo(3, 12);
    expect(result.education?.contributed).toBe(300);
    expect(result.education?.gain).toBe(400);
    expect(result.education?.mwr).toBeCloseTo(2 ** 12 - 1, 7);
    expect(simulateBuyAndHold(buyAndHoldFor(short, "A"), { months: monthRange("2019-12", "2020-02"), closes: [[10, 20, 40]] })).toEqual(result);
  });
  it("respects contribution dates without silently extending them", () => {
    const result = simulateBacktest({ ...spec, contributions: { monthlyAmount: 10, startMonth: "2020-03", endMonth: "2020-05" } }, flat);
    expect(result.education?.contributed).toBe(130);
    expect(backtestSpecSchema.safeParse({ ...spec, contributions: { monthlyAmount: 10, endMonth: "2019-12" } }).success).toBe(false);
  });
  it("stages the initial budget from cash without creating new capital", () => {
    const result = simulateBacktest({ ...spec, endMonth: "2020-02", lumpSumSplit: { months: 2 } }, { months: monthRange("2019-12", "2020-02"), closes: [[10, 20, 40]] });
    expect(result.values).toEqual([100, 150, 300]);
    expect(result.education?.contributed).toBe(100);
    expect(result.exposure[0]).toBe(0.5);
  });
  it("deducts annual fund costs only from invested sleeves", () => {
    const result = simulateBacktest({ ...spec, annualFundCostBps: 100 }, flat);
    expect(result.values.at(-1)).toBeCloseTo(99, 10);
    expect(result.education?.fundCosts).toBeCloseTo(1, 10);
    const cash = simulateBacktest({ ...spec, holdings: [{ instrumentId: "A", weightBps: 5_000 }], cashWeightBps: 5_000, annualFundCostBps: 100 }, flat);
    expect(cash.values.at(-1)).toBeCloseTo(99.5, 10);
  });
  it("limits withdrawals to available capital, reports shortfall and never shows depletion as a loss", () => {
    const result = simulateBacktest({ ...spec, withdrawals: { monthlyAmount: 30 } }, flat);
    expect(result.values).toEqual([100, 70, 40, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(result.education?.withdrawn).toBe(100);
    expect(result.education?.unfundedWithdrawals).toBe(260);
    expect(result.metrics.maxDrawdown).toBe(0);
    expect(result.metrics.totalReturn).toBe(0);
    expect(result.education?.gain).toBe(0);
  });
  it("defines annual withdrawals as a fixed share of the initial budget, divided by twelve", () => {
    const result = simulateBacktest({ ...spec, withdrawals: { annualRate: 0.12 } }, flat);
    expect(result.education?.withdrawn).toBeCloseTo(12, 10);
    expect(result.values.at(-1)).toBeCloseTo(88, 10);
  });
  it("charges sales and deposit purchases while preserving conservation and nonnegative books", () => {
    const result = simulateBacktest({ ...spec, costs: { rateBps: 25, fixedFee: 0.1 }, contributions: { monthlyAmount: 0.25 }, withdrawals: { monthlyAmount: 5 } }, flat);
    expect(result.trading.trades).toBeGreaterThan(1);
    expect(result.values.every((value) => value >= 0)).toBe(true);
    expect(result.values.at(-1)! + result.education!.withdrawn + result.trading.costs).toBeCloseTo(result.education!.contributed, 9);
    expect(result.trading.costs).toBeCloseTo(result.trading.turnover * 0.0025 + result.trading.trades * 0.1, 9);
  });
  it("invests contributions at target weights without secretly rebalancing existing positions", () => {
    const mix: BacktestSpec = { ...spec, endMonth: "2020-02", holdings: [{ instrumentId: "A", weightBps: 5_000 }], cashWeightBps: 5_000, contributions: { monthlyAmount: 20 } };
    const result = simulateBacktest(mix, { months: monthRange("2019-12", "2020-02"), closes: [[10, 20, 10]] });
    // 50 invested + 50 cash -> 100 + 50 + 20; buy 10 and retain 10 cash -> 55 + 60 + 20.
    expect(result.values).toEqual([100, 170, 135]);
    expect(result.trading.trades).toBe(2);
  });
  it("does not use holdout prices for earlier trend decisions with flows and costs", () => {
    const trend: BacktestSpec = { ...spec, rule: { kind: "trend-filter", smaMonths: 3 }, contributions: { monthlyAmount: 10 }, annualFundCostBps: 25, costs: { rateBps: 10, fixedFee: 0 }, outOfSampleStartMonth: "2020-07" };
    const months = monthRange("2019-10", "2020-12");
    const closes = months.map((_, index) => 20 + index + 4 * Math.sin(index));
    const first = simulateBacktest(trend, { months, closes: [closes] });
    const altered = simulateBacktest(trend, { months, closes: [closes.map((close, index) => months[index] >= "2020-07" ? close * 2 : close)] });
    expect(splitSimulation(first, "2020-07").inSample).toEqual(splitSimulation(altered, "2020-07").inSample);
    expect(first.exposure.slice(0, 7)).toEqual(altered.exposure.slice(0, 7));
    expect(first.values.at(-1)).not.toEqual(altered.values.at(-1));
  });
  it("validates incompatible settings and a split with too few observations", () => {
    for (const setting of [{ withdrawals: { monthlyAmount: 10, annualRate: 0.04 } }, { annualFundCostBps: -1 }, { annualFundCostBps: 10_000 }, { lumpSumSplit: { months: 13 } }, { outOfSampleStartMonth: "2020-01" }, { outOfSampleStartMonth: "2020-12" }]) {
      expect(backtestSpecSchema.safeParse({ ...spec, ...setting }).success).toBe(false);
    }
  });
});

describe("return conventions and holdout", () => {
  it("finds a known monthly IRR and refuses ambiguous sign changes", () => {
    expect(moneyWeightedReturn(100, [100, 100], 700)).toBeCloseTo(2 ** 12 - 1, 7);
    expect(moneyWeightedReturn(100, [-230, 132], 0)).toBeNull();
    expect(moneyWeightedReturn(100, Array(12).fill(0), 0)).toBe(-1);
    expect(moneyWeightedReturn(0, Array(12).fill(0), 0)).toBeNull();
  });
  it("splits a continuous run without restarting capital, flows or the trend's lookback", () => {
    const result = simulateBacktest({ ...spec, contributions: { monthlyAmount: 10 } }, flat);
    const windows = splitSimulation(result, "2020-07");
    expect(windows.inSample.months).toBe(6);
    expect(windows.outOfSample.months).toBe(6);
    expect(windows.outOfSample.startValue).toBe(160);
    expect(windows.outOfSample.metrics.finalValue).toBe(220);
    expect(windows.outOfSample.mwr).toBeCloseTo(0, 10);
    expect(windows.inSample.endMonth).toBe("2020-06");
    expect(windows.outOfSample.startMonth).toBe("2020-07");
  });
});
