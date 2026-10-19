import { DEFAULT_SIMULATION_BLOCK_MONTHS, DEFAULT_SIMULATION_PATHS, DEFAULT_SIMULATION_SEED, monthlyReturnsOf, simulateFuturePaths, type SimulationMonth, type SimulationResult } from "@/features/backtesting/monte-carlo";
import { FinancialInputError, parsePrice } from "@/features/finance/returns";
import type { Currency } from "@/features/market-data/contracts";
import { formatDecimal } from "@/lib/formatters";
import { formatBacktestMoney } from "./backtest-model";

export const simulationHorizons = [1, 3, 5, 10, 15, 20] as const;
export type SimulationHorizon = (typeof simulationHorizons)[number];
export const DEFAULT_SIMULATION_HORIZON: SimulationHorizon = 10;

export type SimulationConfig = { years: SimulationHorizon; amount: string; contribution: string; seed: number };
export type SimulationView = SimulationResult & { config: SimulationConfig; years: SimulationHorizon; amount: number; contribution: number };
/** A chart row: the band edges as [low, high] pairs next to the single values. */
export type FanRow = SimulationMonth & { outer: [number, number]; inner: [number, number] };

export const defaultSimulationConfig = (amount: string): SimulationConfig => ({ years: DEFAULT_SIMULATION_HORIZON, amount, contribution: "0", seed: DEFAULT_SIMULATION_SEED });

/** Draws the future paths from the month-end values of strategy A's backtest path. */
export function buildSimulation(values: readonly number[], config: SimulationConfig): SimulationView {
  const amount = parsePrice(config.amount, "Vklad na začátku");
  const contribution = config.contribution.trim() === "" ? 0 : parsePrice(config.contribution, "Měsíční vklad");
  if (!(simulationHorizons as readonly number[]).includes(config.years)) throw new FinancialInputError("Vyber dostupný horizont.");
  const result = simulateFuturePaths({
    returns: monthlyReturnsOf(values),
    initialAmount: amount,
    monthlyContribution: contribution,
    horizonMonths: config.years * 12,
    paths: DEFAULT_SIMULATION_PATHS,
    blockMonths: DEFAULT_SIMULATION_BLOCK_MONTHS,
    seed: config.seed,
  });
  return { ...result, config: { ...config }, years: config.years, amount, contribution };
}

export const fanRows = (result: SimulationResult): FanRow[] => result.months.map((row) => ({ ...row, outer: [row.p5, row.p95], inner: [row.p25, row.p75] }));

/** The start, the end of every year and the horizon: what the accessible table lists. */
export const yearlyRows = (result: SimulationResult) => result.months.filter((row) => row.month % 12 === 0 || row.month === result.months.length - 1);

export const formatYears = (years: number) => years === 1 ? "1 rok" : years < 5 ? `${years} roky` : `${years} let`;
/** „Start“, „Rok 3“ or „Rok 2, měsíc 5“ for a month counted from the start. */
export function formatSimulationMonth(month: number) {
  if (month === 0) return "Start";
  const year = Math.floor(month / 12), rest = month % 12;
  return rest === 0 ? `Rok ${year}` : year === 0 ? `Měsíc ${rest}` : `Rok ${year}, měsíc ${rest}`;
}
export const formatPaths = (paths: number) => formatDecimal(paths, { maximumFractionDigits: 0 });

/** The text alternative of the fan chart: the middle path and the ranges at the horizon. */
export function simulationSummary(result: SimulationView, currency: Currency) {
  const last = result.months.at(-1)!;
  const money = (value: number) => formatBacktestMoney(value, currency);
  return `Simulace ${formatPaths(result.paths)} cest. Za ${formatYears(result.years)} je prostřední cesta (medián) ${money(last.p50)}. Polovina cest skončila mezi ${money(last.p25)} a ${money(last.p75)}, 90 % cest mezi ${money(last.p5)} a ${money(last.p95)}. Vloženo celkem ${money(last.contributed)}.`;
}
