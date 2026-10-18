import "server-only";

import { FinancialInputError, parsePrice } from "@/features/finance/returns";
import { chartPoints } from "@/features/instruments/history";
import { adjustmentPolicies } from "@/features/market-data/contracts";
import type { MarketDataService } from "@/features/market-data/service";
import type { BacktestHistoryPlan, HistoryBacktestResult } from "./catalog";
import { alignMonthlyCloses } from "./monthly";
import { fromMonth, simulateBacktest } from "./simulate";
import { addMonths, backtestSpecSchema, BacktestDataError, FULL_WEIGHT_BPS, lookbackMonths, monthRange, type BacktestSpec, type RebalanceRule } from "./spec";

export type HistoryBacktestRequest = { strategy: string; rebalance: RebalanceRule; amount: string; periods: readonly { start: number; end: number }[] };

const czechMonth = (month: string) => new Intl.DateTimeFormat("cs-CZ", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const capitalized = (value: string) => value.charAt(0).toLocaleUpperCase("cs-CZ") + value.slice(1);

/** Loads the plan's whole window once per run; every period is then cut from the same closes. */
async function loadPlanHistory(service: MarketDataService, plan: BacktestHistoryPlan) {
  const { instrumentId } = plan.instrument;
  const request = { instrumentId, startDate: plan.fetchStartDate, endDate: plan.fetchEndDate, interval: "daily" as const, timeZone: "UTC" as const, adjustment: adjustmentPolicies["split-adjusted"] };
  const [instrument, series] = await Promise.all([service.getInstrumentMetadata(instrumentId), service.getHistoricalPrices(request)]);
  const points = series.instrumentId === instrumentId && series.currency === instrument.quoteCurrency && series.currency === plan.currency ? chartPoints(series, request.startDate, request.endDate) : [];
  if (!points.length) throw new BacktestDataError(`Cenová historie ${plan.instrument.symbol} není v očekávaném tvaru. Backtest jsme nespustili.`, "unavailable");
  return { points, currency: instrument.quoteCurrency, provenance: series.provenance };
}

function specFor(plan: BacktestHistoryPlan, strategyId: string, rebalance: RebalanceRule, amount: number, start: number, end: number): BacktestSpec {
  const strategy = plan.strategies.find((candidate) => candidate.id === strategyId);
  if (!strategy) throw new FinancialInputError("Vyber dostupnou strategii.");
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) throw new FinancialInputError("Zvol počáteční rok, který je stejný nebo dřívější než konečný rok.");
  if (start < plan.firstYear || end > plan.lastYear) throw new FinancialInputError(`Historie je k dispozici pro roky ${plan.firstYear}–${plan.lastYear}.`);
  const rule = strategy.spec.rule.kind === "fixed-weights" ? { kind: "fixed-weights" as const, rebalance } : strategy.spec.rule;
  return backtestSpecSchema.parse({ holdings: strategy.spec.holdings, cashWeightBps: strategy.spec.cashWeightBps, rule, startMonth: `${start}-01`, endMonth: `${end}-12`, initialAmount: amount, frequency: "monthly", adjustment: "split-adjusted" });
}

/**
 * Runs one strategy over one or more periods on closes the server loaded itself. Each run is
 * compared with buying and holding the same instrument from the same start value.
 */
export async function runHistoryBacktests(service: MarketDataService, plan: BacktestHistoryPlan, request: HistoryBacktestRequest): Promise<HistoryBacktestResult[]> {
  const amount = parsePrice(request.amount, "Počáteční částka");
  if (amount <= 0) throw new FinancialInputError("Počáteční částka musí být větší než nula.");
  const specs = request.periods.map(({ start, end }) => specFor(plan, request.strategy, request.rebalance, amount, start, end));
  const history = await loadPlanHistory(service, plan);
  const strategy = plan.strategies.find((candidate) => candidate.id === request.strategy)!;
  return specs.map((spec, index): HistoryBacktestResult => {
    const { start, end } = request.periods[index];
    const lookback = lookbackMonths(spec.rule);
    const aligned = alignMonthlyCloses([{ label: plan.instrument.symbol, points: history.points }], monthRange(addMonths(spec.startMonth, -lookback), spec.endMonth));
    const result = simulateBacktest(spec, aligned);
    const baseMonth = addMonths(spec.startMonth, -1);
    const benchmarkSpec: BacktestSpec = { ...spec, holdings: [{ instrumentId: plan.instrument.instrumentId, weightBps: FULL_WEIGHT_BPS }], cashWeightBps: 0, rule: { kind: "fixed-weights", rebalance: "none" } };
    const benchmark = simulateBacktest(benchmarkSpec, fromMonth(aligned, baseMonth, [0]));
    const lastClose = history.points.filter((point) => point.date.startsWith(spec.endMonth)).at(-1)!;
    return {
      config: { source: "history", strategy: strategy.id, start, end, amount: request.amount, rebalance: request.rebalance },
      strategy: { id: strategy.id, name: strategy.name, description: strategy.description },
      benchmarkName: plan.benchmarkName,
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
        sample: plan.sample || history.provenance.isDeterministic || history.provenance.dataKind !== "historical",
        sourceName: plan.sourceName,
        symbol: plan.instrument.symbol,
        instrumentName: plan.instrument.name,
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
