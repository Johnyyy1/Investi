import type { CalendarDate, Currency, InstrumentId, UtcTimestamp } from "@/features/market-data/contracts";
import type { BacktestMetrics } from "@/features/lab/backtest";
import type { TradingSummary } from "./costs";
import { FULL_WEIGHT_BPS, type BacktestCosts, type BacktestSpec, type CalendarMonth, type RebalanceRule } from "./spec";

export type BacktestStrategyDefinition = {
  id: string;
  name: string;
  description: string;
  spec: Pick<BacktestSpec, "holdings" | "cashWeightBps"> & { rule: { kind: "fixed-weights" } | { kind: "trend-filter"; smaMonths: number } };
};

export type BacktestPeriodPreset = { id: string; name: string; start: number; end: number };

export type BacktestInstrument = { instrumentId: InstrumentId; symbol: string; name: string };

/**
 * A fixed instrument, year range and strategy list per market-data provider, so every learner
 * runs the same experiments whatever the day of the visit. Real history is not stored in the
 * repository; it is loaded on the server through MarketDataService. On the current FMP plan SPY
 * is the only ETF with history, so the catalog pairs it with cash instead of a bond ETF. The
 * single stocks with history (AAPL, NVDA) are offered only as alternative benchmarks.
 */
export type BacktestHistoryPlan = {
  instrument: BacktestInstrument;
  /**
   * Instruments the learner can buy and hold as benchmark B; the first is the default. Each must
   * have history for the whole window in the plan's currency, or the run is refused.
   */
  benchmarks: readonly BacktestInstrument[];
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
  strategies: readonly BacktestStrategyDefinition[];
  periods: readonly BacktestPeriodPreset[];
};

const SMA_MONTHS = 10;

/** Benchmark B's name everywhere in the UI. */
export const benchmarkName = (symbol: string) => `Buy-and-hold ${symbol}`;

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
    benchmarks: [
      { instrumentId: "FMP:AMEX:SPY", symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
      { instrumentId: "FMP:NASDAQ:AAPL", symbol: "AAPL", name: "Apple Inc." },
      { instrumentId: "FMP:NASDAQ:NVDA", symbol: "NVDA", name: "NVIDIA Corporation" },
    ],
    currency: "USD",
    sample: false,
    sourceName: "Financial Modeling Prep",
    firstYear: 2008,
    lastYear: 2025,
    fetchStartDate: "2007-01-01",
    fetchEndDate: "2025-12-31",
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
    benchmarks: [
      { instrumentId: "US-XCBO:SPX", symbol: "SPX", name: "Ukázková řada indexu S&P 500" },
      { instrumentId: "US-XNAS:NVDA", symbol: "NVDA", name: "Ukázková řada akcie NVIDIA" },
    ],
    currency: "USD",
    sample: true,
    sourceName: "Investník",
    firstYear: 2016,
    lastYear: 2025,
    fetchStartDate: "2015-01-01",
    fetchEndDate: "2025-12-31",
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
  /** Benchmark B's instrument; its closes went through the same checks as the strategy's. */
  benchmark: BacktestInstrument;
  currency: Currency;
  adjustment: "split-adjusted";
  /** Calendar month whose close is the start value, and the last month of the period. */
  firstMonth: CalendarMonth;
  lastMonth: CalendarMonth;
  /** Trading day of the last month-end close used. */
  lastCloseDate: CalendarDate;
  retrievedAt: UtcTimestamp;
};

/** Costs as typed by the learner: a percentage of each trade and a flat fee per trade. */
export type CostSettings = { rate: string; fixedFee: string };

/** `costs` echoes the learner's input; null means the run had no costs. */
export type HistoryBacktestConfig = { source: "history"; strategy: string; benchmark: InstrumentId; start: number; end: number; amount: string; rebalance: RebalanceRule; costs: CostSettings | null };

type CurvePoint = { label: string; value: number; benchmark: number };

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
  /** With costs when the run had any; `metrics`, `benchmark` and `points` always describe the same run. */
  points: CurvePoint[];
  /** The costs per trade the run paid; zero when it ran without costs. */
  costs: BacktestCosts;
  trading: { strategy: TradingSummary; benchmark: TradingSummary };
  /** The same closes simulated without costs; null when the run had none. */
  withoutCosts: { metrics: BacktestMetrics; benchmark: BacktestMetrics; points: CurvePoint[] } | null;
  /** Fixed mix: month ends at which it was rebalanced. Trend filter: months held in the instrument and switches. */
  rebalances: number;
  monthsInvested: number;
  switches: number;
  source: HistorySource;
};

/** What the setup form needs before the first run; no prices. */
export type BacktestHistoryView = Pick<BacktestHistoryPlan, "currency" | "sample" | "sourceName" | "firstYear" | "lastYear" | "benchmarks" | "periods"> & {
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
    benchmarks: plan.benchmarks,
    periods: plan.periods,
    symbol: plan.instrument.symbol,
    instrumentName: plan.instrument.name,
    strategies: plan.strategies.map(({ id, name, description, spec }) => ({ id, name, description, kind: spec.rule.kind })),
  };
}
