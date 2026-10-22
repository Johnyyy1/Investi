import { metricsFromValues, type BacktestMetrics } from "@/features/lab/backtest";
import { noTrading, tradeToTargets, type Book, type TradingSummary } from "./costs";
import type { AlignedMonthlyCloses } from "./monthly";
import type { SimulationResult } from "./simulate";
import { BacktestDataError, FULL_WEIGHT_BPS, lookbackMonths, type BacktestSpec, type CalendarMonth, type ExperimentSettings } from "./spec";

export type ExperimentSummary = {
  contributed: number; withdrawn: number; unfundedWithdrawals: number; fundCosts: number;
  gain: number; twr: number; mwr: number | null;
  /** Positive = external contribution; negative = actual withdrawal, at month end. */
  netFlows: number[]; returnIndex: number[];
};

/** Periodic monthly IRR, annualized geometrically. Multiple sign changes are conservatively unavailable. */
export function moneyWeightedReturn(initial: number, netFlows: readonly number[], terminal: number): number | null {
  const flows = [-initial, ...netFlows.map((flow) => -flow)];
  flows[flows.length - 1] += terminal;
  const signs = flows.filter((flow) => flow !== 0).map(Math.sign);
  if (!signs.length) return null;
  const changes = signs.slice(1).filter((sign, index) => sign !== signs[index]).length;
  if (changes === 0) return terminal === 0 && netFlows.every((flow) => flow >= 0) ? -1 : null;
  if (changes !== 1 || !netFlows.length) return null;
  // Annual log growth; scale all exponents to avoid overflow near a total loss.
  const npv = (rate: number) => {
    const offset = Math.max(0, -rate * netFlows.length / 12);
    return flows.reduce((sum, flow, i) => sum + flow * Math.exp(-rate * i / 12 - offset), 0);
  };
  let low = -50, high = 50;
  if (npv(low) <= 0 || npv(high) >= 0) return null;
  for (let i = 0; i < 180; i += 1) {
    const mid = (low + high) / 2;
    if (npv(mid) > 0) low = mid; else high = mid;
  }
  const result = Math.expm1((low + high) / 2);
  return Number.isFinite(result) ? result : null;
}

export const hasExperimentFlows = (spec: ExperimentSettings) => Boolean(spec.contributions?.monthlyAmount || (spec.lumpSumSplit?.months ?? 1) > 1 || spec.annualFundCostBps || (spec.withdrawals && ("monthlyAmount" in spec.withdrawals ? spec.withdrawals.monthlyAmount : spec.withdrawals.annualRate)));
const total = (book: Book) => book.sleeves.reduce((sum, value) => sum + value, book.cash);

/** Sell pro rata only when cash is insufficient; costs reduce what can actually be withdrawn. */
function withdraw(book: Book, requested: number, spec: BacktestSpec, trading: TradingSummary) {
  const held = book.sleeves.reduce((sum, value) => sum + value, 0);
  const positions = book.sleeves.filter((value) => value > 0).length;
  const shortfall = Math.max(0, requested - book.cash);
  const rate = spec.costs.rateBps / FULL_WEIGHT_BPS;
  const fees = positions * spec.costs.fixedFee;
  const sale = shortfall > 0 && held * (1 - rate) > fees ? Math.min(held, (shortfall + fees) / (1 - rate)) : 0;
  const cost = sale > 0 ? sale * rate + fees : 0;
  const available = book.cash + sale - cost;
  const paid = Math.min(requested, available);
  trading.trades += sale > 0 ? positions : 0;
  trading.turnover += sale;
  trading.costs += cost;
  return { book: { sleeves: book.sleeves.map((value) => sale > 0 ? value * (1 - sale / held) : value), cash: Math.max(0, available - paid) }, paid };
}

/** New inputs use the same isolated, floating-point educational model as legacy backtests, never the ledger. */
export function simulateExperiment(spec: BacktestSpec, data: AlignedMonthlyCloses): SimulationResult {
  const base = lookbackMonths(spec.rule) - 1;
  const months = data.months.slice(base), values = [spec.initialAmount], returns: number[] = [], exposure: number[] = [], rebalanceMonths: string[] = [], netFlows: number[] = [];
  const trading = noTrading();
  const count = spec.lumpSumSplit?.months ?? 1;
  let reserve = spec.initialAmount - spec.initialAmount / count;
  let book: Book = { sleeves: spec.holdings.map(() => 0), cash: spec.initialAmount / count };
  let switches = 0, previous: boolean | undefined, contributed = spec.initialAmount, withdrawn = 0, unfundedWithdrawals = 0, fundCosts = 0;
  const weights = spec.holdings.map((holding) => holding.weightBps);
  const target = () => spec.rule.kind === "fixed-weights" ? { weights, cash: spec.cashWeightBps } : { weights: [previous ? FULL_WEIGHT_BPS : 0], cash: previous ? 0 : FULL_WEIGHT_BPS };
  const invest = (amount: number) => {
    if (amount <= 0) return;
    const mix = target();
    const fresh = tradeToTargets({ sleeves: weights.map(() => 0), cash: amount }, mix.weights, mix.cash, spec.costs, trading);
    book = { sleeves: book.sleeves.map((value, i) => value + fresh.sleeves[i]), cash: book.cash + fresh.cash };
  };
  if (spec.rule.kind === "fixed-weights") book = tradeToTargets(book, weights, spec.cashWeightBps, spec.costs, trading);
  const fundFactor = (1 - (spec.annualFundCostBps ?? 0) / FULL_WEIGHT_BPS) ** (1 / 12);
  for (let t = base + 1; t < data.months.length; t += 1) {
    const month = data.months[t], n = t - base, last = t === data.months.length - 1;
    if (spec.rule.kind === "trend-filter") {
      const average = data.closes[0].slice(t - spec.rule.smaMonths, t).reduce((a, b) => a + b, 0) / spec.rule.smaMonths;
      const invested = data.closes[0][t - 1] > average;
      if (previous !== undefined && previous !== invested) switches += 1;
      if (previous !== invested && total(book) > 0) book = tradeToTargets(book, [invested ? FULL_WEIGHT_BPS : 0], invested ? 0 : FULL_WEIGHT_BPS, spec.costs, trading);
      previous = invested;
    }
    exposure.push((book.sleeves.reduce((sum, value) => sum + value, 0)) / (total(book) + reserve || 1));
    book.sleeves = book.sleeves.map((value, i) => {
      const grown = value * data.closes[i][t] / data.closes[i][t - 1];
      fundCosts += grown * (1 - fundFactor);
      return grown * fundFactor;
    });
    const contribution = spec.contributions && month >= (spec.contributions.startMonth ?? spec.startMonth) && month <= (spec.contributions.endMonth ?? spec.endMonth) ? spec.contributions.monthlyAmount : 0;
    const wanted = spec.withdrawals ? "monthlyAmount" in spec.withdrawals ? spec.withdrawals.monthlyAmount : spec.initialAmount * spec.withdrawals.annualRate / 12 : 0;
    // Contributions and withdrawals occur after the month's price move. Reserve is part of capital throughout.
    contributed += contribution;
    book.cash += contribution + reserve;
    const withdrawal = withdraw(book, wanted, spec, trading);
    book = withdrawal.book;
    const paid = withdrawal.paid;
    withdrawn += paid; unfundedWithdrawals += wanted - paid;
    reserve = Math.min(reserve, book.cash);
    book.cash -= reserve;
    const value = total(book) + reserve;
    const before = values.at(-1)!;
    const growth = before > 0 ? (value - contribution + paid) / before - 1 : 0;
    returns.push(Math.max(-1, growth)); values.push(value); netFlows.push(contribution - paid);
    // The final flow stays in cash; there is no pointless final purchase or liquidation.
    if (!last) {
      const fresh = Math.min(contribution, book.cash);
      book.cash -= fresh;
      if (spec.rule.kind === "fixed-weights" && total(book) > 0 && (spec.rule.rebalance === "monthly" || (spec.rule.rebalance === "annual" && month.endsWith("-12")))) {
        book = tradeToTargets(book, weights, spec.cashWeightBps, spec.costs, trading); rebalanceMonths.push(month);
      }
      const release = n < count ? Math.min(reserve, spec.initialAmount / count) : 0;
      reserve -= release;
      invest(release + fresh);
    }
  }
  if ([...values, ...returns, fundCosts, trading.costs].some((value) => !Number.isFinite(value))) throw new BacktestDataError("Výsledek nelze spočítat z dostupných cen.", "incomplete");
  const index = returnIndex(returns);
  const performance = metricsFromValues(index, returns);
  const finalValue = values.at(-1)!;
  return { months, values, returns, exposure, rebalanceMonths, switches, trading,
    metrics: { ...performance, values, finalValue },
    education: { contributed, withdrawn, unfundedWithdrawals, fundCosts, gain: finalValue + withdrawn - contributed, twr: performance.totalReturn, mwr: moneyWeightedReturn(spec.initialAmount, netFlows, finalValue), netFlows, returnIndex: index },
  };
}

function returnIndex(returns: readonly number[]) {
  const values = [1];
  for (const value of returns) values.push(values.at(-1)! * (1 + value));
  return values;
}

export type PerformanceWindow = { startMonth: string; endMonth: string; months: number; startValue: number; metrics: BacktestMetrics; mwr: number | null };
export type SplitPerformance = { inSample: PerformanceWindow; outOfSample: PerformanceWindow };
/** One continuous run, no reset or re-optimized rule at the boundary. */
export function splitSimulation(result: SimulationResult, split: CalendarMonth): SplitPerformance {
  const cut = result.months.indexOf(split) - 1;
  if (cut < 2 || result.returns.length - cut < 2) throw new BacktestDataError("Každá část rozděleného období potřebuje alespoň dva měsíce.", "incomplete");
  const window = (first: number, last: number): PerformanceWindow => {
    const returns = result.returns.slice(first, last), values = result.values.slice(first, last + 1);
    return { startMonth: result.months[first + 1], endMonth: result.months[last], months: returns.length, startValue: values[0], metrics: { ...metricsFromValues(returnIndex(returns), returns), values, finalValue: values.at(-1)! }, mwr: moneyWeightedReturn(values[0], result.education?.netFlows.slice(first, last) ?? returns.map(() => 0), values.at(-1)!) };
  };
  return { inSample: window(0, cut), outOfSample: window(cut, result.returns.length) };
}
