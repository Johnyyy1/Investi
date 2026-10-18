import { describe, expect, it } from "vitest";
import { addMonths, backtestSpecSchema, lookbackMonths, monthRange } from "./spec";

const valid = {
  holdings: [{ instrumentId: "A", weightBps: 6_000 }], cashWeightBps: 4_000, rule: { kind: "fixed-weights", rebalance: "annual" },
  startMonth: "2020-01", endMonth: "2020-12", initialAmount: 1000, frequency: "monthly", adjustment: "split-adjusted",
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
    ["a trend filter on a mix", { rule: { kind: "trend-filter", smaMonths: 10 } }],
    ["a one-month moving average", { holdings: [{ instrumentId: "A", weightBps: 10_000 }], cashWeightBps: 0, rule: { kind: "trend-filter", smaMonths: 1 } }],
  ])("rejects %s", (_, change) => expect(backtestSpecSchema.safeParse({ ...valid, ...change }).success).toBe(false));
  it("accepts a trend filter that switches one instrument between 100 % and cash", () => {
    expect(backtestSpecSchema.safeParse({ ...valid, holdings: [{ instrumentId: "A", weightBps: 10_000 }], cashWeightBps: 0, rule: { kind: "trend-filter", smaMonths: 10 } }).success).toBe(true);
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
