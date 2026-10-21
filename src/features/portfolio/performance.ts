import { roundDivide } from "./decimal";

export const PERFORMANCE_DAY_MS = 86_400_000;
const RATE_SCALE = 1_000_000_000_000_000n;
export type PerformanceReason = "missing-valuation" | "no-capital" | "no-period" | "invalid-ledger" | "zero-boundary" | "no-solution";
export type PerformanceMetric =
  | { status: "available"; basisPoints: string; annualizedBasisPoints: string | null }
  | { status: "unavailable"; reason: PerformanceReason };
export interface Contribution { at: string; amountMinor: bigint }
export interface PortfolioPerformance {
  startedAt: string;
  endedAt: string;
  twr: PerformanceMetric;
  mwr: PerformanceMetric;
  twrMethod: "cash-flow-boundaries" | "prior-daily-close-estimate";
}
export const unavailablePerformance = (reason: PerformanceReason): PerformanceMetric => ({ status: "unavailable", reason });

/** Resets contribute the entire saved entitlement once, at generation opening. */
export function generationContributions(openedAt: string, openingCapitalMinor: bigint, receipts: readonly Contribution[]): Contribution[] {
  const grouped = new Map<string, bigint>();
  // Separate transactions can share JS millisecond timestamps. Any receipt at
  // opening not yet in the saved baseline joins that same instant's contribution.
  const atOpening = receipts.filter(({ at }) => at === openedAt).reduce((sum, { amountMinor }) => sum + amountMinor, 0n);
  const byOpening = receipts.filter(({ at }) => at <= openedAt).reduce((sum, { amountMinor }) => sum + amountMinor, 0n);
  const extraAtOpening = byOpening - openingCapitalMinor;
  const initial = openingCapitalMinor + (extraAtOpening > 0n && extraAtOpening <= atOpening ? extraAtOpening : 0n);
  if (initial > 0n) grouped.set(openedAt, initial);
  for (const receipt of receipts) {
    if (receipt.at > openedAt && receipt.amountMinor > 0n) grouped.set(receipt.at, (grouped.get(receipt.at) ?? 0n) + receipt.amountMinor);
  }
  return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([at, amountMinor]) => ({ at, amountMinor }));
}

function metricFromGrowth(growth: bigint, days: number): PerformanceMetric {
  if (!Number.isFinite(days) || days <= 0) return unavailablePerformance("no-period");
  if (!Number.isFinite(Number(growth))) return unavailablePerformance("no-solution");
  const rate = growth - RATE_SCALE;
  const annualized = days >= 365 ? Math.expm1(Math.log(Number(growth) / Number(RATE_SCALE)) * 365 / days) : null;
  if (annualized !== null && !Number.isFinite(annualized)) return unavailablePerformance("no-solution");
  return {
    status: "available",
    basisPoints: roundDivide(rate * 10_000n, RATE_SCALE).toString(),
    annualizedBasisPoints: annualized === null ? null : roundDivide(BigInt(Math.round(annualized * Number(RATE_SCALE))) * 10_000n, RATE_SCALE).toString(),
  };
}

function metricFromRatio(numerator: bigint, denominator: bigint, days: number): PerformanceMetric {
  const growth = roundDivide(numerator * RATE_SCALE, denominator);
  // Do not turn a small positive residual value into a total loss, especially
  // when annualization would magnify the difference over long periods.
  return growth === 0n && numerator > 0n ? unavailablePerformance("no-solution") : metricFromGrowth(growth, days);
}

/** Geometrically link returns before each external contribution. Trades are internal. */
export function timeWeightedReturn(
  openingMinor: bigint,
  boundaries: readonly { amountMinor: bigint; valueBeforeMinor: bigint | null }[],
  endingMinor: bigint | null,
  days: number,
): PerformanceMetric {
  if (endingMinor === null || boundaries.some(({ valueBeforeMinor }) => valueBeforeMinor === null)) return unavailablePerformance("missing-valuation");
  if (openingMinor <= 0n) return unavailablePerformance("no-capital");
  if (endingMinor < 0n || boundaries.some(({ amountMinor, valueBeforeMinor }) => amountMinor < 0n || valueBeforeMinor! < 0n)) return unavailablePerformance("invalid-ledger");
  // Exact rational products; round once at the return boundary, never monetary inputs.
  let numerator = 1n, denominator = 1n, after = openingMinor;
  for (const boundary of boundaries) {
    if (boundary.valueBeforeMinor === 0n) return unavailablePerformance("zero-boundary");
    numerator *= boundary.valueBeforeMinor!;
    denominator *= after;
    const divisor = gcd(numerator, denominator);
    numerator /= divisor;
    denominator /= divisor;
    after = boundary.valueBeforeMinor! + boundary.amountMinor;
  }
  return metricFromRatio(numerator * endingMinor, denominator * after, days);
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/**
 * Dated IRR for the personal portfolio's contributions-only contract. Solve in log
 * growth over the whole period, so short periods never require explosive annualization.
 * Positive contributions and one terminal value make the equation monotonic.
 * Only dimensionless ratios enter floating-point exponentiation, never money.
 */
export function moneyWeightedReturn(flows: readonly Contribution[], endedAt: string, endingMinor: bigint | null): PerformanceMetric {
  if (endingMinor === null) return unavailablePerformance("missing-valuation");
  if (endingMinor < 0n || flows.some(({ at, amountMinor }) => amountMinor < 0n || !Number.isFinite(Date.parse(at)) || Date.parse(at) > Date.parse(endedAt))) return unavailablePerformance("invalid-ledger");
  const contributions = flows.filter(({ amountMinor }) => amountMinor > 0n).toSorted((a, b) => a.at.localeCompare(b.at));
  if (!contributions.length) return unavailablePerformance("no-capital");
  const duration = Date.parse(endedAt) - Date.parse(contributions[0].at);
  if (!Number.isFinite(duration) || duration <= 0) return unavailablePerformance("no-period");
  const days = duration / PERFORMANCE_DAY_MS;
  const total = contributions.reduce((sum, { amountMinor }) => sum + amountMinor, 0n);
  if (contributions.length === 1) return metricFromRatio(endingMinor, total, days);
  const terminalContributions = contributions.filter(({ at }) => Date.parse(at) === Date.parse(endedAt)).reduce((sum, { amountMinor }) => sum + amountMinor, 0n);
  if (endingMinor < terminalContributions) return unavailablePerformance("no-solution");
  if (endingMinor === terminalContributions) return metricFromGrowth(0n, days);
  const earlier = contributions.filter(({ at }) => Date.parse(at) < Date.parse(endedAt));
  if (earlier.length === 1) return metricFromRatio(endingMinor - terminalContributions, earlier[0].amountMinor, days);
  const normalizer = total > endingMinor ? total : endingMinor;
  const ratio = (minor: bigint) => Number(roundDivide(minor * RATE_SCALE, normalizer)) / Number(RATE_SCALE);
  const terms = contributions.map(({ at, amountMinor }) => ({ weight: ratio(amountMinor), time: (Date.parse(endedAt) - Date.parse(at)) / duration }));
  const residual = (logGrowth: number) => terms.reduce((sum, term) => sum + term.weight * Math.exp(logGrowth * term.time), 0) - ratio(endingMinor);
  let low = -36, high = 36;
  if (residual(low) > 0 || residual(high) < 0) return unavailablePerformance("no-solution");
  for (let iteration = 0; iteration < 200; iteration++) {
    const middle = (low + high) / 2;
    const value = residual(middle);
    if (!Number.isFinite(value)) return unavailablePerformance("no-solution");
    if (Math.abs(value) < 1e-13 || high - low < 1e-13) {
      const growth = BigInt(Math.round(Math.exp(middle) * Number(RATE_SCALE)));
      return growth === 0n ? unavailablePerformance("no-solution") : metricFromGrowth(growth, days);
    }
    if (value > 0) high = middle;
    else low = middle;
  }
  return unavailablePerformance("no-solution");
}
