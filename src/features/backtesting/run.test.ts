import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createMarketDataService } from "@/features/market-data/composition";
import type { FmpFetch } from "@/features/market-data/fmp/client";
import { backtestHistoryPlans } from "./catalog";
import { runHistoryBacktests } from "./run";
import { BacktestDataError } from "./spec";

const deterministic = () => createMarketDataService({ provider: "deterministic", fxProvider: "deterministic" });
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

/** Test-only weekday closes in the FMP response shape, newest first like FMP; not real market data. */
function fmpHistory(skipMonth?: string) {
  const rows = [];
  for (let time = Date.parse("2007-01-01T00:00:00Z"), index = 0; time <= Date.parse("2025-12-31T00:00:00Z"); time += 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    if ([0, 6].includes(new Date(time).getUTCDay()) || date.startsWith(skipMonth ?? "none")) continue;
    const close = Number((100 + index * 0.05 + 10 * Math.sin(index / 40)).toFixed(2));
    rows.push({ symbol: "SPY", date, open: close, high: close, low: close, close, volume: 1 });
    index += 1;
  }
  return rows.reverse();
}

function fmpService(skipMonth?: string) {
  const fetch = vi.fn<FmpFetch>(async (input) => {
    const url = new URL(input.toString());
    if (url.pathname.endsWith("/profile")) return json([{ symbol: "SPY", companyName: "SPDR S&P 500 ETF Trust", currency: "USD", exchange: "AMEX", isEtf: true, isFund: true }]);
    if (url.pathname.endsWith("/historical-price-eod/full")) return json(fmpHistory(skipMonth));
    throw new Error(`Unexpected request ${url.pathname}`);
  });
  return { fetch, service: createMarketDataService({ provider: "fmp", fxProvider: "cnb", fmpApiKey: "test-key-never-sent-to-fmp", fmpBaseUrl: "https://fmp.test/stable", fetch, clock: () => new Date("2026-10-18T08:00:00.000Z") }) };
}

const request = { strategy: "mix-60-40", rebalance: "annual" as const, amount: "10000", periods: [{ start: 2016, end: 2025 }] };

describe("history backtest with the deterministic provider", () => {
  it("runs a 60 / 40 mix over 120 months and labels the closes as sample data", async () => {
    const [result] = await runHistoryBacktests(deterministic(), backtestHistoryPlans.deterministic, request);
    expect(result.months).toBe(120);
    expect(result.points).toHaveLength(121);
    expect(result.points[0]).toEqual({ label: "2015-12", value: 10_000, benchmark: 10_000 });
    expect(result.points.at(-1)!.label).toBe("2025-12");
    expect(result.period).toBe("Leden 2016 – prosinec 2025");
    expect(result.rebalances).toBe(9);
    expect(result.currency).toBe("USD");
    expect(result.source).toMatchObject({ kind: "history", sample: true, symbol: "SPX", adjustment: "split-adjusted", firstMonth: "2015-12", lastMonth: "2025-12", lastCloseDate: "2025-12-31" });
    expect(result.points.map((point) => point.value)).toEqual(result.metrics.values);
  });
  it("compares with buying and holding the same instrument from the same start value", async () => {
    const service = deterministic();
    const [result] = await runHistoryBacktests(service, backtestHistoryPlans.deterministic, request);
    const series = await service.getHistoricalPrices({ instrumentId: "US-XCBO:SPX", startDate: "2015-12-01", endDate: "2025-12-31", interval: "daily", timeZone: "UTC", adjustment: { mode: "split-adjusted", splitTreatment: "adjusted", dividendTreatment: "excluded" } });
    const close = (month: string) => series.points.filter((point) => point.date.startsWith(month)).at(-1)!.close;
    expect(result.benchmark.finalValue).toBeCloseTo(10_000 * close("2025-12") / close("2015-12"), 8);
  });
  it("is reproducible and cuts several periods from one history request", async () => {
    const service = deterministic();
    const spy = vi.spyOn(service, "getHistoricalPrices");
    const periods = backtestHistoryPlans.deterministic.periods.map(({ start, end }) => ({ start, end }));
    const results = await runHistoryBacktests(service, backtestHistoryPlans.deterministic, { ...request, strategy: "trend-sma", periods });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(results.map((result) => result.months)).toEqual([120, 24, 12, 36]);
    expect(await runHistoryBacktests(service, backtestHistoryPlans.deterministic, { ...request, strategy: "trend-sma", periods })).toEqual(results);
    for (const result of results) expect(result.monthsInvested).toBeLessThanOrEqual(result.months);
    // The trend filter steps aside somewhere in the series, so it differs from buy and hold.
    expect(results[0].monthsInvested).toBeLessThan(120);
  });
  it("lets the rebalancing rule change the result of the same mix", async () => {
    const service = deterministic();
    const [none] = await runHistoryBacktests(service, backtestHistoryPlans.deterministic, { ...request, rebalance: "none" });
    const [monthly] = await runHistoryBacktests(service, backtestHistoryPlans.deterministic, { ...request, rebalance: "monthly" });
    expect(none.rebalances).toBe(0);
    expect(monthly.rebalances).toBe(119);
    expect(none.metrics.finalValue).not.toBeCloseTo(monthly.metrics.finalValue, 2);
  });
  it.each([
    ["an unknown strategy", { strategy: "VTI" }, /dostupnou strategii/],
    ["a reversed period", { periods: [{ start: 2020, end: 2018 }] }, /počáteční rok/],
    ["a year outside the plan", { periods: [{ start: 2010, end: 2012 }] }, /2016–2025/],
    ["a zero amount", { amount: "0" }, /větší než nula/],
    ["a blank amount", { amount: "" }, /povinné/],
  ])("refuses %s before loading any history", async (_, change, message) => {
    const service = deterministic();
    const spy = vi.spyOn(service, "getHistoricalPrices");
    await expect(runHistoryBacktests(service, backtestHistoryPlans.deterministic, { ...request, ...change })).rejects.toThrow(message);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("history backtest with FMP", () => {
  it("labels FMP closes as historical, price-only data in USD", async () => {
    const { fetch, service } = fmpService();
    const [result] = await runHistoryBacktests(service, backtestHistoryPlans.fmp, { ...request, periods: [{ start: 2008, end: 2025 }] });
    expect(result.months).toBe(216);
    expect(result.source).toMatchObject({ sample: false, sourceName: "Financial Modeling Prep", symbol: "SPY", currency: "USD", retrievedAt: "2026-10-18T08:00:00.000Z" });
    const history = fetch.mock.calls.map(([input]) => new URL(input.toString())).filter((url) => url.pathname.endsWith("/historical-price-eod/full"));
    expect(history.map((url) => [url.searchParams.get("symbol"), url.searchParams.get("from"), url.searchParams.get("to")])).toEqual([["SPY", "2007-01-01", "2025-12-31"]]);
  });
  it("refuses a period with a missing month instead of filling it, and keeps the others", async () => {
    const { service } = fmpService("2020-05");
    const run = runHistoryBacktests(service, backtestHistoryPlans.fmp, { ...request, periods: [{ start: 2020, end: 2021 }] });
    await expect(run).rejects.toThrow(BacktestDataError);
    await expect(runHistoryBacktests(service, backtestHistoryPlans.fmp, { ...request, periods: [{ start: 2020, end: 2021 }] })).rejects.toThrow(/chybí měsíční uzávěrka za 2020-05/);
    const [unaffected] = await runHistoryBacktests(service, backtestHistoryPlans.fmp, { ...request, periods: [{ start: 2022, end: 2022 }] });
    expect(unaffected.months).toBe(12);
  });
});

describe("authority boundary", () => {
  it("never touches persistence, rewards or the portfolio ledger", async () => {
    const directory = path.dirname(fileURLToPath(import.meta.url));
    const sources = (await readdir(directory)).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
    for (const file of sources) {
      const source = await readFile(path.join(directory, file), "utf8");
      expect(source, file).not.toMatch(/@\/db|features\/portfolio\/(?:repository|service)|features\/rewards|features\/progression/);
    }
  });
});
