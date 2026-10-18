import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/features/portfolio/actions", () => ({ searchPortfolioInstrumentsAction: vi.fn() }));

import type { ComparedInstrument, InstrumentComparison } from "@/features/instruments/comparison-loader";
import { comparePriceHistories } from "@/features/instruments/comparison";
import type { MarketDataProvenance } from "@/features/market-data/contracts";
import { InstrumentComparisonView } from "./instrument-comparison";

const provenance: MarketDataProvenance = { provider: "investi-deterministic", dataset: "sample", dataKind: "synthetic", isDeterministic: true, isDemo: false, observedAt: "2026-01-16T20:45:00.000Z", retrievedAt: "2026-01-16T20:50:00.000Z", adjustmentMode: "split-adjusted", completeness: "complete" };

function side(symbol: string, exchangeMic: string, overrides: Partial<ComparedInstrument> = {}): ComparedInstrument {
  return {
    instrumentId: `US-${exchangeMic}:${symbol}`,
    instrument: { instrumentId: `US-${exchangeMic}:${symbol}`, symbol, name: `${symbol} Inc.`, assetType: "equity", exchangeMic, quoteCurrency: "USD" },
    message: null, historyAvailable: true, historyMessage: null, historyPartial: false, provenance, ...overrides,
  };
}

const dates = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-12"];
const first = dates.map((date, index) => ({ date, close: 100 + index * 2 }));
const second = dates.map((date, index) => ({ date, close: 50 - index }));

function render(data: Partial<InstrumentComparison> = {}) {
  const comparison = comparePriceHistories(first, second, { startDate: "2025-01-12", endDate: "2026-01-12", isMax: false });
  return renderToStaticMarkup(createElement(InstrumentComparisonView, { sample: true, data: {
    range: "1Y", startDate: "2025-01-12", endDate: "2026-01-12", instrumentMissing: false,
    instruments: [side("AAPL", "XNAS"), side("SAP", "XETR")], comparison, correlationMessage: "Pro korelaci je potřeba alespoň 20 společných denních výnosů. Zkus delší období.",
    ...data,
  } }));
}

describe("instrument comparison view", () => {
  it("compares both instruments with labelled series, provenance and the price-only scope", () => {
    const html = render();
    expect(html).toContain("AAPL a SAP");
    expect(html).toContain("Ukázková data");
    expect(html).toContain("A · AAPL plná čára");
    expect(html).toContain("B · SAP přerušovaná čára");
    expect(html).toContain("jen cena, bez dividend");
    expect(html).toContain("+10,0 %");
    expect(html).toContain("−10,0 %");
    expect(html).toContain("Lekce: Cenový a celkový výnos");
    expect(html).toContain('aria-label="Období srovnání"');
    expect(html).toContain('href="/lab/compare?a=US-XNAS%3AAAPL&amp;b=US-XETR%3ASAP&amp;range=5Y"');
  });

  it("renders the metrics both as a wide table and as a structured mobile list", () => {
    const html = render();
    expect(html).toMatch(/<table class="[^"]*hidden[^"]*md:table/);
    expect(html).toMatch(/<ul class="[^"]*md:hidden/);
    expect(html.match(/Co to znamená\?/g)?.length).toBe(4 * 2 + 1);
  });

  it("states a shorter common period and why the correlation is unavailable, never a zero", () => {
    const html = render();
    expect(html).toContain("Obě řady mají společná data jen od 5. 1. 2026 do 12. 1. 2026");
    expect(html).toContain("Nedostupné.</span> Pro korelaci je potřeba alespoň 20");
    expect(html).toContain("5 společných denních výnosů");
    expect(html).toContain("Burzy XNAS a XETR zavírají v různý čas");
    expect(html).not.toMatch(/>0,00</);
  });

  it("marks the side without history as unavailable and shows no chart", () => {
    const html = render({ comparison: null, instruments: [side("AAPL", "XNAS"), side("SAP", "XETR", { historyAvailable: false, provenance: null, historyMessage: "Cenová historie pro toto období není dostupná." })], correlationMessage: "Cenová historie jednoho z instrumentů pro toto období není dostupná." });
    expect(html).toContain("Graf nelze zobrazit. SAP: Cenová historie pro toto období není dostupná.");
    expect(html).not.toContain('role="img"');
    expect(html).toContain("Chybí cenová historie tohoto instrumentu.");
    expect(html).not.toContain("+0,0 %");
  });
});
