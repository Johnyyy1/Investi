import "server-only";

import { FinancialInputError, parsePrice } from "@/features/finance/returns";
import { chartPoints } from "@/features/instruments/history";
import { adjustmentPolicies, type MarketDataProvenance } from "@/features/market-data/contracts";
import type { MarketDataService } from "@/features/market-data/service";
import { benchmarkName, type BacktestHistoryPlan, type BacktestInstrument, type HistoryBacktestResult } from "./catalog";
import { alignMonthlyCloses } from "./monthly";
import { simulateBacktest, simulateBuyAndHold } from "./simulate";
import { addMonths, backtestComparisonSchema, backtestSpecSchema, BacktestDataError, buyAndHoldFor, lookbackMonths, monthRange, type BacktestSpec, type RebalanceRule } from "./spec";

export type HistoryBacktestRequest = { strategy: string; benchmark: string; rebalance: RebalanceRule; amount: string; periods: readonly { start: number; end: number }[] };

const czechMonth = (month: string) => new Intl.DateTimeFormat("cs-CZ", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const capitalized = (value: string) => value.charAt(0).toLocaleUpperCase("cs-CZ") + value.slice(1);
/** Labels follow provenance: a run is historical only when every series it used is. */
const isSample = (provenance: Pick<MarketDataProvenance, "isDeterministic" | "dataKind">) => provenance.isDeterministic || provenance.dataKind !== "historical";

/**
 * Loads one instrument's whole plan window once per run; every period is then cut from the same
 * closes. A series in another currency or with other return semantics than the plan is refused.
 */
async function loadPlanHistory(service: MarketDataService, plan: BacktestHistoryPlan, { instrumentId, symbol }: BacktestInstrument) {
  const request = { instrumentId, startDate: plan.fetchStartDate, endDate: plan.fetchEndDate, interval: "daily" as const, timeZone: "UTC" as const, adjustment: adjustmentPolicies["split-adjusted"] };
  const [instrument, series] = await Promise.all([service.getInstrumentMetadata(instrumentId), service.getHistoricalPrices(request)]);
  if (instrument.quoteCurrency !== plan.currency || series.currency !== plan.currency) throw new BacktestDataError(`${symbol} je kótovaný v ${series.currency}, backtest ale počítá v ${plan.currency}. Měny nemícháme, proto jsme backtest nespustili.`, "unavailable");
  if (series.adjustment.mode !== "split-adjusted") throw new BacktestDataError(`Cenová historie ${symbol} nemá stejnou sémantiku výnosu (jen cena bez dividend). Backtest jsme nespustili.`, "unavailable");
  const points = series.instrumentId === instrumentId ? chartPoints(series, request.startDate, request.endDate) : [];
  if (!points.length) throw new BacktestDataError(`Cenová historie ${symbol} není v očekávaném tvaru. Backtest jsme nespustili.`, "unavailable");
  return { points, currency: series.currency, provenance: series.provenance };
}

function specFor(plan: BacktestHistoryPlan, strategyId: string, rebalance: RebalanceRule, amount: number, start: number, end: number): BacktestSpec {
  const strategy = plan.strategies.find((candidate) => candidate.id === strategyId);
  if (!strategy) throw new FinancialInputError("Vyber dostupnou strategii.");
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) throw new FinancialInputError("Zvol počáteční rok, který je stejný nebo dřívější než konečný rok.");
  if (start < plan.firstYear || end > plan.lastYear) throw new FinancialInputError(`Historie je k dispozici pro roky ${plan.firstYear}–${plan.lastYear}.`);
  const rule = strategy.spec.rule.kind === "fixed-weights" ? { kind: "fixed-weights" as const, rebalance } : strategy.spec.rule;
  return backtestSpecSchema.parse({ holdings: strategy.spec.holdings, cashWeightBps: strategy.spec.cashWeightBps, rule, startMonth: `${start}-01`, endMonth: `${end}-12`, initialAmount: amount, frequency: "monthly", currency: plan.currency, adjustment: "split-adjusted" });
}

/**
 * Runs one strategy over one or more periods on closes the server loaded itself. Each run is
 * compared with buying and holding the chosen benchmark instrument over the same months, from the
 * same amount, in the same currency and with the same price-only returns.
 */
export async function runHistoryBacktests(service: MarketDataService, plan: BacktestHistoryPlan, request: HistoryBacktestRequest): Promise<HistoryBacktestResult[]> {
  const amount = parsePrice(request.amount, "Počáteční částka");
  if (amount <= 0) throw new FinancialInputError("Počáteční částka musí být větší než nula.");
  const benchmarkInstrument = plan.benchmarks.find((candidate) => candidate.instrumentId === request.benchmark);
  if (!benchmarkInstrument) throw new FinancialInputError("Vyber dostupný benchmark.");
  const comparisons = request.periods.map(({ start, end }) => {
    const spec = specFor(plan, request.strategy, request.rebalance, amount, start, end);
    return backtestComparisonSchema.parse({ strategy: spec, benchmark: buyAndHoldFor(spec, benchmarkInstrument.instrumentId) });
  });
  const sameInstrument = benchmarkInstrument.instrumentId === plan.instrument.instrumentId;
  const [history, otherHistory] = await Promise.all([loadPlanHistory(service, plan, plan.instrument), sameInstrument ? null : loadPlanHistory(service, plan, benchmarkInstrument)]);
  const benchmarkHistory = otherHistory ?? history;
  const strategy = plan.strategies.find((candidate) => candidate.id === request.strategy)!;
  return comparisons.map(({ strategy: spec, benchmark: benchmarkSpec }, index): HistoryBacktestResult => {
    const { start, end } = request.periods[index];
    const lookback = lookbackMonths(spec.rule);
    const aligned = alignMonthlyCloses([{ label: plan.instrument.symbol, points: history.points }], monthRange(addMonths(spec.startMonth, -lookback), spec.endMonth));
    const result = simulateBacktest(spec, aligned);
    const baseMonth = addMonths(spec.startMonth, -1);
    // The benchmark's month-end closes are paired with the strategy's by calendar month.
    const benchmark = simulateBuyAndHold(benchmarkSpec, alignMonthlyCloses([{ label: benchmarkInstrument.symbol, points: benchmarkHistory.points }], monthRange(baseMonth, spec.endMonth)));
    const lastClose = history.points.filter((point) => point.date.startsWith(spec.endMonth)).at(-1)!;
    return {
      config: { source: "history", strategy: strategy.id, benchmark: benchmarkInstrument.instrumentId, start, end, amount: request.amount, rebalance: request.rebalance },
      strategy: { id: strategy.id, name: strategy.name, description: strategy.description },
      benchmarkName: benchmarkName(benchmarkInstrument.symbol),
      currency: history.currency,
      amount,
      metrics: result.metrics,
      benchmark: benchmark.metrics,
      period: `${capitalized(czechMonth(spec.startMonth))} ${start} – ${czechMonth(spec.endMonth)} ${end}`,
      months: result.returns.length,
      points: result.months.map((label, point) => ({ label, value: result.values[point], benchmark: benchmark.values[point] })),
      rebalances: result.rebalanceMonths.length,
      monthsInvested: result.exposure.filter((share) => share > 0).length,
      switches: result.switches,
      source: {
        kind: "history",
        sample: plan.sample || isSample(history.provenance) || isSample(benchmarkHistory.provenance),
        sourceName: plan.sourceName,
        symbol: plan.instrument.symbol,
        instrumentName: plan.instrument.name,
        benchmark: benchmarkInstrument,
        currency: history.currency,
        adjustment: "split-adjusted",
        firstMonth: baseMonth,
        lastMonth: spec.endMonth,
        lastCloseDate: lastClose.date,
        retrievedAt: history.provenance.retrievedAt,
      },
    };
  });
}
