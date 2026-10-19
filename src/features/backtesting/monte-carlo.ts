import { FinancialInputError } from "@/features/finance/returns";

/** Percentiles every simulated month reports, from the low edge of the range to the high one. */
export const SIMULATION_PERCENTILES = [5, 25, 50, 75, 95] as const;
export type SimulationPercentile = (typeof SIMULATION_PERCENTILES)[number];

/** Fewer months than this give too few distinct blocks to draw from. */
export const MIN_SIMULATION_HISTORY_MONTHS = 24;
export const MAX_SIMULATION_HORIZON_MONTHS = 240;
export const MAX_SIMULATION_PATHS = 10_000;
/** Months drawn together, so calm and turbulent stretches of the history stay in one piece. */
export const DEFAULT_SIMULATION_BLOCK_MONTHS = 6;
export const DEFAULT_SIMULATION_PATHS = 1_000;
export const DEFAULT_SIMULATION_SEED = 20_260_201;

export type SimulationSpec = {
  /** Simple monthly returns of the history the paths are drawn from, in order. */
  returns: readonly number[];
  initialAmount: number;
  /** Added at the end of every simulated month, after that month's return. */
  monthlyContribution: number;
  horizonMonths: number;
  paths: number;
  blockMonths: number;
  seed: number;
};

/** One month of the fan: month 0 is the start, before any return or contribution. */
export type SimulationMonth = { month: number; contributed: number } & Record<`p${SimulationPercentile}`, number>;

export type SimulationResult = {
  months: SimulationMonth[];
  /** Every path's value at the horizon, ascending. */
  finalValues: number[];
  paths: number;
  historyMonths: number;
  blockMonths: number;
  seed: number;
};

/** Mulberry32: a small 32-bit generator. The same seed always yields the same sequence in [0, 1). */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Linear interpolation between the closest ranks of ascending values (numpy's default). */
export function percentileOf(sorted: ArrayLike<number>, percentile: number) {
  if (!sorted.length) throw new FinancialInputError("Percentil prázdného souboru nelze spočítat.");
  const rank = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(rank), upper = Math.ceil(rank);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

function validate(spec: SimulationSpec) {
  const { returns, initialAmount, monthlyContribution, horizonMonths, paths, blockMonths, seed } = spec;
  if (returns.length < MIN_SIMULATION_HISTORY_MONTHS) throw new FinancialInputError(`Simulace potřebuje alespoň ${MIN_SIMULATION_HISTORY_MONTHS} měsíců historie. Zvol delší období backtestu.`);
  if (returns.some((value) => !Number.isFinite(value) || value < -1)) throw new FinancialInputError("Historické výnosy obsahují neplatnou hodnotu.");
  if (!Number.isFinite(initialAmount) || initialAmount <= 0) throw new FinancialInputError("Vklad na začátku musí být větší než nula.");
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) throw new FinancialInputError("Měsíční vklad nesmí být záporný.");
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > MAX_SIMULATION_HORIZON_MONTHS) throw new FinancialInputError(`Horizont musí být 1 až ${MAX_SIMULATION_HORIZON_MONTHS} měsíců.`);
  if (!Number.isInteger(paths) || paths < 2 || paths > MAX_SIMULATION_PATHS) throw new FinancialInputError(`Počet cest musí být 2 až ${MAX_SIMULATION_PATHS}.`);
  if (!Number.isInteger(blockMonths) || blockMonths < 1 || blockMonths > returns.length) throw new FinancialInputError("Délka bloku musí být alespoň 1 měsíc a nejvýš délka historie.");
  if (!Number.isInteger(seed)) throw new FinancialInputError("Seed musí být celé číslo.");
}

/**
 * Circular block bootstrap of the history's monthly returns. Each path is built from blocks of
 * `blockMonths` consecutive historical months; a block starts at a uniformly drawn month and wraps
 * around from the last month to the first. Every month a path's value is multiplied by
 * 1 + the drawn return, and then the contribution is added. No costs, taxes or inflation beyond
 * what the history's returns already contain.
 *
 * The result describes the spread of paths the history allows, not a forecast: it assumes the
 * future is built from the same months as the past.
 */
export function simulateFuturePaths(spec: SimulationSpec): SimulationResult {
  validate(spec);
  const { returns, initialAmount, monthlyContribution, horizonMonths, paths, blockMonths, seed } = spec;
  const random = seededRandom(seed);
  const values = new Float64Array(paths).fill(initialAmount);
  // Where each path is in its current block; a new block is drawn when `left` reaches zero.
  const cursor = new Int32Array(paths), left = new Int32Array(paths);
  const sorted = new Float64Array(paths);
  const months: SimulationMonth[] = [];
  const record = (month: number) => {
    sorted.set(values);
    sorted.sort();
    const row = { month, contributed: initialAmount + monthlyContribution * month } as SimulationMonth;
    for (const percentile of SIMULATION_PERCENTILES) row[`p${percentile}`] = percentileOf(sorted, percentile);
    months.push(row);
  };
  record(0);
  for (let month = 1; month <= horizonMonths; month += 1) {
    for (let path = 0; path < paths; path += 1) {
      if (left[path] === 0) {
        cursor[path] = Math.floor(random() * returns.length);
        left[path] = blockMonths;
      }
      values[path] = values[path] * (1 + returns[cursor[path]]) + monthlyContribution;
      cursor[path] = (cursor[path] + 1) % returns.length;
      left[path] -= 1;
    }
    record(month);
  }
  if (!sorted.every(Number.isFinite)) throw new FinancialInputError("Simulované hodnoty jsou pro výpočet příliš vysoké.");
  return { months, finalValues: Array.from(sorted), paths, historyMonths: returns.length, blockMonths, seed };
}

/** Simple returns between consecutive values: values[i] → values[i + 1]. */
export function monthlyReturnsOf(values: readonly number[]) {
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) throw new FinancialInputError("Historické hodnoty musí být kladná čísla.");
  return values.slice(1).map((value, index) => value / values[index] - 1);
}
