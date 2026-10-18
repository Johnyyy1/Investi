import type { CalendarDate, Currency, InstrumentId, UtcTimestamp } from "@/features/market-data/contracts";
import type { BacktestMetrics } from "./simulate";
import { FULL_WEIGHT_BPS, type BacktestSpec, type CalendarMonth, type RebalanceRule } from "./spec";

export type BacktestStrategyDefinition = {
  id: string;
  name: string;
  description: string;
  spec: Pick<BacktestSpec, "holdings" | "cashWeightBps"> & { rule: { kind: "fixed-weights" } | { kind: "trend-filter"; smaMonths: number } };
};

export type BacktestPeriodPreset = { id: string; name: string; start: number; end: number };

/**
 * A fixed instrument, year range and strategy list per market-data provider, so every learner
 * runs the same experiments whatever the day of the visit. Real history is not stored in the
 * repository; it is loaded on the server through MarketDataService. On the current FMP plan SPY
 * is the only ETF with history, so the catalog pairs it with cash instead of a bond ETF.
 */
export type BacktestHistoryPlan = {
  instrument: { instrumentId: InstrumentId; symbol: string; name: string };
  /** Expected quote currency; a run in any other currency is refused. Backtests never convert FX. */
  currency: Currency;
  /** Shown before a run: „Historická data · …“ or „Ukázková data · …“. */
  sample: boolean;
  sourceName: string;
  firstYear: number;
  lastYear: number;
  /** One cached request per instrument covers every period, including the trend filter's lookback. */
  fetchStartDate: CalendarDate;
  fetchEndDate: CalendarDate;
  benchmarkName: string;
  strategies: readonly BacktestStrategyDefinition[];
  periods: readonly BacktestPeriodPreset[];
};

const SMA_MONTHS = 10;

function strategies(instrumentId: InstrumentId, symbol: string): BacktestStrategyDefinition[] {
  return [
    {
      id: "mix-60-40",
      name: `${symbol} 60 % + hotovost 40 %`,
      description: `60 % v ${symbol}, 40 % v hotovosti bez úroku. Jak často se mix vrací k vahám, zvolíš níže.`,
      spec: { holdings: [{ instrumentId, weightBps: 6_000 }], cashWeightBps: 4_000, rule: { kind: "fixed-weights" } },
    },
    {
      id: "trend-sma",
      name: `${symbol} s trendovým filtrem`,
      description: `Na konci měsíce porovná uzávěrku ${symbol} s průměrem posledních ${SMA_MONTHS} měsíčních uzávěrek (zhruba 200 obchodních dní). Nad průměrem drží ${symbol}, pod ním hotovost.`,
      spec: { holdings: [{ instrumentId, weightBps: FULL_WEIGHT_BPS }], cashWeightBps: 0, rule: { kind: "trend-filter", smaMonths: SMA_MONTHS } },
    },
  ];
}

export const backtestHistoryPlans = {
  fmp: {
    instrument: { instrumentId: "FMP:AMEX:SPY", symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
    currency: "USD",
    sample: false,
    sourceName: "Financial Modeling Prep",
    firstYear: 2008,
    lastYear: 2025,
    fetchStartDate: "2007-01-01",
    fetchEndDate: "2025-12-31",
    benchmarkName: "Jen SPY",
    strategies: strategies("FMP:AMEX:SPY", "SPY"),
    periods: [
      { id: "all", name: "Celé období", start: 2008, end: 2025 },
      { id: "2008", name: "Finanční krize", start: 2008, end: 2009 },
      { id: "2020", name: "Roky 2020–2021", start: 2020, end: 2021 },
      { id: "2022", name: "Rok 2022", start: 2022, end: 2022 },
    ],
  },
  deterministic: {
    instrument: { instrumentId: "US-XCBO:SPX", symbol: "SPX", name: "Ukázková řada indexu S&P 500" },
    currency: "USD",
    sample: true,
    sourceName: "investi",
    firstYear: 2016,
    lastYear: 2025,
    fetchStartDate: "2015-01-01",
    fetchEndDate: "2025-12-31",
    benchmarkName: "Jen SPX",
    strategies: strategies("US-XCBO:SPX", "SPX"),
    periods: [
      { id: "all", name: "Celá řada", start: 2016, end: 2025 },
      { id: "2020", name: "Řada 2020–2021", start: 2020, end: 2021 },
      { id: "2022", name: "Řada 2022", start: 2022, end: 2022 },
      { id: "recent", name: "Řada 2023–2025", start: 2023, end: 2025 },
    ],
  },
} as const satisfies Record<string, BacktestHistoryPlan>;

/** Plain, client-safe description of where a history run's closes came from. */
export type HistorySource = {
  kind: "history";
  sample: boolean;
  sourceName: string;
  symbol: string;
  instrumentName: string;
  currency: Currency;
  adjustment: "split-adjusted";
  /** Calendar month whose close is the start value, and the last month of the period. */
  firstMonth: CalendarMonth;
  lastMonth: CalendarMonth;
  /** Trading day of the last month-end close used. */
  lastCloseDate: CalendarDate;
  retrievedAt: UtcTimestamp;
};

export type HistoryBacktestConfig = { source: "history"; strategy: string; start: number; end: number; amount: string; rebalance: RebalanceRule };

export type HistoryBacktestResult = {
  config: HistoryBacktestConfig;
  strategy: { id: string; name: string; description: string };
  benchmarkName: string;
  currency: Currency;
  amount: number;
  metrics: BacktestMetrics;
  benchmark: BacktestMetrics;
  period: string;
  months: number;
  points: { label: string; value: number; benchmark: number }[];
  /** Fixed mix: month ends at which it was rebalanced. Trend filter: months held in the instrument and switches. */
  rebalances: number;
  monthsInvested: number;
  switches: number;
  source: HistorySource;
};

/** What the setup form needs before the first run; no prices. */
export type BacktestHistoryView = Pick<BacktestHistoryPlan, "currency" | "sample" | "sourceName" | "firstYear" | "lastYear" | "benchmarkName" | "periods"> & {
  symbol: string;
  instrumentName: string;
  strategies: { id: string; name: string; description: string; kind: "fixed-weights" | "trend-filter" }[];
};

export function historyView(plan: BacktestHistoryPlan): BacktestHistoryView {
  return {
    currency: plan.currency,
    sample: plan.sample,
    sourceName: plan.sourceName,
    firstYear: plan.firstYear,
    lastYear: plan.lastYear,
    benchmarkName: plan.benchmarkName,
    periods: plan.periods,
    symbol: plan.instrument.symbol,
    instrumentName: plan.instrument.name,
    strategies: plan.strategies.map(({ id, name, description, spec }) => ({ id, name, description, kind: spec.rule.kind })),
  };
}
