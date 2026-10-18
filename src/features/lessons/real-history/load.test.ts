import { describe, expect, it, vi } from "vitest";
import { createMarketDataService } from "@/features/market-data/composition";
import type { FmpFetch } from "@/features/market-data/fmp/client";
import { getAuthoredLesson } from "../registry";
import { lessonUsesHistory, loadLessonHistory } from "./load";
import { isRealHistory } from "./snapshot";

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
const profiles: Record<string, unknown> = {
  AAPL: { symbol: "AAPL", companyName: "Apple Inc.", currency: "USD", exchange: "NASDAQ", isEtf: false, isFund: false },
  SPY: { symbol: "SPY", companyName: "SPDR S&P 500 ETF Trust", currency: "USD", exchange: "AMEX", isEtf: true, isFund: true },
};
// Test-only closes in the FMP response shape; not real market data.
const history = (symbol: string) => ["2023-12-29", "2024-03-28", "2024-06-28", "2024-09-30", "2024-12-31"].map((date, index) => { const close = 100 + index * 5; return { symbol, date, open: close, high: close, low: close, close, volume: 1 }; });

function fmpService(fail: string | null = null) {
  const fetch = vi.fn<FmpFetch>(async (input) => {
    const url = new URL(input.toString());
    const symbol = url.searchParams.get("symbol")!;
    if (symbol === fail) return json({ "Error Message": "unavailable" }, 503);
    if (url.pathname.endsWith("/profile")) return json([profiles[symbol]]);
    if (url.pathname.endsWith("/historical-price-eod/full")) return json(history(symbol));
    throw new Error(`Unexpected request ${url.pathname}`);
  });
  return { fetch, service: createMarketDataService({ provider: "fmp", fxProvider: "cnb", fmpApiKey: "test-key-never-sent-to-fmp", fmpBaseUrl: "https://fmp.test/stable", fetch, clock: () => new Date("2026-10-18T08:00:00.000Z") }) };
}

describe("loading lesson history", () => {
  it("is requested only by lessons with a historical-data figure", () => {
    expect(lessonUsesHistory(getAuthoredLesson("returns", "simple-returns")!)).toBe(true);
    expect(lessonUsesHistory(getAuthoredLesson("returns", "compounding-and-cumulative-returns")!)).toBe(true);
    expect(lessonUsesHistory(getAuthoredLesson("returns", "what-is-a-return")!)).toBe(false);
  });

  it("freezes a stock and an ETF from the provider's fixed window, labelled as historical", async () => {
    const { fetch, service } = fmpService();
    const entries = await loadLessonHistory(service, "fmp");
    expect(entries.map((entry) => entry.status)).toEqual(["ok", "ok"]);
    const snapshots = entries.flatMap((entry) => entry.status === "ok" ? [entry.snapshot] : []);
    expect(snapshots.map((snapshot) => [snapshot.symbol, snapshot.assetType, snapshot.points.length, isRealHistory(snapshot)])).toEqual([["AAPL", "equity", 5, true], ["SPY", "etf", 5, true]]);
    expect(snapshots[0].labHref).toBe("/lab/instruments/FMP%3ANASDAQ%3AAAPL");
    const historyRequests = fetch.mock.calls.map(([input]) => new URL(input.toString())).filter((url) => url.pathname.endsWith("/historical-price-eod/full"));
    expect(historyRequests.map((url) => [url.searchParams.get("from"), url.searchParams.get("to")])).toEqual([["2023-12-15", "2024-12-31"], ["2023-12-15", "2024-12-31"]]);
  });

  it("marks one failing instrument unavailable and keeps the other", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const entries = await loadLessonHistory(fmpService("SPY").service, "fmp");
    expect(entries.map((entry) => entry.status)).toEqual(["ok", "unavailable"]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("serves deterministic mode from the sample fixtures and never calls them historical", async () => {
    const entries = await loadLessonHistory(createMarketDataService({ provider: "deterministic", fxProvider: "deterministic" }), "deterministic");
    expect(entries.map((entry) => entry.status)).toEqual(["ok", "ok"]);
    for (const entry of entries) if (entry.status === "ok") {
      expect(isRealHistory(entry.snapshot)).toBe(false);
      expect(entry.snapshot.points).toHaveLength(5);
    }
  });
});
