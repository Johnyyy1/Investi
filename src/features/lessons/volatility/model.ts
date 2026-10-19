import { calculateMaxDrawdown, calculateVolatility } from "@/features/lab/backtest";
import { consecutiveSimpleReturns } from "@/features/finance/returns";

/**
 * Lesson-side arithmetic for the Volatility module. It reuses the Lab's own functions, so a
 * number in a lesson and the same number in the Lab follow one convention: the sample standard
 * deviation (n − 1) of simple returns, annualised by the square root of periods per year.
 */
export const PERIODS_PER_YEAR = { daily: 252, weekly: 52, monthly: 12 } as const;
export type ReturnFrequency = keyof typeof PERIODS_PER_YEAR;

/** Sample standard deviation of one period's returns, before annualising. Decimal in, decimal out. */
export function periodStandardDeviation(returns: readonly number[]) {
  return calculateVolatility(returns, 1);
}

export function annualiseVolatility(periodDeviation: number, frequency: ReturnFrequency) {
  return periodDeviation * Math.sqrt(PERIODS_PER_YEAR[frequency]);
}

/** Every intermediate step of the sample standard deviation, for the step-by-step table. */
export function deviationSteps(returns: readonly number[]) {
  const deviation = periodStandardDeviation(returns);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const rows = returns.map((value) => ({ value, deviation: value - mean, squared: (value - mean) ** 2 }));
  const sumOfSquares = rows.reduce((sum, row) => sum + row.squared, 0);
  return { mean, rows, sumOfSquares, variance: sumOfSquares / (returns.length - 1), deviation, populationDeviation: Math.sqrt(sumOfSquares / returns.length) };
}

export type DrawdownStep = { value: number; peak: number; drawdown: number };
export type DrawdownPath = { steps: DrawdownStep[]; maxDrawdown: { depth: number; peakIndex: number; troughIndex: number; recoveryIndex: number | null } | null };

/** Running peak and the decimal drawdown from it (0 or negative) at each value. */
export function drawdownPath(values: readonly number[]): DrawdownPath {
  calculateMaxDrawdown(values); // Same validation as the Lab: a positive start and no negative values.
  let peakIndex = 0;
  let worst: DrawdownPath["maxDrawdown"] = null;
  const steps = values.map((value, index) => {
    if (value > values[peakIndex]) peakIndex = index;
    const fall = value / values[peakIndex] - 1;
    if (fall < 0 && (!worst || fall < worst.depth)) worst = { depth: fall, peakIndex, troughIndex: index, recoveryIndex: null };
    return { value, peak: values[peakIndex], drawdown: fall };
  });
  const found = worst as DrawdownPath["maxDrawdown"];
  if (found) {
    const recovery = values.findIndex((value, index) => index > found.troughIndex && value >= values[found.peakIndex]);
    found.recoveryIndex = recovery === -1 ? null : recovery;
  }
  return { steps, maxDrawdown: found };
}

/** Two invented paths with the same start and end: one calm, one swinging. Not market data. */
export const volatilityPaths = {
  calm: { label: "Fond Klid", values: [100, 103, 106, 109, 112] },
  swing: { label: "Fond Vlna", values: [100, 115, 95, 120, 112] },
} as const;

export function pathReturns(values: readonly number[]) {
  return consecutiveSimpleReturns(values);
}

/** An invented twelve-month path with one deep drawdown, a partial bounce and a full recovery. */
export const drawdownSample = {
  labels: ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"],
  values: [100, 108, 115, 104, 92, 98, 86, 95, 103, 112, 118, 121],
} as const;
