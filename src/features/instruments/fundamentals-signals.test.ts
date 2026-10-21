import { describe, expect, it } from "vitest";
import { equityMetricSignal, type EquityMetricId, type MetricSignal } from "./fundamentals-signals";

function expectSignals(id: EquityMetricId, cases: [number, MetricSignal][]) {
  for (const [value, expected] of cases) expect(equityMetricSignal(id, value).signal, `${id} at ${value}`).toBe(expected);
}

describe("equity fundamentals educational signals", () => {
  it("keeps scale neutral and reads valuation multiples as cheap, fair or rich at exact boundaries", () => {
    expectSignals("pe", [[-3, "caution"], [9, "positive"], [15, "positive"], [15.01, "neutral"], [30, "neutral"], [30.01, "caution"], [45, "caution"]]);
    expectSignals("ps", [[0, "caution"], [0.4, "positive"], [2, "positive"], [2.01, "neutral"], [10, "neutral"], [10.01, "caution"]]);
    expectSignals("pb", [[-2, "caution"], [0.9, "positive"], [1.5, "positive"], [1.51, "neutral"], [10, "neutral"], [10.01, "caution"]]);
    expectSignals("ev-ebitda", [[-1, "caution"], [4, "positive"], [10, "positive"], [10.01, "neutral"], [20, "neutral"], [20.01, "caution"], [40, "caution"]]);
    expectSignals("p-fcf", [[-8, "caution"], [12, "positive"], [15, "positive"], [15.01, "neutral"], [30, "neutral"], [30.01, "caution"]]);
    for (const id of ["market-cap", "revenue"] as const) expectSignals(id, [[0, "neutral"], [1_000_000_000, "neutral"]]);
    expectSignals("gross-margin", [[-0.01, "caution"], [0, "neutral"], [0.3999, "neutral"], [0.4, "positive"], [0.8, "positive"]]);
  });

  it("explains why every interpreted value earned its signal", () => {
    expect(equityMetricSignal("pe", 39.2).context).toMatch(/víc než 30 jednotek ceny/);
    expect(equityMetricSignal("pe", 22).context).toMatch(/15× a 30×/);
    expect(equityMetricSignal("gross-margin", 0.487).context).toMatch(/cenovou sílu/);
    expect(equityMetricSignal("roe", 1.372).context).toMatch(/malým vlastním kapitálem/);
    expect(equityMetricSignal("roe", 0.2).context).not.toMatch(/malým vlastním kapitálem/);
    expect(equityMetricSignal("debt-equity", 0.78).context).toMatch(/střední zadlužení/);
    expect(equityMetricSignal("current-ratio", 1).context).toMatch(/rezerva je menší/);
    expect(equityMetricSignal("market-cap", 5e12).context).toMatch(/není dobrá ani špatná/);
  });

  it("applies broad profitability thresholds at exact boundaries", () => {
    for (const id of ["operating-margin", "roe"] as const) expectSignals(id, [[-0.01, "caution"], [0, "neutral"], [0.08, "neutral"], [0.1499, "neutral"], [0.15, "positive"], [0.2, "positive"]]);
    for (const id of ["net-margin", "roic"] as const) expectSignals(id, [[-0.01, "caution"], [0, "neutral"], [0.0999, "neutral"], [0.10, "positive"], [0.15, "positive"]]);
    expect(equityMetricSignal("roic", 0.348).context).toMatch(/orientační hranicí 10 %/);
  });

  it("treats financial health as ranges, including negative debt and high liquidity", () => {
    expectSignals("debt-equity", [[-1, "neutral"], [0, "positive"], [0.3, "positive"], [0.5, "positive"], [0.5001, "neutral"], [1.2, "neutral"], [2, "neutral"], [2.0001, "caution"], [3, "caution"]]);
    expectSignals("current-ratio", [[0.8, "caution"], [0.9999, "caution"], [1, "neutral"], [1.2, "neutral"], [1.4999, "neutral"], [1.5, "positive"], [2, "positive"], [3, "positive"], [3.0001, "neutral"], [5, "neutral"]]);
    expectSignals("net-debt-ebitda", [[-0.4, "neutral"], [0, "positive"], [1, "positive"], [2, "positive"], [2.0001, "neutral"], [3, "neutral"], [4, "neutral"], [4.0001, "caution"], [5, "caution"]]);
    expect(equityMetricSignal("net-debt-ebitda", -0.4, undefined, true).signal).toBe("positive");
    expect(equityMetricSignal("current-ratio", 0.7).context).toMatch(/krátkodobé závazky převyšují oběžná aktiva/);
  });

  it("flags negative fiscal amounts without coloring positive size or earnings", () => {
    expectSignals("revenue", [[-1, "caution"], [0, "neutral"], [100, "neutral"]]);
    for (const id of ["net-income", "fcf", "eps"] as const) expectSignals(id, [[-1, "caution"], [0, "neutral"], [100, "neutral"]]);
  });

  it("separates missing values and a meaningless P/E from caution", () => {
    expect(equityMetricSignal("roic", null).signal).toBe("unavailable");
    expect(equityMetricSignal("roic", Number.NaN).signal).toBe("unavailable");
    expect(equityMetricSignal("pe", null, "not-meaningful").signal).toBe("not-meaningful");
  });
});
