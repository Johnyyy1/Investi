import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EquityKeyMetrics } from "./equity-key-metrics";
import { createDeterministicMarketDataService } from "@/features/market-data/deterministic/service";

describe("equity key metrics fallback", () => {
  it("shows a neutral failure within the section without inventing figures", () => {
    const html = renderToStaticMarkup(createElement(EquityKeyMetrics, { snapshot: null, message: "Ukazatele společnosti nejsou nyní dostupné.", quoteCurrency: "USD" }));
    expect(html).toContain("Klíčové ukazatele");
    expect(html).toContain("Ukazatele společnosti nejsou nyní dostupné.");
    expect(html).not.toContain("Tržní kapitalizace");
    expect(html).not.toContain("Sample data");
  });
  it("distinguishes a non-meaningful P/E from missing metrics and true zero", async () => {
    const sample = await createDeterministicMarketDataService().getEquityFundamentals("US-XNAS:NVDA");
    const snapshot = { ...sample, valuation: { ...sample.valuation, peTtm: null, peTtmStatus: "not-meaningful" as const }, financialHealth: { ...sample.financialHealth, debtToEquityTtm: 0 } };
    const html = renderToStaticMarkup(createElement(EquityKeyMetrics, { snapshot, message: null, quoteCurrency: "USD" }));
    expect(html).toContain("N/M");
    expect(html).toContain("0,00×");
    expect(html).toContain("—");
    expect(html).not.toContain("Sample data");
  });
  it("colors only interpreted values and includes a text explanation of signals", async () => {
    const snapshot = await createDeterministicMarketDataService().getEquityFundamentals("US-XNAS:AAPL");
    const html = renderToStaticMarkup(createElement(EquityKeyMetrics, { snapshot, message: null, quoteCurrency: "USD" }));
    expect(html).toMatch(/data-metric="pe" data-signal="neutral"[^>]*text-foreground/);
    expect(html).toMatch(/data-metric="market-cap" data-signal="neutral"[^>]*text-foreground/);
    expect(html).toMatch(/data-metric="operating-margin" data-signal="positive"[^>]*font-extrabold text-success-strong/);
    expect(html).toMatch(/data-metric="net-debt-ebitda" data-signal="positive"[^>]*font-extrabold text-success-strong/);
    expect(html).not.toContain("border-dotted");
    expect(html).toMatch(/Orientační srovnání: příznivé/);
    expect(html).toContain("Nejde o investiční hodnocení");
    expect(html).toContain("Proč příznivé:</span> Nad orientační hranicí 10 %.");
    expect(html).toContain("Jak to číst:</span> Mezi orientačními hranicemi 15× a 30×");
    expect(html).toMatch(/data-metric="pb" data-signal="caution"[^>]*><button[^>]*aria-controls="metric-help-pb"[^>]*>(<svg[^>]*lucide-triangle-alert)/);
    expect(html).toMatch(/data-metric="gross-margin" data-signal="positive"[^>]*><button[^>]*aria-controls="metric-help-gross-margin"[^>]*>(<svg[^>]*lucide-circle-check)/);
    expect(html).toContain("Klikni na označenou hodnotu nebo otazník u ukazatele.");
  });
  it("colors a negative net-debt ratio only when net cash is confirmed", async () => {
    const sample = await createDeterministicMarketDataService().getEquityFundamentals("US-XNAS:MSFT");
    const confirmed = renderToStaticMarkup(createElement(EquityKeyMetrics, { snapshot: sample, message: null, quoteCurrency: "USD" }));
    expect(confirmed).toMatch(/data-metric="net-debt-ebitda" data-signal="positive"/);
    const unconfirmed = renderToStaticMarkup(createElement(EquityKeyMetrics, { snapshot: { ...sample, financialHealth: { ...sample.financialHealth, netDebtToEbitdaIsNetCash: false } }, message: null, quoteCurrency: "USD" }));
    expect(unconfirmed).toMatch(/data-metric="net-debt-ebitda" data-signal="neutral"/);
  });
  it("emphasizes caution values without coloring their labels", async () => {
    const sample = await createDeterministicMarketDataService().getEquityFundamentals("US-XNAS:AAPL");
    const caution = renderToStaticMarkup(createElement(EquityKeyMetrics, { snapshot: { ...sample, profitability: { ...sample.profitability, operatingMarginTtm: -0.05 } }, message: null, quoteCurrency: "USD" }));
    expect(caution).toMatch(/data-metric="operating-margin" data-signal="caution"[^>]*font-extrabold text-danger-strong/);
    expect(caution).not.toMatch(/<button[^>]*text-danger-strong/);
    expect(caution).toContain("Proč pozor:</span> Záporná provozní marže");
  });
});
