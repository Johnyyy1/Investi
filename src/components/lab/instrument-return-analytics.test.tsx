import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PriceMetrics } from "@/features/instruments/price-metrics";
import { InstrumentReturnAnalytics } from "./instrument-return-analytics";

const metrics: PriceMetrics = {
  startDate: "2024-10-14",
  endDate: "2026-10-13",
  observationCount: 300,
  spanDays: 400,
  periodReturn: 0.862,
  annualisedReturn: 0.132,
  maxDrawdown: { depth: -0.334, peakDate: "2024-12-26", peakClose: 150, troughDate: "2025-04-08", troughClose: 99.9, recoveryDate: null },
  annualisedVolatility: 0.28,
};

function render(value: typeof metrics | null) {
  return renderToStaticMarkup(createElement(InstrumentReturnAnalytics, { metrics: value, currency: "USD" }));
}

describe("instrument return analytics", () => {
  it("shows price-only metrics with the scope stated and the drawdown dates", () => {
    const html = render(metrics);
    expect(html).toContain("bez dividend");
    expect(html).toContain("14. 10. 2024 – 13. 10. 2026");
    expect(html).toContain("+86,2 %");
    expect(html).toContain("+13,2 %");
    expect(html).toContain("−33,4 %");
    expect(html).toContain("28 %");
    expect(html).toContain("Vrchol v tomto období zatím nebyl znovu dosažen.");
  });
  it("marks metrics the data cannot support as unavailable instead of zero", () => {
    const html = render({ ...metrics, annualisedReturn: null, annualisedVolatility: null, maxDrawdown: null });
    expect(html).toContain("Pro období kratší než jeden rok se výnos nepřepočítává na rok.");
    expect(html).toContain("Na výpočet je potřeba aspoň dvacet po sobě jdoucích denních výnosů.");
    expect(html).toContain("V tomto období cena neklesla pod předchozí nejvyšší zavírací cenu.");
    expect(html).not.toContain("+0,0 %");
  });
  it("anchors each metric and shows its formula and lesson from the glossary", () => {
    const html = renderToStaticMarkup(createElement(InstrumentReturnAnalytics, { metrics, currency: "USD", formulas: { volatility: createElement("span", { "data-formula": "volatility" }) } }));
    for (const id of ["simple-return", "annualised-return", "max-drawdown", "volatility"]) expect(html).toContain(`id="metric-${id}"`);
    expect(html).toContain("data-formula=\"volatility\"");
    expect(html).toContain("href=\"/learn/returns/what-is-a-return\"");
    expect(html).toContain("href=\"/learn/volatility/max-drawdown\"");
  });
  it("explains that the metrics are unavailable when there is no price history", () => {
    expect(render(null)).toContain("Chybí dostatek zavíracích cen.");
  });
});
