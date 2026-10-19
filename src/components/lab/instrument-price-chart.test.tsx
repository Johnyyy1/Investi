import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChartRange } from "@/features/instruments/history";
import type { ChartType } from "@/features/instruments/price-chart-presentation";
import type { PriceMetrics } from "@/features/instruments/price-metrics";
import { InstrumentPriceChart } from "./instrument-price-chart";

type Point = { date: string; close: number; open?: number; high?: number; low?: number };
const ohlc: Point[] = [
  { date: "2026-01-05", open: 100, high: 104, low: 99, close: 100 },
  { date: "2026-01-06", open: 100, high: 106, low: 98, close: 105 },
  { date: "2026-01-07", open: 105, high: 105.5, low: 95, close: 96 },
];

function render(points: Point[], options: { chart?: ChartType; metrics?: PriceMetrics | null; range?: ChartRange; coverageStart?: string; partial?: boolean } = {}) {
  return renderToStaticMarkup(createElement(InstrumentPriceChart, { range: options.range ?? "1Y", onRangeChange: () => {}, points, currency: "USD", message: null, partial: options.partial ?? false, metrics: options.metrics ?? null, initialChartType: options.chart, bounds: { startDate: "2025-01-07", endDate: "2026-01-07" }, coverageStart: options.coverageStart ?? null }));
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/ /g, " ").replace(/\s+/g, " ");

describe("instrument price chart", () => {
  it("shows a line chart and an enabled candle control when OHLC is valid", () => {
    const html = render(ohlc.slice(0, 2));
    expect(html).toContain('data-chart-tone="positive"');
    expect(html).toContain('data-chart-type="line"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Křivka/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Svíčky/);
    expect(html).toContain("1Y, denní graf závěrečných cen očištěných o splity");
  });

  it("marks a negative period and explains why candles are unavailable for close-only data", () => {
    const html = render([{ date: "2026-01-05", close: 105 }, { date: "2026-01-06", close: 100 }], { chart: "candles" });
    expect(html).toContain('data-chart-tone="negative"');
    expect(html).toMatch(/disabled=""[^>]*>Svíčky/);
    expect(html).toContain('data-chart-type="line"');
    expect(text(html)).toContain("Svíčky nejsou k dispozici");
  });

  it("starts in candle mode from the URL", () => {
    const html = render(ohlc, { chart: "candles" });
    expect(html).toContain('data-chart-type="candles"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Svíčky/);
    expect(html).toContain("1Y, denní, svíčkový graf cen očištěných o splity v USD. 3 svíček pokrývá pozorování od 5. 1. 2026 do 7. 1. 2026");
  });

  it("offers every timeframe as an in-page toggle, not a navigation", () => {
    const html = render(ohlc, { range: "6M" });
    expect(html).not.toContain("href=\"/lab/instruments");
    const group = html.match(/<div role="group" aria-label="Období vývoje ceny".*?<\/div>/s)![0];
    expect(text(group).trim().split(" ")).toEqual(["1M", "3M", "6M", "Letos", "1R", "5L", "Max"]);
    expect(group.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(group).toMatch(/aria-pressed="true"[^>]*>6M</);
  });

  it("renders the latest bar in the readout before any hover, with its change against the previous close", () => {
    const readout = text(render(ohlc, { chart: "candles" }).match(/data-testid="chart-readout".*?<\/dl>/s)![0]);
    expect(readout).toContain("96,00 USD");
    expect(readout).toContain("−9,00 USD (−8,57 %)");
    expect(readout).toContain("7. 1. 2026 · poslední svíčka");
    expect(readout).toMatch(/Otevření 105,00 Maximum 105,50 Minimum 95,00/);
  });

  it("uses OHLC extremes in candle mode and closing extremes in line mode", () => {
    const candles = text(render(ohlc, { chart: "candles" }));
    expect(candles).toMatch(/Minimum období · 7\. 1\. 2026 95,00 USD Maximum období · 6\. 1\. 2026 106,00 USD/);
    expect(candles).toContain("z denních minim a maxim");
    const line = text(render(ohlc));
    expect(line).toMatch(/Minimum období · 7\. 1\. 2026 96,00 USD Maximum období · 6\. 1\. 2026 105,00 USD/);
    expect(line).toContain("Minimum a maximum v křivce jsou zavírací ceny");
  });

  it("describes the same drawdown dates the chart band uses", () => {
    const metrics: PriceMetrics = { startDate: "2026-01-05", endDate: "2026-01-07", observationCount: 3, spanDays: 2, periodReturn: -0.04, annualisedReturn: null, annualisedVolatility: null, maxDrawdown: { depth: 96 / 105 - 1, peakDate: "2026-01-06", peakClose: 105, troughDate: "2026-01-07", troughClose: 96, recoveryDate: null } };
    const description = text(render(ohlc, { metrics }));
    expect(description).toContain("z vrcholu 6. 1. 2026 (105,00 USD) na dno 7. 1. 2026 (96,00 USD), −8,6 %");
    expect(description).toContain("Do konce období se na vrchol nevrátila.");
  });

  it("says when the history starts inside the selected timeframe", () => {
    expect(text(render(ohlc, { range: "5Y", coverageStart: "2026-01-05" }))).toContain("Cenová historie začíná 5. 1. 2026, takže graf ukazuje jen tuto část období.");
    expect(text(render(ohlc, { range: "1Y" }))).not.toContain("Cenová historie začíná");
    expect(text(render(ohlc, { range: "Max", partial: true }))).toContain("Pouze dostupná pozorování");
    expect(text(render(ohlc.slice(0, 1)))).toContain("Je dostupná jen jedna závěrečná cena");
  });

  it("does not render the data table rows until it is opened", () => {
    const html = render(ohlc);
    expect(html).toContain("Zobrazit cenová data");
    expect(html).not.toContain("<table");
  });

  it("preserves the unavailable history state", () => {
    const html = render([]);
    expect(html).toContain("Vývoj ceny pro toto období není dostupný.");
    expect(html).toMatch(/disabled=""[^>]*>Svíčky/);
    expect(html).not.toContain("Svíčky nejsou k dispozici");
  });
});
