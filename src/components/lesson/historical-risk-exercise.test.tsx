import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { riskMetrics, type RiskHistoryEntry, type RiskHistorySnapshot } from "@/features/lessons/real-history/risk-window";
import { unavailableMessage } from "@/features/lessons/real-history/snapshot";
import { HistoricalRiskExercise } from "./historical-risk-exercise";

// Test-only closes; not real market data.
const dates = Array.from({ length: 30 }, (_, index) => new Date(Date.UTC(2022, 0, 3 + index + 2 * Math.floor(index / 5))).toISOString().slice(0, 10));
const points = dates.map((date, index) => ({ date, close: Number((100 + (index % 2 ? 3 : -2) + (index > 10 && index < 20 ? -12 : 0)).toFixed(2)) }));
const snapshot: RiskHistorySnapshot = {
  instrumentId: "FMP:NASDAQ:AAPL", symbol: "AAPL", name: "Apple Inc.", assetType: "equity", currency: "USD", labHref: "/lab/instruments/FMP%3ANASDAQ%3AAAPL",
  points, period: "Denní zavírací ceny za rok 2022.", metrics: riskMetrics(points)!,
  provenance: { provider: "financial-modeling-prep", dataset: "stable/historical-price-eod/full", dataKind: "historical", isDeterministic: false, adjustmentMode: "split-adjusted", completeness: "complete", retrievedAt: "2026-10-19T08:00:00.000Z" },
};
const spy: RiskHistoryEntry = { status: "unavailable", instrument: { instrumentId: "FMP:AMEX:SPY", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "etf" }, message: unavailableMessage };
const render = (mode: "volatility" | "max-drawdown", history?: readonly RiskHistoryEntry[]) => renderToStaticMarkup(<HistoricalRiskExercise mode={mode} history={history} />);

describe("historical risk exercise", () => {
  it("asks for a prediction before revealing any number when both instruments loaded", () => {
    const second: RiskHistorySnapshot = { ...snapshot, instrumentId: "FMP:AMEX:SPY", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "etf" };
    const html = render("volatility", [{ status: "ok", snapshot }, { status: "ok", snapshot: second }]);
    expect(html).toContain("Předpověď: Který z nich v roce 2022 kolísal víc?");
    expect(html).toContain("Vyber svůj odhad. Pak se odhalí čísla.");
    expect(html).not.toContain("Denní směrodatná odchylka");
    expect(html).not.toMatch(/\d+,\d{2} ?%/);
  });

  it("labels provider history truthfully and gives the daily deviation to annualise", () => {
    const html = render("volatility", [{ status: "ok", snapshot }, spy]);
    expect(html).toContain("Historická data · Financial Modeling Prep");
    expect(html).toContain("jen cena, bez dividend");
    expect(html).toContain("Denní směrodatná odchylka");
    expect(html).toContain(`z ${snapshot.metrics.returnCount} denních jednoduchých výnosů`);
    expect(html).toContain("vynásob ji √252");
    // The unavailable ETF stays selectable and says so when chosen; nothing is filled in.
    expect(html).toContain("SPY · fond ETF");
    expect(html).toContain("href=\"/lab/instruments/FMP%3ANASDAQ%3AAAPL\"");
    expect(html).not.toMatch(/\bLive\b|Real-time|[Aa]ktuální cena|Ukázková data/);
  });

  it("shows the peak and trough of the largest drawdown for the learner to divide", () => {
    const html = render("max-drawdown", [{ status: "ok", snapshot }]);
    expect(html).toContain("Vrchol před propadem");
    expect(html).toContain("Dno propadu");
    expect(html).toContain("Propad je záporné číslo.");
  });

  it("labels deterministic fixtures as sample data", () => {
    const sample: RiskHistorySnapshot = { ...snapshot, provenance: { ...snapshot.provenance, provider: "investi-deterministic", dataKind: "synthetic", isDeterministic: true } };
    const html = render("volatility", [{ status: "ok", snapshot: sample }]);
    expect(html).toContain("Ukázková data");
    expect(html).not.toMatch(/Historická data|\bLive\b|Real-time/);
  });

  it("shows an explicit unavailable state instead of zeros or sample numbers", () => {
    for (const history of [undefined, [], [spy]]) {
      const html = render("volatility", history);
      expect(html).toContain(unavailableMessage);
      expect(html).not.toContain("0,00");
    }
  });
});
