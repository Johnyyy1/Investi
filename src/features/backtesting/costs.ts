import { FinancialInputError } from "@/features/finance/returns";
import type { BacktestMetrics } from "@/features/lab/backtest";
import { FULL_WEIGHT_BPS, MAX_COST_RATE_BPS, MAX_FIXED_FEE, type BacktestCosts } from "./spec";

/** Instrument sleeves and cash, in the spec's currency. */
export type Book = { sleeves: number[]; cash: number };

/** What the trades of one run cost: trades counted per instrument, turnover as traded value. */
export type TradingSummary = { trades: number; turnover: number; costs: number };

export const noTrading = (): TradingSummary => ({ trades: 0, turnover: 0, costs: 0 });

/** A trade smaller than this share of the portfolio is floating-point noise, not a trade. */
const NOISE = 1e-12;

/**
 * Brings a book to target weights and pays the costs out of it. After the trade the book sits
 * exactly at the target weights of what is left, so the costs satisfy
 * value − after = rate × Σ |traded value| + fixedFee × trades.
 *
 * For a known direction d (+1 buy, −1 sell, 0 none) of each trade the value after costs is
 * (value + rate × Σ d·sleeve − fixedFee × trades) ÷ (1 + rate × Σ d·weight). The directions are
 * read at the value before costs and re-read at the value after them until they stop changing.
 * With zero costs the book is rebalanced exactly as without a cost model. Adds the trades, their
 * traded value and their costs to `summary`.
 */
export function tradeToTargets(book: Book, weightsBps: readonly number[], cashWeightBps: number, costs: BacktestCosts, summary: TradingSummary): Book {
  const value = book.sleeves.reduce((sum, sleeve) => sum + sleeve, book.cash);
  const weights = weightsBps.map((weight) => weight / FULL_WEIGHT_BPS);
  const cashWeight = cashWeightBps / FULL_WEIGHT_BPS;
  const rate = costs.rateBps / FULL_WEIGHT_BPS;
  const directions = (total: number) => weights.map((weight, index) => {
    const trade = total * weight - book.sleeves[index];
    return Math.abs(trade) <= value * NOISE ? 0 : Math.sign(trade);
  });
  const settle = (sides: number[]) => {
    const trades = sides.filter(Boolean).length;
    const held = sides.reduce((sum, side, index) => sum + side * book.sleeves[index], 0);
    const targeted = sides.reduce((sum, side, index) => sum + side * weights[index], 0);
    const after = (value + rate * held - costs.fixedFee * trades) / (1 + rate * targeted);
    if (!(after > 0)) throw new FinancialInputError("Náklady obchodů by spotřebovaly celé portfolio. Sniž poplatky nebo zvyš počáteční částku.");
    return after;
  };
  let sides = directions(value);
  for (let step = 0; step < weights.length; step += 1) {
    const next = directions(settle(sides));
    if (next.every((side, index) => side === sides[index])) break;
    sides = next;
  }
  const after = settle(sides);
  const sleeves = weights.map((weight) => after * weight);
  summary.trades += sides.filter(Boolean).length;
  summary.turnover += sides.reduce((sum, side, index) => sum + (side === 0 ? 0 : Math.abs(sleeves[index] - book.sleeves[index])), 0);
  summary.costs += value - after;
  return { sleeves, cash: after * cashWeight };
}

const decimal = /^(\d+)(?:[.,](\d+))?$/;

/** Reads a percentage such as „0,1“ or „0.25“ as integer basis points, without floating point. */
export function parseCostRate(value: string) {
  const match = decimal.exec(value.trim());
  if (value.trim() === "") throw new FinancialInputError("Pole „Poplatek z objemu“ je povinné. Bez poplatku zadej 0.");
  if (!match || (match[2]?.length ?? 0) > 2) throw new FinancialInputError("Poplatek z objemu zadej v procentech, nejvýš na dvě desetinná místa, např. 0,1.");
  const bps = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (bps > MAX_COST_RATE_BPS) throw new FinancialInputError(`Poplatek z objemu může být nejvýš ${MAX_COST_RATE_BPS / 100} %.`);
  return bps;
}

/** Reads a flat fee per trade such as „1,50“, in the backtest's currency. */
export function parseFixedFee(value: string) {
  const match = decimal.exec(value.trim());
  if (value.trim() === "") throw new FinancialInputError("Pole „Fixní poplatek za obchod“ je povinné. Bez poplatku zadej 0.");
  if (!match || (match[2]?.length ?? 0) > 2) throw new FinancialInputError("Fixní poplatek zadej jako částku, nejvýš na dvě desetinná místa, např. 1,50.");
  const fee = Number(`${match[1]}.${match[2] ?? "0"}`);
  if (fee > MAX_FIXED_FEE) throw new FinancialInputError(`Fixní poplatek může být nejvýš ${MAX_FIXED_FEE} za obchod.`);
  return fee;
}

/**
 * How costs changed one path: with costs minus without. Money for the final value, ratios for
 * returns, a plain difference for the Sharpe ratio (null when either side is undefined).
 */
export function costImpact(withCosts: BacktestMetrics, withoutCosts: BacktestMetrics) {
  return {
    finalValue: withCosts.finalValue - withoutCosts.finalValue,
    totalReturn: withCosts.totalReturn - withoutCosts.totalReturn,
    cagr: withCosts.cagr - withoutCosts.cagr,
    sharpeRatio: withCosts.sharpeRatio === null || withoutCosts.sharpeRatio === null ? null : withCosts.sharpeRatio - withoutCosts.sharpeRatio,
  };
}
