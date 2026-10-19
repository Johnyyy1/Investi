import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChartType } from "@/features/instruments/price-chart-presentation";
import type { PriceMetrics } from "@/features/instruments/price-metrics";
import { InstrumentPriceChart } from "./instrument-price-chart";

type Point = { date: string; close: number; open?: number; high?: number; low?: number };
const ohlc: Point[] = [
  { date: "2026-01-05", open: 100, high: 104, low: 99, close: 100 },
  { date: "2026-01-06", open: 100, high: 106, low: 98, close: 105 },
  { date: "2026-01-07", open: 105, high: 105.5, low: 95, close: 96 },
];

function render(points: Point[], options: { chart?: ChartType; metrics?: PriceMetrics | null } = {}) {
  return renderToStaticMarkup(createElement(InstrumentPriceChart, { instrumentId: "US-XNAS:AAPL", range: "1Y", points, currency: "USD", message: null, partial: false, metrics: options.metrics ?? null, initialChartType: options.chart, historyWindow: { startDate: "2025-01-07", endDate: "2026-01-07" } }));
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

  it("starts in candle mode from the URL and keeps that mode in the range links", () => {
    const html = render(ohlc, { chart: "candles" });
    expect(html).toContain('data-chart-type="candles"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Svíčky/);
    expect(html).toContain("1Y, denní, svíčkový graf cen očištěných o splity v USD. 3 svíček pokrývá pozorování od 5. 1. 2026 do 7. 1. 2026");
    expect(html).toContain('href="/lab/instruments/US-XNAS%3AAAPL?range=5Y&amp;chart=candles"');
    expect(html).not.toContain("?range=5Y\"");
  });

  it("uses plain range links in line mode", () => {
    const html = render(ohlc);
    expect(html).toContain('href="/lab/instruments/US-XNAS%3AAAPL?range=5Y"');
    expect(html).not.toContain("chart=candles");
  });

  it("renders the latest bar in the readout before any hover, with its change against the previous close", () => {
    const readout = text(render(ohlc, { chart: "candles" }).match(/data-testid="chart-readout".*?<\/dl>/s)![0]);
    expect(readout).toContain("96,00 USD");
    expect(readout).toContain("−9,00 USD (−8,57 %)");
    expect(readout).toContain("7. 1. 2026 · poslední svíčka");
    expect(readout).toMatch(/Otevření 105,00 Maximum 105,50 Minimum 95,00/);
  });

  it("uses OHLC extremes in candle mode and closing extremes in line mode", () => {
    expect(text(render(ohlc, { chart: "candles" }))).toMatch(/Minimum období 95,00 USD Maximum období 106,00 USD/);
    expect(text(render(ohlc))).toMatch(/Minimum období 96,00 USD Maximum období 105,00 USD/);
  });

  it("describes the same drawdown dates the chart band uses", () => {
    const metrics: PriceMetrics = { startDate: "2026-01-05", endDate: "2026-01-07", observationCount: 3, spanDays: 2, periodReturn: -0.04, annualisedReturn: null, annualisedVolatility: null, maxDrawdown: { depth: 96 / 105 - 1, peakDate: "2026-01-06", troughDate: "2026-01-07", recoveryDate: null } };
    const description = text(render(ohlc, { metrics }));
    expect(description).toContain("z vrcholu 6. 1. 2026 na dno 7. 1. 2026, −8,6 %");
    expect(description).toContain("Do konce období se na vrchol nevrátila.");
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
