import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { riskMetrics, type RiskHistoryEntry, type RiskHistorySnapshot } from "@/features/lessons/real-history/risk-window";
import { unavailableMessage } from "@/features/lessons/real-history/snapshot";
import { HistoricalCorrelationExercise } from "./historical-correlation-exercise";

// Test-only closes; not real market data.
const dates = Array.from({ length: 40 }, (_, index) => new Date(Date.UTC(2022, 0, 3 + index + 2 * Math.floor(index / 5))).toISOString().slice(0, 10));
const closes = (shift: number) => dates.map((date, index) => ({ date, close: Number((100 + ((index * 7 + shift) % 11) - 5 + index * 0.1).toFixed(2)) }));
const provenance = { provider: "financial-modeling-prep", dataset: "stable/historical-price-eod/full", dataKind: "historical", isDeterministic: false, adjustmentMode: "split-adjusted", completeness: "complete", retrievedAt: "2026-10-19T08:00:00.000Z" } as const;
const snapshot = (symbol: string, assetType: "equity" | "etf", shift: number): RiskHistorySnapshot => {
  const points = closes(shift);
  return { instrumentId: symbol === "AAPL" ? "FMP:NASDAQ:AAPL" : "FMP:AMEX:SPY", symbol, name: symbol, assetType, currency: "USD", labHref: null, points, period: "Denní zavírací ceny za rok 2022.", metrics: riskMetrics(points)!, provenance };
};
const aapl = snapshot("AAPL", "equity", 0), spy = snapshot("SPY", "etf", 3);
const render = (history?: readonly RiskHistoryEntry[]) => renderToStaticMarkup(<HistoricalCorrelationExercise history={history} />);

describe("historical correlation exercise", () => {
  it("asks for a prediction before showing any coefficient or dot", () => {
    const html = render([{ status: "ok", snapshot: aapl }, { status: "ok", snapshot: spy }]);
    expect(html).toContain("Předpověď: Jak silně spolu v roce 2022 korelovaly denní výnosy AAPL a SPY?");
    expect(html).toContain("Silně · 0,7 a víc");
    expect(html).not.toMatch(/Korelace AAPL ↔ SPY|Leden až červen|role="img"/);
  });

  it("labels provider history truthfully and never as live data", () => {
    const html = render([{ status: "ok", snapshot: aapl }, { status: "ok", snapshot: spy }]);
    expect(html).toContain("Historická data · Financial Modeling Prep");
    expect(html).toContain("jen cena, bez dividend");
    expect(html).not.toMatch(/\bLive\b|Real-time|[Aa]ktuální cena|Ukázková data/);
  });

  it("labels deterministic fixtures as sample data", () => {
    const sample = (item: RiskHistorySnapshot): RiskHistorySnapshot => ({ ...item, provenance: { ...item.provenance, provider: "investi-deterministic", dataKind: "synthetic", isDeterministic: true } });
    const html = render([{ status: "ok", snapshot: sample(aapl) }, { status: "ok", snapshot: sample(spy) }]);
    expect(html).toContain("Ukázková data");
    expect(html).not.toContain("Historická data");
  });

  it("needs both instruments and says so instead of inventing a coefficient", () => {
    const missing: RiskHistoryEntry = { status: "unavailable", instrument: { instrumentId: "FMP:AMEX:SPY", symbol: "SPY", name: "SPY", assetType: "etf" }, message: unavailableMessage };
    for (const history of [undefined, [], [{ status: "ok", snapshot: aapl }, missing]] as const) {
      const html = render(history as readonly RiskHistoryEntry[] | undefined);
      expect(html).toContain(unavailableMessage);
      expect(html).toContain("Korelace potřebuje oba instrumenty.");
      expect(html).not.toMatch(/0,00|Předpověď/);
    }
  });

  it("explains a too-short common window instead of showing 0", () => {
    const short = (item: RiskHistorySnapshot): RiskHistorySnapshot => ({ ...item, points: item.points.slice(0, 10) });
    const html = render([{ status: "ok", snapshot: short(aapl) }, { status: "ok", snapshot: short(spy) }]);
    expect(html).toContain("Korelaci pro tento rok nelze spočítat.");
    expect(html).not.toContain("0,00");
  });
});
