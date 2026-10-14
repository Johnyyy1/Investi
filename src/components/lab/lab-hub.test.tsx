import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PortfolioView } from "@/features/portfolio/service";
import { HubGuide, LabHub, PortfolioCard } from "./lab-hub";

type Holding = PortfolioView["holdings"][number];

function holding(input: Partial<Holding> & Pick<Holding, "instrumentId" | "symbol" | "assetType">): Holding {
  return {
    name: input.symbol, quoteCurrency: "USD", quantity: "1", averageCostBaseMinor: "0", costBasisMinor: "100000",
    currentPrice: "100", currentPriceCurrency: "USD", marketValueMinor: "100000", allocationBasisPoints: "5000", portfolioWeightBasisPoints: "4000",
    gainLossMinor: "0", gainLossBasisPoints: "0", priceEffectMinor: "0", fxEffectMinor: "0", quoteObservedAt: "2026-10-13T20:00:00.000Z",
    quoteRetrievedAt: "2026-10-13T20:05:00.000Z", quoteUsability: "closed-market-reference", marketSessionState: "closed", usableForExecution: false,
    fxReferenceDate: "2026-10-13", fxRetrievedAt: "2026-10-13T20:05:00.000Z", fxProvider: "cnb", fxRate: "23.10",
    ...input,
  };
}

function view(overrides: Partial<PortfolioView> = {}): PortfolioView {
  return {
    portfolioId: "p1", baseCurrency: "CZK", openedAt: "2026-09-01T08:00:00.000Z", openingCapitalMinor: "1000000", earnedPracticeCapitalMinor: "1000000",
    availableCashMinor: "1000000", holdingsMarketValueMinor: "0", portfolioTotalMinor: "1000000", investmentGainLossMinor: "0", investmentGainLossBasisPoints: "0",
    valuationComplete: true, valuedHoldingsCount: 0, totalHoldingsCount: 0, marketDataMode: "market", realizedGainLossMinor: "0", cashWeightBasisPoints: "10000",
    attribution: null, allocation: null, holdings: [], recentActivity: [],
    ...overrides,
  };
}

const saved = view({
  availableCashMinor: "100000", cashWeightBasisPoints: "990", portfolioTotalMinor: "1014400", investmentGainLossMinor: "14400", investmentGainLossBasisPoints: "144",
  holdings: [
    holding({ instrumentId: "VT", symbol: "VT", assetType: "etf", marketValueMinor: "613000", portfolioWeightBasisPoints: "6040" }),
    holding({ instrumentId: "BND", symbol: "BND", assetType: "bond", marketValueMinor: "301400", portfolioWeightBasisPoints: "2970" }),
  ],
});

/** Czech number formatting uses (narrow) no-break spaces; compare text with plain spaces. */
const plain = (html: string) => html.replace(/[\u00a0\u202f]/g, " ");
const card = (portfolio: PortfolioView | null) => plain(renderToStaticMarkup(createElement(PortfolioCard, { view: portfolio })));
const guide = (portfolio: PortfolioView | null) => renderToStaticMarkup(createElement(HubGuide, { view: portfolio }));

describe("Lab hub", () => {
  it("keeps Backtesting open and shows the Foundations path while Portfolio Lab is locked", () => {
    const html = renderToStaticMarkup(createElement(LabHub, { unlock: { unlocked: false, completedPrerequisiteLessons: 3, requiredPrerequisiteLessons: 7 }, completedLessonIds: new Set(["foundations-why-invest", "foundations-stocks", "foundations-etfs-indexes"]), view: null }));
    expect(html).toContain("Co se stane, ");
    expect(html).toContain("Otevře se po Základech investování");
    expect(html).toContain("3 / 7 lekcí Základů");
    expect(html).toContain('href="/learn/investing-foundations/bonds-and-cash"');
    expect(html).toContain('href="/lab/backtesting"');
    expect(html).toContain("Ukázková data · syntetické měsíční výnosy");
    expect(html).not.toContain("Historická data");
    expect(html.match(/data-done="true"/g)).toHaveLength(3);
    expect(html).toContain("Hotovo");
  });

  it("offers a sample mix sized to the learner's practice capital", () => {
    const html = card(view());
    expect(html).toContain('data-portfolio-state="new"');
    expect(html).toContain("Sestav si portfolio z 10 000 Kč cvičných peněz.");
    expect(html).toContain("ne doporučení");
    expect(guide(view())).toContain("Tady se nic nerozbije");
  });

  it("shows the saved portfolio's real value, change and mix with a quiet closed-market line", () => {
    const html = card(saved);
    expect(html).toContain('data-portfolio-state="closed"');
    expect(html).toContain("Trh zavřený · zavírací ceny");
    expect(html).toContain("10 144 Kč");
    expect(html).toContain("+144 Kč od nákupu · +1,4 %");
    expect(html).toContain("60,4 %");
    expect(html).toContain("2 pozice · kurz ČNB 23,10 Kč/USD");
    expect(html).toContain(">Pokračovat<");
  });

  it("never prices a missing quote and says so instead", () => {
    const missing = view({ ...saved, valuationComplete: false, portfolioTotalMinor: null, cashWeightBasisPoints: null, holdings: [saved.holdings[0], { ...saved.holdings[1], marketValueMinor: null }] });
    const html = card(missing);
    expect(html).toContain("Některé ceny chybí.");
    expect(html).toContain("Oceněno 1 z 2 položek");
    expect(html).not.toContain("10 144 Kč");
    expect(guide(missing)).toContain("20-searching-box");
  });

  it("marks stale prices as the last known value and keeps the card calm when loading failed", () => {
    const stale = card(view({ ...saved, holdings: saved.holdings.map((item) => ({ ...item, quoteUsability: "stale" as const })) }));
    expect(stale).toContain('data-tone="stale"');
    expect(stale).toContain("Poslední známá hodnota");
    expect(stale).toContain("nic se nepřepočítává");
    expect(card(null)).toContain("Nic se neztratilo.");
  });
});
