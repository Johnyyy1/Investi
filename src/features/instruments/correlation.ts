import { simpleReturn } from "@/features/finance/returns";
import { dayNumber, MAX_VOLATILITY_GAP_DAYS, type PriceMetricObservation } from "./price-metrics";

/**
 * Pearson correlation of simple price returns (never of prices) of two instruments.
 *
 * Each series stays in its own quote currency: this is not a correlation in CZK and
 * applies no FX. Closes are split-adjusted, so dividends are not included.
 *
 * Alignment uses only the dates both series traded; nothing is forward-filled.
 * - daily: returns between consecutive common dates. A gap longer than
 *   MAX_VOLATILITY_GAP_DAYS is excluded, not bridged, as for volatility.
 * - weekly: returns between the last common date of consecutive ISO weeks (Monday
 *   to Sunday, UTC). A week with no common date is excluded, not bridged. Weekly
 *   returns soften the mismatch of exchanges that close at different hours, for
 *   example XNAS and XETR, where same-date daily closes are hours apart.
 *
 * The coefficient is unrounded; presentation rounds it.
 */
export type CorrelationFrequency = "daily" | "weekly";

export type ReturnCorrelation =
  | {
      status: "ok";
      /** Unrounded Pearson coefficient in [−1, 1]. */
      coefficient: number;
      /** Number of paired returns used. */
      observationCount: number;
      /** Start of the first and end of the last paired return interval. */
      startDate: string;
      endDate: string;
      frequency: CorrelationFrequency;
    }
  | {
      /** Too few paired returns, or one series has no variation (zero volatility). */
      status: "insufficient-data" | "no-variation";
      coefficient: null;
      observationCount: number;
      /** Null when no paired return exists. */
      startDate: string | null;
      endDate: string | null;
      frequency: CorrelationFrequency;
    };

/** Fewer paired returns than this give no coefficient, never 0. */
export const MIN_CORRELATION_OBSERVATIONS = 20;
/** Return dispersion at or below this counts as no variation; real daily returns vary far more. */
const MIN_RETURN_DEVIATION = 1e-12;

export type AlignedClose = { date: string; first: number; second: number };
type PairedReturn = { startDate: string; endDate: string; first: number; second: number };

/** Closes on the dates both series traded, in the first series' order; nothing is forward-filled. */
export function commonCloses(first: readonly PriceMetricObservation[], second: readonly PriceMetricObservation[]): AlignedClose[] {
  const secondByDate = new Map(second.map((point) => [point.date, point.close]));
  return first.flatMap((point) => {
    const close = secondByDate.get(point.date);
    return close === undefined ? [] : [{ date: point.date, first: point.close, second: close }];
  });
}

/** Monday-based week number; 1970-01-01 (day 0) was a Thursday. */
function weekNumber(date: string) {
  return Math.floor((dayNumber(date) + 3) / 7);
}

function lastClosePerWeek(closes: readonly AlignedClose[]): AlignedClose[] {
  return closes.filter((close, index) => index === closes.length - 1 || weekNumber(closes[index + 1].date) !== weekNumber(close.date));
}

function pairedReturns(closes: readonly AlignedClose[], frequency: CorrelationFrequency): PairedReturn[] {
  const points = frequency === "weekly" ? lastClosePerWeek(closes) : closes;
  const returns: PairedReturn[] = [];
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    const bridgesGap = frequency === "weekly"
      ? weekNumber(current.date) - weekNumber(previous.date) > 1
      : dayNumber(current.date) - dayNumber(previous.date) > MAX_VOLATILITY_GAP_DAYS;
    if (bridgesGap) continue;
    returns.push({
      startDate: previous.date,
      endDate: current.date,
      first: simpleReturn(previous.first, current.first),
      second: simpleReturn(previous.second, current.second),
    });
  }
  return returns;
}

/** Expects strictly ascending dates and positive closes in each series, as validated by the history loader. */
export function returnCorrelation(
  first: readonly PriceMetricObservation[],
  second: readonly PriceMetricObservation[],
  frequency: CorrelationFrequency = "daily",
): ReturnCorrelation {
  const returns = pairedReturns(commonCloses(first, second), frequency);
  const window = {
    observationCount: returns.length,
    startDate: returns[0]?.startDate ?? null,
    endDate: returns.at(-1)?.endDate ?? null,
    frequency,
  };
  if (returns.length < MIN_CORRELATION_OBSERVATIONS) return { status: "insufficient-data", coefficient: null, ...window };
  const coefficient = pearsonCorrelation(returns.map((value) => value.first), returns.map((value) => value.second));
  if (coefficient === null) return { status: "no-variation", coefficient: null, ...window };
  return { status: "ok", coefficient, observationCount: returns.length, startDate: returns[0].startDate, endDate: returns[returns.length - 1].endDate, frequency };
}

/**
 * Pearson coefficient of two equally long, already paired series; null when either has no
 * variation. It applies no minimum length: returnCorrelation adds that for market data, while
 * lessons use it on short invented series so their numbers follow the Lab's arithmetic.
 */
export function pearsonCorrelation(first: readonly number[], second: readonly number[]): number | null {
  if (first.length !== second.length) throw new RangeError("Both series need the same number of values.");
  if (first.length < 2) return null;
  const meanFirst = first.reduce((sum, value) => sum + value, 0) / first.length;
  const meanSecond = second.reduce((sum, value) => sum + value, 0) / second.length;
  let covariance = 0;
  let varianceFirst = 0;
  let varianceSecond = 0;
  for (const [index, value] of first.entries()) {
    const deviationFirst = value - meanFirst;
    const deviationSecond = second[index] - meanSecond;
    covariance += deviationFirst * deviationSecond;
    varianceFirst += deviationFirst ** 2;
    varianceSecond += deviationSecond ** 2;
  }
  const degreesOfFreedom = first.length - 1;
  if (Math.sqrt(varianceFirst / degreesOfFreedom) <= MIN_RETURN_DEVIATION || Math.sqrt(varianceSecond / degreesOfFreedom) <= MIN_RETURN_DEVIATION) return null;
  // The n−1 factors cancel; the clamp only removes floating-point overshoot such as 1.0000000000000002.
  return Math.min(1, Math.max(-1, covariance / Math.sqrt(varianceFirst * varianceSecond)));
}
