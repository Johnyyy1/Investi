import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BacktestChart } from "./backtest-chart";

describe("Backtest chart data boundary", () => {
  it("has an explicit unavailable state for absent or nonfinite observations", () => {
    for (const data of [[], [{ label: "2020-01", value: NaN, benchmark: 100 }]]) {
      const html = renderToStaticMarkup(createElement(BacktestChart, { data }));
      expect(html).toContain("Pro toto období nejsou dostupná úplná data");
      expect(html).not.toContain("<table");
    }
  });
  it("labels sample data and preserves zeros in the complete accessible table", () => {
    const html = renderToStaticMarkup(createElement(BacktestChart, { strategyLabel: "Dluhopisový vzorek", initial: 100, data: [{ label: "2019-12", value: 100, benchmark: 100 }, { label: "2020-01", value: 0, benchmark: 120 }] }));
    expect(html).toContain("Ukázková data");
    expect(html).toContain("Dluhopisový vzorek");
    expect(html).toContain('scope="row"');
    expect(html).toContain("2020-01");
    expect(html).toContain("0 Kč");
    expect(html).toContain("bez FX");
  });
});
