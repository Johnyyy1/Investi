import { calculateCagr, calculateMaxDrawdown, calculateVolatility } from "@/features/lab/backtest";
import type { AlignedMonthlyCloses } from "./monthly";
import { addMonths, BacktestDataError, FULL_WEIGHT_BPS, lookbackMonths, monthRange, type BacktestSpec, type BuyAndHoldBenchmark, type CalendarMonth } from "./spec";

export type BacktestMetrics = { values: number[]; finalValue: number; cagr: number; maxDrawdown: number; volatility: number };

export type SimulationResult = {
  /** The start month's predecessor (start value) followed by every month of the period. */
  months: CalendarMonth[];
  /** Portfolio value at each month end, starting with the initial amount. */
  values: number[];
  /** Simple monthly portfolio returns; one per period month. */
  returns: number[];
  /** Share of the portfolio held in instruments during each period month, decided at the previous close. */
  exposure: number[];
  /** Month ends at which the mix was brought back to its target weights. */
  rebalanceMonths: CalendarMonth[];
  /** How often a trend filter moved between the instrument and cash. */
  switches: number;
  metrics: BacktestMetrics;
};

const MONTHS_PER_YEAR = 12;

/** Final value, CAGR (months ÷ 12 years), drawdown on month-end values and annualized monthly volatility. */
export function metricsFromValues(values: readonly number[], returns: readonly number[]): BacktestMetrics {
  const finalValue = values.at(-1)!;
  return {
    values: [...values],
    finalValue,
    cagr: calculateCagr(values[0], finalValue, returns.length / MONTHS_PER_YEAR),
    maxDrawdown: calculateMaxDrawdown(values),
    volatility: calculateVolatility(returns, MONTHS_PER_YEAR),
  };
}

function expectShape(spec: BacktestSpec, data: AlignedMonthlyCloses) {
  const expected = monthRange(addMonths(spec.startMonth, -lookbackMonths(spec.rule)), spec.endMonth);
  if (data.months.length !== expected.length || data.months.some((month, index) => month !== expected[index])) {
    throw new BacktestDataError("Měsíční řada neodpovídá zvolenému období.", "incomplete");
  }
  if (data.closes.length !== spec.holdings.length || data.closes.some((row) => row.length !== expected.length || row.some((close) => !Number.isFinite(close) || close <= 0))) {
    throw new BacktestDataError("Měsíční uzávěrky chybí nebo nejsou platné.", "incomplete");
  }
  return expected;
}

/**
 * Month-by-month simulation without look-ahead: the value at month t uses closes up to t, and a
 * trend-filter decision for month t uses closes up to t − 1. No costs, taxes, dividends, interest
 * on cash or further contributions.
 */
export function simulateBacktest(spec: BacktestSpec, data: AlignedMonthlyCloses): SimulationResult {
  const months = expectShape(spec, data);
  const { closes } = data;
  const base = lookbackMonths(spec.rule) - 1;
  const initial = spec.initialAmount;
  const values = [initial], returns: number[] = [], exposure: number[] = [], rebalanceMonths: CalendarMonth[] = [];
  let switches = 0;

  if (spec.rule.kind === "fixed-weights") {
    const { rebalance } = spec.rule;
    const weights = spec.holdings.map((holding) => holding.weightBps / FULL_WEIGHT_BPS);
    const cashWeight = spec.cashWeightBps / FULL_WEIGHT_BPS;
    let sleeves = weights.map((weight) => initial * weight);
    let cash = initial * cashWeight;
    for (let t = base + 1; t < months.length; t += 1) {
      const before = values.at(-1)!;
      exposure.push(sleeves.reduce((sum, value) => sum + value, 0) / before);
      sleeves = sleeves.map((value, index) => value * (closes[index][t] / closes[index][t - 1]));
      const value = sleeves.reduce((sum, sleeve) => sum + sleeve, cash);
      values.push(value);
      returns.push(value / before - 1);
      const last = t === months.length - 1;
      if (!last && (rebalance === "monthly" || (rebalance === "annual" && months[t].endsWith("-12")))) {
        sleeves = weights.map((weight) => value * weight);
        cash = value * cashWeight;
        rebalanceMonths.push(months[t]);
      }
    }
  } else {
    const { smaMonths } = spec.rule;
    const series = closes[0];
    let previous: boolean | undefined;
    for (let t = base + 1; t < months.length; t += 1) {
      const window = series.slice(t - smaMonths, t);
      const average = window.reduce((sum, close) => sum + close, 0) / smaMonths;
      const invested = series[t - 1] > average;
      if (previous !== undefined && previous !== invested) switches += 1;
      previous = invested;
      const before = values.at(-1)!;
      const value = invested ? before * (series[t] / series[t - 1]) : before;
      exposure.push(invested ? 1 : 0);
      values.push(value);
      returns.push(value / before - 1);
    }
  }
  if (values.some((value) => !Number.isFinite(value))) throw new BacktestDataError("Výsledek nelze spočítat z dostupných cen.", "incomplete");
  return { months: months.slice(base), values, returns, exposure, rebalanceMonths, switches, metrics: metricsFromValues(values, returns) };
}

/**
 * Buy and hold: the whole amount buys the benchmark at the start value's close and is never
 * rebalanced or traded. It runs through the same month-by-month simulation as a strategy, so a
 * strategy that holds the same instrument at 100 % without rebalancing produces the same curve.
 */
export function simulateBuyAndHold(benchmark: BuyAndHoldBenchmark, data: AlignedMonthlyCloses): SimulationResult {
  if (benchmark.adjustment !== "split-adjusted") throw new BacktestDataError("Benchmark musí mít stejnou sémantiku výnosu jako strategie: jen cenu bez dividend.", "incomplete");
  const { instrumentId, startMonth, endMonth, initialAmount, frequency, currency, adjustment } = benchmark;
  const spec: BacktestSpec = { holdings: [{ instrumentId, weightBps: FULL_WEIGHT_BPS }], cashWeightBps: 0, rule: { kind: "fixed-weights", rebalance: "none" }, startMonth, endMonth, initialAmount, frequency, currency, adjustment };
  return simulateBacktest(spec, data);
}
