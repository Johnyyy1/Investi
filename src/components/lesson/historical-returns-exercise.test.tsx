import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { unavailableMessage, type LessonHistoryEntry, type LessonHistorySnapshot } from "@/features/lessons/real-history/snapshot";
import { HistoricalReturnsExercise } from "./historical-returns-exercise";

// Test-only closes; not real market data.
const snapshot: LessonHistorySnapshot = {
  instrumentId: "FMP:NASDAQ:AAPL", symbol: "AAPL", name: "Apple Inc.", assetType: "equity", currency: "USD", labHref: "/lab/instruments/FMP%3ANASDAQ%3AAAPL",
  points: [{ date: "2023-12-29", close: 100 }, { date: "2024-03-28", close: 110 }, { date: "2024-06-28", close: 99 }, { date: "2024-09-30", close: 118.8 }, { date: "2024-12-31", close: 130.68 }],
  sampling: "Závěrečná cena posledního obchodního dne každého čtvrtletí.",
  provenance: { provider: "financial-modeling-prep", dataset: "stable/historical-price-eod/full", dataKind: "historical", isDeterministic: false, adjustmentMode: "split-adjusted", completeness: "complete", retrievedAt: "2026-10-18T08:00:00.000Z" },
};
const spy: LessonHistoryEntry = { status: "unavailable", instrument: { instrumentId: "FMP:AMEX:SPY", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "etf" }, message: unavailableMessage };
const render = (mode: "period" | "cumulative", history?: readonly LessonHistoryEntry[]) => renderToStaticMarkup(<HistoricalReturnsExercise mode={mode} history={history} />);

describe("historical returns exercise", () => {
  it("labels provider history truthfully as historical, price-only and dated", () => {
    const html = render("period", [{ status: "ok", snapshot }, spy]);
    expect(html).toContain("Historická data · Financial Modeling Prep · stav k 31. 12. 2024");
    expect(html).toContain("jen cena, bez dividend");
    expect(html).toContain("Ceny očištěné o splity");
    expect(html).toContain("načteno 18. 10. 2026");
    expect(html).toContain("href=\"/lab/instruments/FMP%3ANASDAQ%3AAAPL\"");
    expect(html).toContain("Podívej se na tenhle instrument v Labu");
    expect(html).toContain("Odhalí se po kontrole");
    expect(html).not.toMatch(/\bLive\b|Real-time|[Aa]ktuální cena|Ukázková data/);
  });

  it("labels deterministic fixtures as sample data, never as historical or live", () => {
    const sample: LessonHistorySnapshot = { ...snapshot, provenance: { ...snapshot.provenance, provider: "investi-deterministic", dataKind: "synthetic", isDeterministic: true } };
    const html = render("cumulative", [{ status: "ok", snapshot: sample }]);
    expect(html).toContain("Ukázková data");
    expect(html).not.toMatch(/Historická data|\bLive\b|Real-time|[Aa]ktuální cena/);
    // Cumulative practice gives the period returns and asks only for the composition.
    expect(html).toContain("R₁: +10,00\u00a0%");
    expect(html).toContain("(1 + R₁) × (1 + R₂) × (1 + R₃) × (1 + R₄) − 1");
  });

  it("shows an explicit unavailable state instead of zeros or sample numbers", () => {
    for (const history of [undefined, [], [spy]]) {
      const html = render("period", history);
      expect(html).toContain(unavailableMessage);
      expect(html).not.toContain("0,00");
    }
  });

  it("flags a source-reported partial series", () => {
    const html = render("period", [{ status: "ok", snapshot: { ...snapshot, provenance: { ...snapshot.provenance, completeness: "partial" } } }]);
    expect(html).toContain("zdroj hlásí neúplnou řadu");
  });
});
