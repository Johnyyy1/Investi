import { simpleReturn } from "@/features/finance/returns";

/**
 * Price-only metrics over split-adjusted daily closes. They never include dividends,
 * so they must not be presented as total return or investment performance.
 * Every metric is null when the observations cannot support it; nothing is filled.
 */
export type PriceMetricObservation = { date: string; close: number };

export type MaxDrawdown = {
  /** Decimal depth, for example -0.334 for a 33.4 % fall. */
  depth: number;
  peakDate: string;
  troughDate: string;
  /** First later observation that closes at or above the peak; null when not recovered. */
  recoveryDate: string | null;
};

export type PriceMetrics = {
  /** First and last observation dates actually present, which may be shorter than the requested range. */
  startDate: string;
  endDate: string;
  observationCount: number;
  spanDays: number;
  /** Decimal simple price return between the first and last close. */
  periodReturn: number | null;
  /** Decimal compound annual price return; null for spans shorter than one year. */
  annualisedReturn: number | null;
  maxDrawdown: MaxDrawdown | null;
  /** Decimal annualised standard deviation of simple returns (√252 scaling). */
  annualisedVolatility: number | null;
};

const DAY_MS = 86_400_000;
const TRADING_DAYS_PER_YEAR = 252;
const MIN_VOLATILITY_RETURNS = 20;
/** Gaps longer than this (in calendar days) are excluded from volatility, not bridged. */
const MAX_VOLATILITY_GAP_DAYS = 4;

function dayNumber(date: string) {
  return Date.parse(`${date}T00:00:00.000Z`) / DAY_MS;
}

function maxDrawdownOf(points: readonly PriceMetricObservation[]): MaxDrawdown | null {
  let peakIndex = 0;
  let worst: { depth: number; peakIndex: number; troughIndex: number } | null = null;
  for (const [index, point] of points.entries()) {
    if (point.close > points[peakIndex].close) peakIndex = index;
    const depth = point.close / points[peakIndex].close - 1;
    if (depth < 0 && (!worst || depth < worst.depth)) worst = { depth, peakIndex, troughIndex: index };
  }
  if (!worst) return null;
  const peakClose = points[worst.peakIndex].close;
  const recovery = points.slice(worst.troughIndex + 1).find((point) => point.close >= peakClose);
  return {
    depth: worst.depth,
    peakDate: points[worst.peakIndex].date,
    troughDate: points[worst.troughIndex].date,
    recoveryDate: recovery?.date ?? null,
  };
}

function annualisedVolatilityOf(points: readonly PriceMetricObservation[]): number | null {
  const returns: number[] = [];
  for (let index = 1; index < points.length; index++) {
    const gap = dayNumber(points[index].date) - dayNumber(points[index - 1].date);
    if (gap > MAX_VOLATILITY_GAP_DAYS) continue;
    returns.push(simpleReturn(points[index - 1].close, points[index].close));
  }
  if (returns.length < MIN_VOLATILITY_RETURNS) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/** Expects strictly ascending dates and positive closes, as validated by the history loader. */
export function priceMetrics(points: readonly PriceMetricObservation[]): PriceMetrics | null {
  if (!points.length) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const spanDays = dayNumber(last.date) - dayNumber(first.date);
  const hasReturn = points.length > 1;
  const periodReturn = hasReturn ? simpleReturn(first.close, last.close) : null;
  const annualisedReturn = hasReturn && spanDays >= 365
    ? Math.pow(last.close / first.close, 365.25 / spanDays) - 1
    : null;
  return {
    startDate: first.date,
    endDate: last.date,
    observationCount: points.length,
    spanDays,
    periodReturn,
    annualisedReturn,
    maxDrawdown: hasReturn ? maxDrawdownOf(points) : null,
    annualisedVolatility: hasReturn ? annualisedVolatilityOf(points) : null,
  };
}
