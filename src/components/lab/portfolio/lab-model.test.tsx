import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PortfolioView } from "@/features/portfolio/service";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/features/portfolio/actions", () => ({ resetPortfolioAction: vi.fn() }));

import {
  allocationInput, amountForPercent, contributionRows, contributionStory, dataStatus, driftSentence, groupSummaries, initialMix,
  mixCheck, weightForNewLine, wholePercents, type MixLine,
} from "./lab-model";
import { PortfolioOverview } from "./portfolio-overview";
import PortfolioLabError from "@/app/(app)/lab/portfolio/error";
import PortfolioLabLoading from "@/app/(app)/lab/portfolio/loading";

type HoldingInput = Partial<PortfolioView["holdings"][number]> & Pick<PortfolioView["holdings"][number], "instrumentId" | "symbol" | "assetType">;

function holding(input: HoldingInput): PortfolioView["holdings"][number] {
  return {
    name: input.symbol, quoteCurrency: "USD", quantity: "1", averageCostBaseMinor: "0", costBasisMinor: "100000",
    currentPrice: "100", currentPriceCurrency: "USD", marketValueMinor: "100000", allocationBasisPoints: "5000", portfolioWeightBasisPoints: "4000",
    gainLossMinor: "0", gainLossBasisPoints: "0", priceEffectMinor: "0", fxEffectMinor: "0", quoteObservedAt: "2026-01-16T20:45:00.000Z",
    quoteRetrievedAt: "2026-01-16T20:50:00.000Z", quoteUsability: "fresh", marketSessionState: "open", usableForExecution: true,
    fxReferenceDate: "2026-01-16", fxRetrievedAt: "2026-01-16T20:50:00.000Z", fxProvider: "investi-deterministic", fxRate: "22.75",
    ...input,
  };
}

function view(overrides: Partial<PortfolioView> = {}): PortfolioView {
  return {
    portfolioId: "p1", baseCurrency: "CZK", openedAt: "2026-10-13T08:00:00.000Z", openingCapitalMinor: "500000", earnedPracticeCapitalMinor: "500000",
    availableCashMinor: "500000", holdingsMarketValueMinor: "0", portfolioTotalMinor: "500000", investmentGainLossMinor: "0", investmentGainLossBasisPoints: "0",
    valuationComplete: true, valuedHoldingsCount: 0, totalHoldingsCount: 0, marketDataMode: "sample", realizedGainLossMinor: "0", cashWeightBasisPoints: "10000",
    attribution: { priceEffectMinor: "0", fxEffectMinor: "0", realizedGainLossMinor: "0", currencies: [] }, allocation: null, holdings: [], recentActivity: [],
    ...overrides,
  };
}

const vt = holding({ instrumentId: "US-ARCX:VT", symbol: "VT", assetType: "etf", portfolioWeightBasisPoints: "4040", marketValueMinor: "409500" });
const msft = holding({ instrumentId: "US-XNAS:MSFT", symbol: "MSFT", assetType: "equity", portfolioWeightBasisPoints: "480", marketValueMinor: "49100" });
const bnd = holding({ instrumentId: "US-ARCX:BND", symbol: "BND", assetType: "bond", portfolioWeightBasisPoints: "2970", marketValueMinor: "301200" });
const saved = {
  id: "a1", createdAt: "2026-09-01T10:00:00.000Z", cashWeightBasisPoints: 1_000, appliedValueMinor: "1000000",
  lines: [
    { instrumentId: vt.instrumentId, symbol: "VT", name: "VT", assetType: "etf" as const, quoteCurrency: "USD" as const, weightBasisPoints: 4_000 },
    { instrumentId: msft.instrumentId, symbol: "MSFT", name: "MSFT", assetType: "equity" as const, quoteCurrency: "USD" as const, weightBasisPoints: 500 },
    { instrumentId: bnd.instrumentId, symbol: "BND", name: "BND", assetType: "bond" as const, quoteCurrency: "USD" as const, weightBasisPoints: 4_500 },
  ],
};

describe("market-data status", () => {
  it("takes the worst state across holdings and never calls missing data anything else", () => {
    expect(dataStatus(view())).toEqual({ kind: "none" });
    expect(dataStatus(view({ holdings: [vt, msft] })).kind).toBe("fresh");
    expect(dataStatus(view({ holdings: [vt, { ...msft, quoteUsability: "closed-market-reference" }] })).kind).toBe("closed");
    expect(dataStatus(view({ holdings: [{ ...vt, quoteUsability: "stale" }, { ...msft, quoteUsability: "closed-market-reference" }] })).kind).toBe("stale");
    expect(dataStatus(view({ holdings: [{ ...vt, quoteUsability: "stale" }, { ...msft, marketValueMinor: null }] }))).toEqual({ kind: "unavailable", missing: 1, total: 2 });
  });
});

describe("groups, targets and drift", () => {
  const drifted = view({ holdings: [vt, msft, bnd], allocation: saved, availableCashMinor: "99000", cashWeightBasisPoints: "990", portfolioTotalMinor: "1014400" });

  it("sums real weights and saved targets per instrument type, cash included", () => {
    const rows = groupSummaries(drifted);
    expect(rows.map(({ group, weightBasisPoints, targetBasisPoints }) => [group, weightBasisPoints, targetBasisPoints])).toEqual([
      ["equity", 480, 500], ["etf", 4040, 4000], ["bond", 2970, 4500], ["cash", 990, 1000],
    ]);
  });

  it("explains the largest drift without inventing a cause", () => {
    expect(driftSentence(groupSummaries(drifted))).toBe("Dluhopisy mají menší váhu, než je cíl: 29,7 % místo 45 %. Váhy se mění s cenami i s obchody mimo mix a Lab nic sám nepřerovnává.");
    const close = view({ holdings: [{ ...vt, portfolioWeightBasisPoints: "9000" }], allocation: { ...saved, lines: [{ ...saved.lines[0], weightBasisPoints: 9_000 }] }, cashWeightBasisPoints: "1000" });
    expect(driftSentence(groupSummaries(close))).toBe("Váhy jsou blízko uloženého cíle 90 / 10. Lab nic sám nepřerovnává.");
  });

  it("names new cash and holdings outside the mix as such", () => {
    const cashHeavy = view({
      holdings: [{ ...vt, portfolioWeightBasisPoints: "5600" }, { ...bnd, portfolioWeightBasisPoints: "2900" }],
      allocation: { ...saved, lines: [{ ...saved.lines[0], weightBasisPoints: 6_000 }, { ...saved.lines[2], weightBasisPoints: 3_000 }] },
      cashWeightBasisPoints: "1500",
    });
    expect(driftSentence(groupSummaries(cashHeavy))).toMatch(/^Hotovost je 15,0\s% místo cílových 10\s%\. Nový kapitál z lekcí/);
    const outside = view({ holdings: [{ ...vt, portfolioWeightBasisPoints: "6000" }, { ...msft, portfolioWeightBasisPoints: "3000" }], allocation: { ...saved, cashWeightBasisPoints: 3_000, lines: [{ ...saved.lines[0], weightBasisPoints: 7_000 }] }, cashWeightBasisPoints: "1000" });
    expect(driftSentence(groupSummaries(outside))).toContain("MSFT v mixu není, přesto se počítá do celku.");
  });
});

describe("what moved the result", () => {
  it("adds a calm empty story when nothing has moved", () => {
    const flat = view({ holdings: [vt] });
    expect(contributionStory(flat, contributionRows(flat, groupSummaries(flat))!)?.headline).toBe("Zatím se nic nepohnulo.");
  });

  it("tells the price and FX story with the real amounts", () => {
    const moved = view({
      holdings: [{ ...vt, priceEffectMinor: "26300", fxEffectMinor: "-11900" }],
      investmentGainLossMinor: "14400",
      attribution: { priceEffectMinor: "26300", fxEffectMinor: "-11900", realizedGainLossMinor: "0", currencies: [{ currency: "USD", purchaseFxRate: "23.4", currentFxRate: "23.1", effectMinor: "-11900" }] },
    });
    const rows = contributionRows(moved, groupSummaries(moved))!;
    expect(rows.map(({ id, effectMinor }) => [id, effectMinor])).toEqual([["etf", 26_300n], ["fx", -11_900n], ["cash", 0n]]);
    const story = contributionStory(moved, rows)!;
    expect(story.headline).toBe("Přibylo 144 Kč. Nejvíc pohnuly ETF.");
    expect(story.sentences).toEqual(["ETF (VT) přidaly 263 Kč pohybem cen.", "Dolar oslabil z 23,40 na 23,10 Kč, přepočet ubral 119 Kč."]);
  });

  it("has no story while the valuation is incomplete", () => {
    expect(contributionRows(view({ attribution: null }), [])).toBeNull();
  });
});

describe("builder arithmetic", () => {
  const lines: MixLine[] = [
    { instrumentId: "a", symbol: "A", name: "A", assetType: "etf", quoteCurrency: "USD", percent: 40 },
    { instrumentId: "b", symbol: "B", name: "B", assetType: "bond", quoteCurrency: "CZK", percent: 30 },
  ];

  it("reports the 100 %, 85 % and 110 % states and blocks empty or 0 % lines", () => {
    expect(mixCheck(lines, 30)).toEqual({ check: "complete", sum: 100 });
    expect(mixCheck(lines, 15)).toEqual({ check: "under", sum: 85 });
    expect(mixCheck(lines, 40)).toEqual({ check: "over", sum: 110 });
    expect(mixCheck([], 100).check).toBe("empty");
    expect(mixCheck([...lines, { ...lines[0], instrumentId: "c", percent: 0 }], 30).check).toBe("zero-line");
  });

  it("converts whole percents to basis points and amounts in exact minor units", () => {
    expect(allocationInput(lines, 30)).toEqual({ lines: [{ instrumentId: "a", weightBasisPoints: 4_000 }, { instrumentId: "b", weightBasisPoints: 3_000 }], cashWeightBasisPoints: 3_000 });
    expect(amountForPercent(333_333n, 33)).toBe(109_999n);
    expect(weightForNewLine(lines, 10)).toBe(20);
    expect(weightForNewLine(lines, 40)).toBe(0);
  });

  it("rounds observed weights to whole percents that still sum to 100", () => {
    expect(wholePercents([3_240, 3_860, 2_900])).toEqual([32, 39, 29]);
    expect(wholePercents([3_333, 3_333, 3_334]).reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("starts from the saved mix, else from today's weights, else empty", () => {
    expect(initialMix(view({ allocation: saved, holdings: [vt] }))).toMatchObject({ source: "saved", cashPercent: 10, lines: [{ symbol: "VT", percent: 40 }, { symbol: "MSFT", percent: 5 }, { symbol: "BND", percent: 45 }] });
    expect(initialMix(view({ holdings: [{ ...vt, portfolioWeightBasisPoints: "3240" }], cashWeightBasisPoints: "6760" }))).toMatchObject({ source: "holdings", cashPercent: 68, lines: [{ percent: 32 }] });
    expect(initialMix(view({ holdings: [{ ...vt, marketValueMinor: null }], valuationComplete: false, cashWeightBasisPoints: null }))).toMatchObject({ source: "empty", lines: [] });
  });
});

describe("overview states", () => {
  const render = (portfolio: PortfolioView) => renderToStaticMarkup(createElement(PortfolioOverview, { view: portfolio }));

  it("points a learner without capital back to learning and states the real cash", () => {
    const html = render(view({ earnedPracticeCapitalMinor: "0", availableCashMinor: "0", portfolioTotalMinor: "0", cashWeightBasisPoints: null }));
    expect(html).toContain("Získej kapitál učením");
    expect(html).toContain('data-testid="portfolio-cash">0 Kč');
    expect(html).not.toContain("Sestavit");
  });

  it("explains weights with the learner's real capital and keeps concept poses in their lessons", () => {
    const html = render(view());
    expect(html).toContain("Zkus si investovat nanečisto.");
    expect(html).toMatch(/60\s% z <span[^>]*>5 000 Kč<\/span> je <span[^>]*>3 000 Kč<\/span>/);
    expect(html).toContain("Příklad rozdělení · ne doporučení");
    expect(html).not.toContain("15-weights");
  });

  it("labels deterministic data as sample data and never as live", () => {
    const html = render(view({ holdings: [vt], allocation: saved }));
    expect(html).toContain("Ukázková data");
    expect(html).not.toMatch(/Čerstvá tržní data|Live|Real-time|živ/i);
    const market = render(view({ holdings: [vt], marketDataMode: "market" }));
    expect(market).toContain("Čerstvá tržní data");
    expect(market).not.toContain("Ukázková data");
  });

  it("shows no total, gain or weights while a quote is missing, only what the ledger knows", () => {
    const html = render(view({ holdings: [vt, { ...msft, marketValueMinor: null, gainLossMinor: null, portfolioWeightBasisPoints: null }], valuationComplete: false, portfolioTotalMinor: null, holdingsMarketValueMinor: null, investmentGainLossMinor: null, investmentGainLossBasisPoints: null, cashWeightBasisPoints: null, attribution: null }));
    expect(html).toContain("Některé ceny chybí");
    expect(html).toContain("Co víme jistě");
    expect(html).not.toContain('data-testid="portfolio-value"');
    expect(html).not.toContain('data-testid="portfolio-gain-loss"');
    expect(html).toContain("cena chybí");
  });
});

describe("route boundaries", () => {
  it("loads and fails without numbers, zeros or technical detail", () => {
    const loading = renderToStaticMarkup(createElement(PortfolioLabLoading));
    const failure = renderToStaticMarkup(createElement(PortfolioLabError, { error: Object.assign(new Error("relation does not exist"), { digest: "abc" }), retry: () => undefined }));
    for (const html of [loading, failure]) expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(/\d\s?Kč|\d+\s?%/);
    expect(loading).not.toContain("<h1");
    expect(failure.match(/<h1/g)).toHaveLength(1);
    expect(failure).toContain("Načíst znovu");
    expect(failure).not.toContain("relation does not exist");
  });
});
