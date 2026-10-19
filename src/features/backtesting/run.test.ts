import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createMarketDataService } from "@/features/market-data/composition";
import { adjustmentPolicies } from "@/features/market-data/contracts";
import type { FmpFetch } from "@/features/market-data/fmp/client";
import { backtestHistoryPlans, type BacktestHistoryPlan } from "./catalog";
import { runHistoryBacktests } from "./run";
import { BacktestDataError } from "./spec";

const deterministic = () => createMarketDataService({ provider: "deterministic", fxProvider: "deterministic" });
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

/** Test-only weekday closes in the FMP response shape, newest first like FMP; not real market data. */
function fmpHistory(symbol: string, skipMonth?: string) {
  const rows = [];
  const slope = symbol === "SPY" ? 0.05 : 0.11;
  for (let time = Date.parse("2007-01-01T00:00:00Z"), index = 0; time <= Date.parse("2025-12-31T00:00:00Z"); time += 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    if ([0, 6].includes(new Date(time).getUTCDay()) || date.startsWith(skipMonth ?? "none")) continue;
    const close = Number((100 + index * slope + 10 * Math.sin(index / 40)).toFixed(2));
    rows.push({ symbol, date, open: close, high: close, low: close, close, volume: 1 });
    index += 1;
  }
  return rows.reverse();
}

const fmpProfiles: Record<string, object> = {
  SPY: { symbol: "SPY", companyName: "SPDR S&P 500 ETF Trust", currency: "USD", exchange: "AMEX", isEtf: true, isFund: true },
  AAPL: { symbol: "AAPL", companyName: "Apple Inc.", currency: "USD", exchange: "NASDAQ", isEtf: false, isFund: false },
};

/** `skip` drops one month from one symbol's history. */
function fmpService(skip?: { symbol: string; month: string }) {
  const fetch = vi.fn<FmpFetch>(async (input) => {
    const url = new URL(input.toString());
    const symbol = url.searchParams.get("symbol") ?? "";
    if (url.pathname.endsWith("/profile")) return json([fmpProfiles[symbol]]);
    if (url.pathname.endsWith("/historical-price-eod/full")) return json(fmpHistory(symbol, skip?.symbol === symbol ? skip.month : undefined));
    throw new Error(`Unexpected request ${url.pathname}`);
  });
  return { fetch, service: createMarketDataService({ provider: "fmp", fxProvider: "cnb", fmpApiKey: "test-key-never-sent-to-fmp", fmpBaseUrl: "https://fmp.test/stable", fetch, clock: () => new Date("2026-10-18T08:00:00.000Z") }) };
}

const request = { strategy: "mix-60-40", benchmark: "US-XCBO:SPX", rebalance: "annual" as const, amount: "10000", periods: [{ start: 2016, end: 2025 }] };
const fmpRequest = { ...request, benchmark: "FMP:AMEX:SPY" };
const monthEnd = (points: readonly { date: string; close: number }[], month: string) => points.filter((point) => point.date.startsWith(month)).at(-1)!.close;

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
    expect(result.benchmark.finalValue).toBeCloseTo(10_000 * monthEnd(series.points, "2025-12") / monthEnd(series.points, "2015-12"), 8);
    expect(result.benchmarkName).toBe("Buy-and-hold SPX");
    expect(result.config.benchmark).toBe("US-XCBO:SPX");
    expect(result.source.benchmark.symbol).toBe("SPX");
  });
  it("gives identical curves when the strategy holds the benchmark's instrument at 100 % without rebalancing", async () => {
    const plan: BacktestHistoryPlan = { ...backtestHistoryPlans.deterministic, strategies: [{ id: "all-in", name: "Jen SPX", description: "100 % SPX.", spec: { holdings: [{ instrumentId: "US-XCBO:SPX", weightBps: 10_000 }], cashWeightBps: 0, rule: { kind: "fixed-weights" } } }] };
    const results = await runHistoryBacktests(deterministic(), plan, { ...request, strategy: "all-in", rebalance: "none", periods: plan.periods.map(({ start, end }) => ({ start, end })) });
    for (const result of results) {
      expect(result.points.map((point) => point.benchmark)).toEqual(result.points.map((point) => point.value));
      expect(result.benchmark).toEqual(result.metrics);
    }
  });
  it("buys and holds another chosen instrument over the same months, amount and currency", async () => {
    const service = deterministic();
    const spy = vi.spyOn(service, "getHistoricalPrices");
    const [own] = await runHistoryBacktests(service, backtestHistoryPlans.deterministic, request);
    spy.mockClear();
    const [result] = await runHistoryBacktests(service, backtestHistoryPlans.deterministic, { ...request, benchmark: "US-XNAS:NVDA" });
    expect(spy.mock.calls.map(([call]) => [call.instrumentId, call.adjustment.mode])).toEqual([["US-XCBO:SPX", "split-adjusted"], ["US-XNAS:NVDA", "split-adjusted"]]);
    expect(result.benchmarkName).toBe("Buy-and-hold NVDA");
    expect(result.source).toMatchObject({ sample: true, symbol: "SPX", benchmark: { instrumentId: "US-XNAS:NVDA", symbol: "NVDA" }, currency: "USD" });
    // The strategy path is unchanged; only benchmark B differs.
    expect(result.metrics).toEqual(own.metrics);
    expect(result.points.map((point) => point.label)).toEqual(own.points.map((point) => point.label));
    expect(result.points[0]).toEqual({ label: "2015-12", value: 10_000, benchmark: 10_000 });
    const nvda = await service.getHistoricalPrices(spy.mock.calls[1][0]);
    expect(result.benchmark.finalValue).toBeCloseTo(10_000 * monthEnd(nvda.points, "2025-12") / monthEnd(nvda.points, "2015-12"), 8);
    expect(result.benchmark.finalValue).not.toBeCloseTo(own.benchmark.finalValue, 0);
  });
  it("refuses a benchmark quoted in another currency instead of converting it", async () => {
    const plan: BacktestHistoryPlan = { ...backtestHistoryPlans.deterministic, benchmarks: [...backtestHistoryPlans.deterministic.benchmarks, { instrumentId: "IE-XETR:VWCE", symbol: "VWCE", name: "Vanguard FTSE All-World UCITS ETF" }] };
    const service = deterministic();
    const original = service.getHistoricalPrices.bind(service);
    // Test-only: give VWCE the SPX closes but keep its EUR quote currency.
    vi.spyOn(service, "getHistoricalPrices").mockImplementation(async (call) => call.instrumentId === "IE-XETR:VWCE" ? { ...await original({ ...call, instrumentId: "US-XCBO:SPX" }), instrumentId: "IE-XETR:VWCE", currency: "EUR" } : original(call));
    const run = runHistoryBacktests(service, plan, { ...request, benchmark: "IE-XETR:VWCE" });
    await expect(run).rejects.toThrow(BacktestDataError);
    await expect(runHistoryBacktests(service, plan, { ...request, benchmark: "IE-XETR:VWCE" })).rejects.toThrow(/VWCE je kótovaný v EUR, backtest ale počítá v USD/);
  });
  it("refuses benchmark closes with other return semantics instead of mixing them in", async () => {
    const service = deterministic();
    const original = service.getHistoricalPrices.bind(service);
    // Test-only: pretend the provider answered the NVDA request with a total-return series.
    vi.spyOn(service, "getHistoricalPrices").mockImplementation(async (call) => {
      const series = await original(call);
      return call.instrumentId === "US-XNAS:NVDA" ? { ...series, adjustment: adjustmentPolicies["total-return"] } : series;
    });
    await expect(runHistoryBacktests(service, backtestHistoryPlans.deterministic, { ...request, benchmark: "US-XNAS:NVDA" })).rejects.toThrow(/NVDA nemá stejnou sémantiku výnosu/);
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
  it("zero costs give the same result as a run without costs", async () => {
    const service = deterministic();
    for (const strategy of ["mix-60-40", "trend-sma"]) {
      const [plain] = await runHistoryBacktests(service, backtestHistoryPlans.deterministic, { ...request, strategy });
      const [zero] = await runHistoryBacktests(service, backtestHistoryPlans.deterministic, { ...request, strategy, costs: { rate: "0", fixedFee: "0" } });
      expect(plain.withoutCosts).toBeNull();
      expect(zero.withoutCosts).toBeNull();
      expect(zero.metrics).toEqual(plain.metrics);
      expect(zero.benchmark).toEqual(plain.benchmark);
      expect(zero.points).toEqual(plain.points);
      expect(zero.trading.strategy.costs).toBe(0);
    }
  });
  it("simulates a run with costs a second time without them, on the same closes", async () => {
    const service = deterministic();
    const [plain] = await runHistoryBacktests(service, backtestHistoryPlans.deterministic, request);
    const [result] = await runHistoryBacktests(service, backtestHistoryPlans.deterministic, { ...request, costs: { rate: "0,1", fixedFee: "1" } });
    expect(result.costs).toEqual({ rateBps: 10, fixedFee: 1 });
    expect(result.config.costs).toEqual({ rate: "0,1", fixedFee: "1" });
    expect(result.withoutCosts).toEqual({ metrics: plain.metrics, benchmark: plain.benchmark, points: plain.points });
    expect(result.metrics.finalValue).toBeLessThan(plain.metrics.finalValue);
    // Annual rebalancing of SPX against cash: the purchase plus one trade per December rebalance.
    expect(result.trading.strategy.trades).toBe(1 + result.rebalances);
    expect(result.trading.strategy.costs).toBeCloseTo(0.001 * result.trading.strategy.turnover + result.trading.strategy.trades, 8);
    // Benchmark B pays for its single purchase only: 10 000 = bought + 0.1 % of bought + 1.
    expect(result.trading.benchmark).toEqual({ trades: 1, turnover: expect.closeTo(9_999 / 1.001, 8), costs: expect.closeTo(10_000 - 9_999 / 1.001, 8) });
    expect(result.benchmark.finalValue).toBeCloseTo(plain.benchmark.finalValue * (9_999 / 1.001) / 10_000, 6);
    expect(result.points[0]).toEqual({ label: "2015-12", value: 10_000, benchmark: 10_000 });
  });
  it("makes monthly rebalancing cost more than annual, and annual more than none", async () => {
    const service = deterministic();
    const costs = { rate: "0,25", fixedFee: "0" };
    const runs = await Promise.all((["none", "annual", "monthly"] as const).map(async (rebalance) => (await runHistoryBacktests(service, backtestHistoryPlans.deterministic, { ...request, rebalance, costs }))[0]));
    const paid = runs.map((run) => run.trading.strategy.costs);
    expect(runs.map((run) => run.trading.strategy.trades)).toEqual([1, 10, 120]);
    expect(paid[0]).toBeLessThan(paid[1]);
    expect(paid[1]).toBeLessThan(paid[2]);
    for (const run of runs) expect(run.trading.benchmark.trades).toBe(1);
  });
  it.each([
    ["an unknown strategy", { strategy: "VTI" }, /dostupnou strategii/],
    ["a benchmark outside the plan", { benchmark: "FMP:AMEX:SPY" }, /dostupný benchmark/],
    ["a reversed period", { periods: [{ start: 2020, end: 2018 }] }, /počáteční rok/],
    ["a year outside the plan", { periods: [{ start: 2010, end: 2012 }] }, /2016–2025/],
    ["a zero amount", { amount: "0" }, /větší než nula/],
    ["a blank amount", { amount: "" }, /povinné/],
    ["a cost rate above 2 %", { costs: { rate: "2,5", fixedFee: "0" } }, /nejvýš 2 %/],
    ["a cost rate with three decimals", { costs: { rate: "0,125", fixedFee: "0" } }, /dvě desetinná místa/],
    ["a blank flat fee", { costs: { rate: "0,1", fixedFee: "" } }, /povinné/],
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
    const [result] = await runHistoryBacktests(service, backtestHistoryPlans.fmp, { ...fmpRequest, periods: [{ start: 2008, end: 2025 }] });
    expect(result.months).toBe(216);
    expect(result.source).toMatchObject({ sample: false, sourceName: "Financial Modeling Prep", symbol: "SPY", currency: "USD", retrievedAt: "2026-10-18T08:00:00.000Z" });
    const history = fetch.mock.calls.map(([input]) => new URL(input.toString())).filter((url) => url.pathname.endsWith("/historical-price-eod/full"));
    expect(history.map((url) => [url.searchParams.get("symbol"), url.searchParams.get("from"), url.searchParams.get("to")])).toEqual([["SPY", "2007-01-01", "2025-12-31"]]);
  });
  it("refuses a period with a missing month instead of filling it, and keeps the others", async () => {
    const { service } = fmpService({ symbol: "SPY", month: "2020-05" });
    const run = runHistoryBacktests(service, backtestHistoryPlans.fmp, { ...fmpRequest, periods: [{ start: 2020, end: 2021 }] });
    await expect(run).rejects.toThrow(BacktestDataError);
    await expect(runHistoryBacktests(service, backtestHistoryPlans.fmp, { ...fmpRequest, periods: [{ start: 2020, end: 2021 }] })).rejects.toThrow(/chybí měsíční uzávěrka za 2020-05/);
    const [unaffected] = await runHistoryBacktests(service, backtestHistoryPlans.fmp, { ...fmpRequest, periods: [{ start: 2022, end: 2022 }] });
    expect(unaffected.months).toBe(12);
  });
  it("loads a single-stock benchmark as a second history request and labels it historical", async () => {
    const { fetch, service } = fmpService();
    const [result] = await runHistoryBacktests(service, backtestHistoryPlans.fmp, { ...fmpRequest, benchmark: "FMP:NASDAQ:AAPL", periods: [{ start: 2008, end: 2025 }] });
    const history = fetch.mock.calls.map(([input]) => new URL(input.toString())).filter((url) => url.pathname.endsWith("/historical-price-eod/full"));
    expect(history.map((url) => [url.searchParams.get("symbol"), url.searchParams.get("from"), url.searchParams.get("to")]).sort()).toEqual([["AAPL", "2007-01-01", "2025-12-31"], ["SPY", "2007-01-01", "2025-12-31"]]);
    expect(result.benchmarkName).toBe("Buy-and-hold AAPL");
    expect(result.source).toMatchObject({ sample: false, symbol: "SPY", benchmark: { symbol: "AAPL" } });
    const aapl = fmpHistory("AAPL").reverse();
    expect(result.benchmark.finalValue).toBeCloseTo(10_000 * monthEnd(aapl, "2025-12") / monthEnd(aapl, "2007-12"), 8);
  });
  it("refuses the run when only the benchmark's history misses a month", async () => {
    const { service } = fmpService({ symbol: "AAPL", month: "2020-05" });
    await expect(runHistoryBacktests(service, backtestHistoryPlans.fmp, { ...fmpRequest, benchmark: "FMP:NASDAQ:AAPL", periods: [{ start: 2020, end: 2021 }] })).rejects.toThrow(/Historie AAPL je neúplná: chybí měsíční uzávěrka za 2020-05/);
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
