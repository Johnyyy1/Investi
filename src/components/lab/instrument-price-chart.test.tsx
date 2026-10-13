import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InstrumentPriceChart } from "./instrument-price-chart";

function render(points: { date: string; close: number; open?: number; high?: number; low?: number }[]) {
  return renderToStaticMarkup(createElement(InstrumentPriceChart, { instrumentId: "US-XNAS:AAPL", range: "1Y", points, currency: "USD", message: null, partial: false, metrics: null }));
}

describe("instrument price chart", () => {
  it("shows a positive line chart and an enabled candle control when OHLC is valid", () => {
    const html = render([{ date: "2026-01-05", open: 100, high: 104, low: 99, close: 100 }, { date: "2026-01-06", open: 100, high: 106, low: 98, close: 105 }]);
    expect(html).toContain('data-chart-tone="positive"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Křivka/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Svíčky/);
    expect(html).toContain("1Y, denní graf závěrečných cen očištěných o splity");
  });
  it("marks a negative line and leaves candles unavailable for close-only data", () => {
    const html = render([{ date: "2026-01-05", close: 105 }, { date: "2026-01-06", close: 100 }]);
    expect(html).toContain('data-chart-tone="negative"');
    expect(html).toMatch(/disabled=""[^>]*>Svíčky/);
  });
  it("preserves the unavailable history state", () => {
    const html = render([]);
    expect(html).toContain("Vývoj ceny pro toto období není dostupný.");
    expect(html).toMatch(/disabled=""[^>]*>Svíčky/);
  });
});
