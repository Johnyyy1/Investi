import { z } from "zod";
import type { AdjustmentMode } from "@/features/market-data/contracts";

/** Calendar month, YYYY-MM. Each month is represented by its last close. */
export type CalendarMonth = string;

export const rebalanceRules = ["none", "monthly", "annual"] as const;
export type RebalanceRule = (typeof rebalanceRules)[number];

/** Weights are integer basis points, so a mix always sums exactly to 100 %. */
export const FULL_WEIGHT_BPS = 10_000;

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const adjustmentModes = ["raw", "split-adjusted", "total-return"] as const satisfies readonly AdjustmentMode[];

const holdingSchema = z.object({
  instrumentId: z.string().min(1).max(80),
  weightBps: z.number().int().min(1).max(FULL_WEIGHT_BPS),
});

const ruleSchema = z.discriminatedUnion("kind", [
  /** Fixed target weights; between rebalances the sleeves drift with their prices. */
  z.object({ kind: z.literal("fixed-weights"), rebalance: z.enum(rebalanceRules) }),
  /**
   * Hold the single instrument in a month only when the previous month-end close was above its
   * simple moving average of the last `smaMonths` month-end closes; otherwise hold cash.
   */
  z.object({ kind: z.literal("trend-filter"), smaMonths: z.number().int().min(2).max(24) }),
]);

/**
 * A complete, frozen description of one backtest. The server builds it from a fixed strategy
 * catalog; nothing in it is a price, a value or a result.
 */
export const backtestSpecSchema = z.object({
  holdings: z.array(holdingSchema).min(1).max(4),
  /** Remainder held as cash, which earns nothing. */
  cashWeightBps: z.number().int().min(0).max(FULL_WEIGHT_BPS),
  rule: ruleSchema,
  /** First month whose return counts; the start value is the previous month's close. */
  startMonth: monthSchema,
  endMonth: monthSchema,
  initialAmount: z.number().finite().positive().max(1e12),
  frequency: z.literal("monthly"),
  /** Quote currency of every holding. Backtests never convert FX. */
  currency: currencySchema,
  /** Split-adjusted closes are price-only: dividends are excluded, never silently mixed in. */
  adjustment: z.literal("split-adjusted"),
}).superRefine((spec, context) => {
  const total = spec.holdings.reduce((sum, holding) => sum + holding.weightBps, spec.cashWeightBps);
  if (total !== FULL_WEIGHT_BPS) context.addIssue({ code: "custom", path: ["holdings"], message: "Weights must sum to 100 %." });
  if (new Set(spec.holdings.map((holding) => holding.instrumentId)).size !== spec.holdings.length) context.addIssue({ code: "custom", path: ["holdings"], message: "Each instrument may appear once." });
  if (spec.startMonth > spec.endMonth) context.addIssue({ code: "custom", path: ["startMonth"], message: "The start month must not be after the end month." });
  if (spec.rule.kind === "trend-filter" && (spec.holdings.length !== 1 || spec.cashWeightBps !== 0)) context.addIssue({ code: "custom", path: ["rule"], message: "A trend filter switches one instrument between 100 % and cash." });
});

export type BacktestSpec = z.infer<typeof backtestSpecSchema>;
export type BacktestRule = BacktestSpec["rule"];

/**
 * Buy and hold one instrument: a single purchase at the start value, then no rebalancing and no
 * trades. The adjustment is any market-data mode so that a mismatch is refused, not impossible.
 */
export const buyAndHoldBenchmarkSchema = z.object({
  kind: z.literal("buy-and-hold"),
  instrumentId: z.string().min(1).max(80),
  startMonth: monthSchema,
  endMonth: monthSchema,
  initialAmount: z.number().finite().positive().max(1e12),
  frequency: z.literal("monthly"),
  currency: currencySchema,
  adjustment: z.enum(adjustmentModes),
});

export type BuyAndHoldBenchmark = z.infer<typeof buyAndHoldBenchmarkSchema>;

/**
 * A strategy and its benchmark are comparable only on the same period, starting amount, currency
 * and return semantics. Price-only and total-return paths are never compared with each other.
 */
export const backtestComparisonSchema = z.object({ strategy: backtestSpecSchema, benchmark: buyAndHoldBenchmarkSchema }).superRefine(({ strategy, benchmark }, context) => {
  const issue = (field: keyof BuyAndHoldBenchmark, message: string) => context.addIssue({ code: "custom", path: ["benchmark", field], message });
  if (benchmark.startMonth !== strategy.startMonth || benchmark.endMonth !== strategy.endMonth) issue("startMonth", "The benchmark must cover the same period as the strategy.");
  if (benchmark.initialAmount !== strategy.initialAmount) issue("initialAmount", "The benchmark must start with the same amount as the strategy.");
  if (benchmark.currency !== strategy.currency) issue("currency", "The benchmark must be in the same currency as the strategy.");
  if (benchmark.adjustment !== strategy.adjustment) issue("adjustment", "The benchmark must use the same return semantics as the strategy.");
});

/** The benchmark that buys and holds `instrumentId` over the strategy's own period, amount, currency and semantics. */
export function buyAndHoldFor(strategy: BacktestSpec, instrumentId: string): BuyAndHoldBenchmark {
  const { startMonth, endMonth, initialAmount, frequency, currency, adjustment } = strategy;
  return { kind: "buy-and-hold", instrumentId, startMonth, endMonth, initialAmount, frequency, currency, adjustment };
}

/** History that is missing, incomplete or inconsistent. It is reported, never filled. */
export class BacktestDataError extends Error {
  constructor(message: string, readonly reason: "unavailable" | "incomplete" | "insufficient-lookback") {
    super(message);
    this.name = "BacktestDataError";
  }
}

export function addMonths(month: CalendarMonth, count: number): CalendarMonth {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + count;
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
}

/** Inclusive, ascending list of calendar months. */
export function monthRange(first: CalendarMonth, last: CalendarMonth): CalendarMonth[] {
  const months: CalendarMonth[] = [];
  for (let month = first; month <= last; month = addMonths(month, 1)) months.push(month);
  return months;
}

/** Month-end closes needed before the start value: one for the start itself, more for an SMA. */
export function lookbackMonths(rule: BacktestRule) {
  return rule.kind === "trend-filter" ? rule.smaMonths : 1;
}
