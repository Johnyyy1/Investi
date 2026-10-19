import { describe, expect, it } from "vitest";
import { addMonths, backtestComparisonSchema, backtestSpecSchema, buyAndHoldFor, lookbackMonths, monthRange, type BacktestSpec } from "./spec";

const valid = {
  holdings: [{ instrumentId: "A", weightBps: 6_000 }], cashWeightBps: 4_000, rule: { kind: "fixed-weights", rebalance: "annual" },
  startMonth: "2020-01", endMonth: "2020-12", initialAmount: 1000, frequency: "monthly", currency: "USD", adjustment: "split-adjusted",
  costs: { rateBps: 10, fixedFee: 1.5 },
};

describe("backtest specification", () => {
  it("accepts a mix whose weights sum exactly to 100 %", () => {
    expect(backtestSpecSchema.parse(valid)).toEqual(valid);
    expect(backtestSpecSchema.safeParse({ ...valid, holdings: [{ instrumentId: "A", weightBps: 5_000 }, { instrumentId: "B", weightBps: 5_000 }], cashWeightBps: 0 }).success).toBe(true);
  });
  it.each([
    ["weights below 100 %", { cashWeightBps: 3_999 }],
    ["weights above 100 %", { cashWeightBps: 4_001 }],
    ["fractional basis points", { holdings: [{ instrumentId: "A", weightBps: 6_000.5 }], cashWeightBps: 3_999.5 }],
    ["a duplicated instrument", { holdings: [{ instrumentId: "A", weightBps: 3_000 }, { instrumentId: "A", weightBps: 3_000 }] }],
    ["no instrument", { holdings: [], cashWeightBps: 10_000 }],
    ["a reversed period", { startMonth: "2021-01", endMonth: "2020-12" }],
    ["a malformed month", { startMonth: "2020-13" }],
    ["a zero amount", { initialAmount: 0 }],
    ["a non-finite amount", { initialAmount: Number.POSITIVE_INFINITY }],
    ["an unknown rebalancing rule", { rule: { kind: "fixed-weights", rebalance: "weekly" } }],
    ["total-return data", { adjustment: "total-return" }],
    ["a malformed currency", { currency: "usd" }],
    ["a trend filter on a mix", { rule: { kind: "trend-filter", smaMonths: 10 } }],
    ["a cost rate above 2 %", { costs: { rateBps: 201, fixedFee: 0 } }],
    ["fractional basis points of cost", { costs: { rateBps: 12.5, fixedFee: 0 } }],
    ["a negative cost rate", { costs: { rateBps: -1, fixedFee: 0 } }],
    ["a negative flat fee", { costs: { rateBps: 10, fixedFee: -0.01 } }],
    ["a flat fee above 1 000", { costs: { rateBps: 10, fixedFee: 1_000.01 } }],
    ["no cost model", { costs: undefined }],
    ["a one-month moving average", { holdings: [{ instrumentId: "A", weightBps: 10_000 }], cashWeightBps: 0, rule: { kind: "trend-filter", smaMonths: 1 } }],
  ])("rejects %s", (_, change) => expect(backtestSpecSchema.safeParse({ ...valid, ...change }).success).toBe(false));
  it("accepts a trend filter that switches one instrument between 100 % and cash", () => {
    expect(backtestSpecSchema.safeParse({ ...valid, holdings: [{ instrumentId: "A", weightBps: 10_000 }], cashWeightBps: 0, rule: { kind: "trend-filter", smaMonths: 10 } }).success).toBe(true);
  });
});

describe("strategy and buy-and-hold benchmark", () => {
  const strategy = valid as BacktestSpec;
  const benchmark = buyAndHoldFor(strategy, "B");

  it("inherits the strategy's period, amount, currency and return semantics", () => {
    expect(benchmark).toEqual({ kind: "buy-and-hold", instrumentId: "B", startMonth: "2020-01", endMonth: "2020-12", initialAmount: 1000, frequency: "monthly", currency: "USD", adjustment: "split-adjusted", costs: { rateBps: 10, fixedFee: 1.5 } });
    expect(backtestComparisonSchema.safeParse({ strategy, benchmark }).success).toBe(true);
    expect(backtestComparisonSchema.safeParse({ strategy, benchmark: buyAndHoldFor(strategy, "A") }).success).toBe(true);
  });
  it.each([
    ["total-return semantics", { adjustment: "total-return" }, "adjustment"],
    ["raw prices", { adjustment: "raw" }, "adjustment"],
    ["another currency", { currency: "EUR" }, "currency"],
    ["another start month", { startMonth: "2020-02" }, "startMonth"],
    ["another end month", { endMonth: "2020-11" }, "startMonth"],
    ["another amount", { initialAmount: 1000.01 }, "initialAmount"],
    ["another cost rate", { costs: { rateBps: 25, fixedFee: 1.5 } }, "costs"],
    ["no flat fee", { costs: { rateBps: 10, fixedFee: 0 } }, "costs"],
  ])("rejects a benchmark with %s", (_, change, field) => {
    const result = backtestComparisonSchema.safeParse({ strategy, benchmark: { ...benchmark, ...change } });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(`benchmark.${field}`);
  });
});

describe("calendar months", () => {
  it("steps across year boundaries in both directions", () => {
    expect(addMonths("2020-12", 1)).toBe("2021-01");
    expect(addMonths("2020-01", -1)).toBe("2019-12");
    expect(addMonths("2020-03", -10)).toBe("2019-05");
    expect(monthRange("2019-11", "2020-02")).toEqual(["2019-11", "2019-12", "2020-01", "2020-02"]);
    expect(monthRange("2020-02", "2020-01")).toEqual([]);
  });
  it("needs one earlier close for a mix and the whole average window for a trend filter", () => {
    expect(lookbackMonths({ kind: "fixed-weights", rebalance: "none" })).toBe(1);
    expect(lookbackMonths({ kind: "trend-filter", smaMonths: 10 })).toBe(10);
  });
});
