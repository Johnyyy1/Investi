import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PortfolioView } from "@/features/portfolio/service";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/features/portfolio/actions", () => ({ resetPortfolioAction: vi.fn(), searchPortfolioInstrumentsAction: vi.fn() }));

import { contributionRows, contributionStory, dataStatus, exposureFacts, exposureLabel, groupSummaries, type ValuedExposure } from "./lab-model";
import { PortfolioOverview } from "./portfolio-overview";
import PortfolioLabError from "@/app/(app)/lab/portfolio/error";
import { AppRouteFallback as PortfolioLabLoading } from "@/components/shell/app-route-fallback";

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

const cashOnly: PortfolioView["exposure"]["sector"] = { status: "valued", categories: [{ key: "cash", kind: "cash", valueMinor: "500000", weightBasisPoints: "10000", contributions: [] }], unclassified: [] };

function view(overrides: Partial<PortfolioView> = {}): PortfolioView {
  return {
    feeProfileId: "investi-standard-v1",
    portfolioId: "p1", baseCurrency: "CZK", openedAt: "2026-10-13T08:00:00.000Z", openingCapitalMinor: "500000", earnedPracticeCapitalMinor: "500000",
    availableCashMinor: "500000", holdingsMarketValueMinor: "0", portfolioTotalMinor: "500000", investmentGainLossMinor: "0",
    performance: { startedAt: "2026-09-01T00:00:00.000Z", endedAt: "2026-10-01T00:00:00.000Z", twrMethod: "cash-flow-boundaries", twr: { status: "available", basisPoints: "144", annualizedBasisPoints: null }, mwr: { status: "available", basisPoints: "144", annualizedBasisPoints: null } },
    valuationComplete: true, valuedHoldingsCount: 0, totalHoldingsCount: 0, marketDataMode: "sample", realizedGainLossMinor: "0", cashWeightBasisPoints: "10000",
    attribution: { priceEffectMinor: "0", fxEffectMinor: "0", realizedGainLossMinor: "0", currencies: [] }, allocation: null, holdings: [], recentActivity: [],
    exposure: { sector: cashOnly, country: cashOnly },
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

describe("groups", () => {
  const mixed = view({ holdings: [vt, msft, bnd], allocation: saved, availableCashMinor: "99000", cashWeightBasisPoints: "990", portfolioTotalMinor: "1014400" });

  it("sums real values and weights per instrument type, cash included, and ignores saved targets", () => {
    const rows = groupSummaries(mixed);
    expect(rows.map(({ group, valueMinor, weightBasisPoints }) => [group, valueMinor, weightBasisPoints])).toEqual([
      ["equity", 49_100n, 480], ["etf", 409_500n, 4040], ["bond", 301_200n, 2970], ["cash", 99_000n, 990],
    ]);
  });

  it("leaves out empty groups and keeps values unknown while a quote is missing", () => {
    expect(groupSummaries(view({ holdings: [vt], availableCashMinor: "0", cashWeightBasisPoints: "0" })).map(({ group }) => group)).toEqual(["etf"]);
    const incomplete = groupSummaries(view({ holdings: [{ ...vt, marketValueMinor: null }], valuationComplete: false, portfolioTotalMinor: null }));
    expect(incomplete.find(({ group }) => group === "etf")).toMatchObject({ valueMinor: null, weightBasisPoints: null });
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

describe("sector and country exposure", () => {
  const category = (key: string, kind: "classified" | "unknown" | "cash", weightBasisPoints: string, symbols: string[] = []) =>
    ({ key, kind, valueMinor: "100", weightBasisPoints, contributions: symbols.map((symbol) => ({ symbol, valueMinor: "50" })) });

  it("names categories in Czech and keeps an unrecognised source name as reported", () => {
    expect(exposureLabel("sector", category("Technology", "classified", "0"))).toBe("Technologie");
    expect(exposureLabel("sector", category("Financial Services", "classified", "0"))).toBe("Finance");
    expect(exposureLabel("sector", category("Space mining", "classified", "0"))).toBe("Space mining");
    expect(exposureLabel("country", category("US", "classified", "0"))).toBe("Spojené státy");
    expect(exposureLabel("country", category("JP", "classified", "0"))).toBe("Japonsko");
    expect(exposureLabel("country", category("unknown", "unknown", "0"))).toBe("Neznámé");
    expect(exposureLabel("country", category("cash", "cash", "0"))).toBe("Hotovost");
  });

  it("states the largest category as a rule, not a score, and names what could not be classified", () => {
    const exposure: ValuedExposure = {
      status: "valued",
      categories: [category("Technology", "classified", "4012", ["AAPL", "VWCE"]), category("Financials", "classified", "488", ["VWCE"]), category("unknown", "unknown", "1500", ["CZGB35"]), category("cash", "cash", "4000")],
      unclassified: [{ symbol: "CZGB35", coverage: "none" }, { symbol: "VWCE", coverage: "partial" }],
    };
    const facts = exposureFacts("sector", exposure);
    expect(facts.headline).toMatch(/^Největší sektor: Technologie 40,1\s%$/);
    expect(facts.headline).not.toMatch(/\/100|skóre/);
    expect(facts.complete).toBe(false);
    expect(facts.notes).toEqual([
      "CZGB35: zdroj sektor neuvádí, proto je v kategorii Neznámé.",
      "VWCE: zdroj nerozepsal celý fond, nerozepsaný zbytek je v kategorii Neznámé.",
    ]);
    expect(exposureFacts("country", { status: "valued", categories: [category("cash", "cash", "10000")], unclassified: [] })).toMatchObject({ headline: null, complete: true, notes: [] });
  });

  it("offers the split switch with the asset-type view first", () => {
    const html = renderToStaticMarkup(createElement(PortfolioOverview, { view: view({ holdings: [vt], availableCashMinor: "590500", cashWeightBasisPoints: "5960", portfolioTotalMinor: "1000000" }) }));
    expect(html).toMatch(/role="group" aria-label="Rozložení podle"/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Typ aktiva/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Sektor/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Země/);
  });
});

describe("overview states", () => {
  const render = (portfolio: PortfolioView) => renderToStaticMarkup(createElement(PortfolioOverview, { view: portfolio }));

  it("points a learner without capital back to learning and states the real cash", () => {
    const html = render(view({ earnedPracticeCapitalMinor: "0", availableCashMinor: "0", portfolioTotalMinor: "0", cashWeightBasisPoints: null }));
    expect(html).toContain("Získej kapitál učením");
    expect(html).toContain('data-testid="portfolio-cash">0 Kč');
    expect(html).not.toContain("Sestavit");
    expect(html).not.toContain('role="combobox"');
  });

  it("starts a first purchase from search, not from a weight builder", () => {
    const html = render(view());
    expect(html).toContain("Začni prvním nákupem.");
    expect(html).toMatch(/id="first-buy-search"[^>]*role="combobox"/);
    expect(html).not.toMatch(/lab\/portfolio\/mix|type="range"|Sestavit/);
  });

  it("shows a cash debit when a tiny sale costs more than its proceeds", () => {
    const html = render(view({ holdings: [vt], recentActivity: [{ id: "sale", side: "SELL", symbol: "VT", name: "Fixture", quantity: "0.0001", unitPrice: "100", quoteCurrency: "CZK", grossAmountBaseMinor: "1", cashDeltaBaseMinor: "-999", feeBaseMinor: "1000", fxMarkupBaseMinor: "0", feeProfileId: "investi-standard-v1", executedAt: "2026-10-21T12:00:00Z" }] }));
    expect(html).toContain("Prodej");
    expect(html).toContain("−9,99 Kč");
    expect(html).toContain("Poplatek");
  });

  it("shows the split in koruny next to each share and never a saved target", () => {
    const html = render(view({ holdings: [vt, bnd], allocation: saved, availableCashMinor: "289300", cashWeightBasisPoints: "2990", portfolioTotalMinor: "1000000" }));
    expect(html).toMatch(/Rozložení portfolia: ETF 40,4\s%, 4\s095\sKč; Dluhopisy 29,7\s%, 3\s012\sKč; Hotovost 29,9\s%, 2\s893\sKč\./);
    expect(html).toContain('role="combobox"');
    expect(html).not.toMatch(/cíl|Můj mix|mimo mix/);
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
    const html = render(view({ holdings: [vt, { ...msft, marketValueMinor: null, gainLossMinor: null, portfolioWeightBasisPoints: null }], valuationComplete: false, portfolioTotalMinor: null, holdingsMarketValueMinor: null, investmentGainLossMinor: null, cashWeightBasisPoints: null, attribution: null }));
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
