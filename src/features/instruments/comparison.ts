import { commonCloses, returnCorrelation, type AlignedClose, type ReturnCorrelation } from "./correlation";
import { dayNumber, priceMetrics, type PriceMetricObservation, type PriceMetrics } from "./price-metrics";

/**
 * Side-by-side price comparison of two instruments over the dates both traded.
 *
 * The chart, both metric sets and the correlation all use the same common dates
 * (the intersection of the two histories), so they describe the same days. Nothing
 * is forward-filled. Each series stays in its own quote currency without FX; the
 * chart rebases both to 100 on the first common date so different price levels and
 * currencies become comparable as relative change. Closes are split-adjusted, so
 * every number is price-only and excludes dividends.
 */
export type RebasedPoint = { date: string; first: number; second: number };

export type CommonPeriod = { startDate: string; endDate: string; observationCount: number };

export type PriceComparison = {
  /** Null when the histories share no date. */
  commonPeriod: CommonPeriod | null;
  /** The common period starts or ends noticeably inside the requested range (or, for Max, inside the longer history). */
  shorterThanRange: boolean;
  /** Both series rebased to 100 on the first common date; empty without a common date. */
  points: RebasedPoint[];
  /** Price metrics of each instrument over the common dates only. */
  metrics: readonly [PriceMetrics | null, PriceMetrics | null];
  correlation: ReturnCorrelation;
};

/** Weekends, holidays and a provider lagging a day or two stay within this many calendar days of the range edge. */
export const COMMON_PERIOD_TOLERANCE_DAYS = 7;

/** Unrounded index levels: 100 × close ÷ first common close. */
export function rebaseTo100(closes: readonly AlignedClose[]): RebasedPoint[] {
  if (!closes.length) return [];
  const [base] = closes;
  return closes.map((close) => ({ date: close.date, first: (close.first / base.first) * 100, second: (close.second / base.second) * 100 }));
}

/**
 * Expects strictly ascending dates and positive closes in each series, as validated by the history loader.
 * `requested` is the date range of the selected chart range; for "Max" the reference start is the
 * earlier of the two histories instead, because the requested start is a placeholder far in the past.
 */
export function comparePriceHistories(
  first: readonly PriceMetricObservation[],
  second: readonly PriceMetricObservation[],
  requested: { startDate: string; endDate: string; isMax: boolean },
): PriceComparison {
  const closes = commonCloses(first, second);
  const correlation = returnCorrelation(first, second);
  if (!closes.length) return { commonPeriod: null, shorterThanRange: true, points: [], metrics: [null, null], correlation };

  const startDate = closes[0].date;
  const endDate = closes[closes.length - 1].date;
  const referenceStart = requested.isMax && first.length && second.length
    ? (first[0].date < second[0].date ? first[0].date : second[0].date)
    : requested.startDate;
  const shorterThanRange = dayNumber(startDate) - dayNumber(referenceStart) > COMMON_PERIOD_TOLERANCE_DAYS
    || dayNumber(requested.endDate) - dayNumber(endDate) > COMMON_PERIOD_TOLERANCE_DAYS;
  return {
    commonPeriod: { startDate, endDate, observationCount: closes.length },
    shorterThanRange,
    points: rebaseTo100(closes),
    metrics: [
      priceMetrics(closes.map((close) => ({ date: close.date, close: close.first }))),
      priceMetrics(closes.map((close) => ({ date: close.date, close: close.second }))),
    ],
    correlation,
  };
}
