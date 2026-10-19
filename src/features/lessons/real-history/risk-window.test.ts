import { describe, expect, it, vi } from "vitest";
import { priceMetrics } from "@/features/instruments/price-metrics";
import { createMarketDataService } from "@/features/market-data/composition";
import { adjustmentPolicies, type HistoricalSeries } from "@/features/market-data/contracts";
import type { FmpFetch } from "@/features/market-data/fmp/client";
import { getAuthoredLesson } from "../registry";
import { lessonUsesHistory, lessonUsesRiskHistory, loadLessonRiskHistory } from "./load";
import { freezeRiskHistory, riskHistoryPlans, riskMetrics } from "./risk-window";
import { isRealHistory } from "./snapshot";

/** Test-only weekday closes through 2022 with a dip in the middle; not real market data. */
function weekdays(from = "2022-01-03", to = "2022-12-30") {
  const dates: string[] = [];
  for (let time = Date.parse(`${from}T00:00:00.000Z`); time <= Date.parse(`${to}T00:00:00.000Z`); time += 86_400_000) {
    const day = new Date(time).getUTCDay();
    if (day !== 0 && day !== 6) dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
}
const closes = (dates: string[]) => dates.map((date, index) => ({ date, close: Number((100 + 10 * Math.sin(index / 9) - (index > 120 && index < 180 ? 15 : 0)).toFixed(2)) }));
const plan = riskHistoryPlans.fmp;
const aapl = plan.instruments[0];

function series(points = closes(weekdays()), overrides: Partial<HistoricalSeries> = {}): HistoricalSeries {
  return {
    instrumentId: aapl.instrumentId, currency: "USD", interval: "daily", timeZone: "UTC", adjustment: adjustmentPolicies["split-adjusted"],
    points: points.map((point) => ({ ...point, open: point.close, high: point.close, low: point.close })),
    provenance: { provider: "financial-modeling-prep", dataset: "stable/historical-price-eod/full", dataKind: "historical", isDeterministic: false, isDemo: false, adjustmentMode: "split-adjusted", completeness: "complete", observedAt: "2022-12-30T21:00:00.000Z", retrievedAt: "2026-10-19T08:00:00.000Z" },
    ...overrides,
  };
}

describe("lesson risk history", () => {
  it("is requested only by the lessons with a historical risk figure", () => {
    expect(lessonUsesRiskHistory(getAuthoredLesson("volatility", "annualising-volatility")!)).toBe(true);
    expect(lessonUsesRiskHistory(getAuthoredLesson("volatility", "max-drawdown")!)).toBe(true);
    expect(lessonUsesRiskHistory(getAuthoredLesson("volatility", "standard-deviation")!)).toBe(false);
    expect(lessonUsesHistory(getAuthoredLesson("volatility", "annualising-volatility")!)).toBe(false);
    expect(lessonUsesRiskHistory(getAuthoredLesson("returns", "simple-returns")!)).toBe(false);
  });

  it("freezes the whole year with metrics from the Lab's priceMetrics", () => {
    const entry = freezeRiskHistory(series(), plan, aapl, "/lab/instruments/x");
    if (entry.status !== "ok") throw new Error("expected ok");
    const lab = priceMetrics(entry.snapshot.points)!;
    expect(entry.snapshot.points).toHaveLength(weekdays().length);
    expect(entry.snapshot.metrics.annualisedVolatility).toBe(lab.annualisedVolatility);
    expect(entry.snapshot.metrics.maxDrawdown).toEqual(lab.maxDrawdown);
    expect(entry.snapshot.metrics.dailyDeviation * Math.sqrt(252)).toBeCloseTo(lab.annualisedVolatility!, 14);
    expect(entry.snapshot.metrics.returnCount).toBe(weekdays().length - 1);
    expect(isRealHistory(entry.snapshot)).toBe(true);
  });

  it("excludes returns across long gaps from the count, as the Lab does", () => {
    const points = closes(weekdays()).filter((point) => point.date < "2022-06-06" || point.date > "2022-06-10");
    const metrics = riskMetrics(points)!;
    expect(metrics.returnCount).toBe(points.length - 2);
  });

  it.each([
    ["a holed year", series(closes(weekdays()).filter((_, index) => index % 2 === 0))],
    ["a window that starts late", series(closes(weekdays("2022-02-01")))],
    ["a window that ends early", series(closes(weekdays("2022-01-03", "2022-11-30")))],
    ["a dividend-adjusted basis", series(undefined, { adjustment: adjustmentPolicies["total-return"] })],
    ["another instrument", series(undefined, { instrumentId: "FMP:AMEX:SPY" })],
    ["a non-positive close", series(closes(weekdays()).map((point, index) => index === 5 ? { ...point, close: 0 } : point))],
  ])("makes %s unavailable instead of filling it", (_, input) => {
    expect(freezeRiskHistory(input, plan, aapl, null).status).toBe("unavailable");
  });

  it("requests the fixed 2022 window from FMP and keeps one failing instrument from breaking the other", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const profiles: Record<string, unknown> = {
      AAPL: { symbol: "AAPL", companyName: "Apple Inc.", currency: "USD", exchange: "NASDAQ", isEtf: false, isFund: false },
      SPY: { symbol: "SPY", companyName: "SPDR S&P 500 ETF Trust", currency: "USD", exchange: "AMEX", isEtf: true, isFund: true },
    };
    const fetch = vi.fn<FmpFetch>(async (input) => {
      const url = new URL(input.toString());
      const symbol = url.searchParams.get("symbol")!;
      if (symbol === "SPY") return new Response(JSON.stringify({ "Error Message": "unavailable" }), { status: 503 });
      if (url.pathname.endsWith("/profile")) return Response.json([profiles[symbol]]);
      if (url.pathname.endsWith("/historical-price-eod/full")) return Response.json(closes(weekdays()).reverse().map((point) => ({ symbol, ...point, open: point.close, high: point.close, low: point.close, volume: 1 })));
      throw new Error(`Unexpected request ${url.pathname}`);
    });
    const service = createMarketDataService({ provider: "fmp", fxProvider: "cnb", fmpApiKey: "test-key-never-sent-to-fmp", fmpBaseUrl: "https://fmp.test/stable", fetch, clock: () => new Date("2026-10-19T08:00:00.000Z") });
    const entries = await loadLessonRiskHistory(service, "fmp");
    expect(entries.map((entry) => entry.status)).toEqual(["ok", "unavailable"]);
    const requests = fetch.mock.calls.map(([input]) => new URL(input.toString())).filter((url) => url.pathname.endsWith("/historical-price-eod/full") && url.searchParams.get("symbol") === "AAPL");
    expect(requests.map((url) => [url.searchParams.get("from"), url.searchParams.get("to")])).toEqual([["2022-01-01", "2022-12-31"]]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("serves deterministic mode from the sample fixtures and never calls them historical", async () => {
    const entries = await loadLessonRiskHistory(createMarketDataService({ provider: "deterministic", fxProvider: "deterministic" }), "deterministic");
    expect(entries.map((entry) => entry.status)).toEqual(["ok", "ok"]);
    for (const entry of entries) if (entry.status === "ok") {
      expect(isRealHistory(entry.snapshot)).toBe(false);
      expect(entry.snapshot.points.length).toBeGreaterThanOrEqual(240);
      expect(entry.snapshot.metrics.maxDrawdown.depth).toBeLessThan(0);
    }
  });
});
