import { compoundPeriods, FinancialInputError } from "@/features/finance/returns";
import { drawdownFromPeak } from "@/features/finance/foundations";

function positive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new FinancialInputError(`${label} musí být větší než nula.`);
}
export function calculateCagr(start: number, end: number, years: number) {
  positive(start, "Počáteční hodnota"); positive(years, "Doba trvání");
  if (!Number.isFinite(end) || end < 0) throw new FinancialInputError("Konečná hodnota musí být nezáporná.");
  const value = (end / start) ** (1 / years) - 1;
  if (!Number.isFinite(value)) throw new FinancialInputError("CAGR je pro výpočet příliš vysoký.");
  return value;
}
/** Positive loss magnitude, sampled at the supplied observations, including the initial value. */
export function calculateMaxDrawdown(values: readonly number[]) {
  positive(values[0], "Počáteční hodnota");
  let peak = values[0], maximum = 0;
  for (const value of values) { peak = Math.max(peak, value); maximum = Math.max(maximum, drawdownFromPeak(peak, value)); }
  return maximum;
}
/** Sample standard deviation of simple periodic returns, annualized by sqrt(periodsPerYear). */
export function calculateVolatility(returns: readonly number[], periodsPerYear: number) {
  positive(periodsPerYear, "Počet období za rok");
  if (returns.length < 2 || returns.some((value) => !Number.isFinite(value) || value < -1)) throw new FinancialInputError("Jsou potřeba alespoň dva platné výnosy.");
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const volatility = Math.sqrt(variance * periodsPerYear);
  if (!Number.isFinite(volatility)) throw new FinancialInputError("Volatilita je pro výpočet příliš vysoká.");
  return volatility;
}
/** Change over the whole period, not annualized: 0.25 means +25 % from start to end. */
export function calculateTotalReturn(start: number, end: number) {
  positive(start, "Počáteční hodnota");
  if (!Number.isFinite(end) || end < 0) throw new FinancialInputError("Konečná hodnota musí být nezáporná.");
  return end / start - 1;
}
/**
 * Annual risk-free rate the Sharpe ratio subtracts. 0 % matches the backtest itself, where cash
 * earns no interest; it is a stated simplification, not a market rate.
 */
export const BACKTEST_RISK_FREE_RATE = 0;
/**
 * Annualized mean periodic excess return ÷ annualized sample standard deviation (n − 1) of the
 * excess returns, i.e. mean ÷ deviation × √periodsPerYear. The annual risk-free rate is spread
 * geometrically: (1 + rate)^(1 / periodsPerYear) − 1 per period. Fewer than one year of returns,
 * or returns that never vary, give null: the ratio is undefined then, not infinite or zero.
 */
export function calculateSharpeRatio(returns: readonly number[], periodsPerYear: number, riskFreeRate = BACKTEST_RISK_FREE_RATE) {
  positive(periodsPerYear, "Počet období za rok");
  if (!Number.isFinite(riskFreeRate) || riskFreeRate <= -1) throw new FinancialInputError("Bezriziková sazba musí být větší než −100 %.");
  if (returns.some((value) => !Number.isFinite(value) || value < -1)) throw new FinancialInputError("Výnosy musí být platná čísla.");
  if (returns.length < Math.max(2, periodsPerYear) || returns.every((value) => value === returns[0])) return null;
  const periodRate = (1 + riskFreeRate) ** (1 / periodsPerYear) - 1;
  const excess = returns.map((value) => value - periodRate);
  const mean = excess.reduce((sum, value) => sum + value, 0) / excess.length;
  const deviation = Math.sqrt(excess.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (excess.length - 1));
  const ratio = mean / deviation * Math.sqrt(periodsPerYear);
  return deviation > 0 && Number.isFinite(ratio) ? ratio : null;
}
export function calculateGrowthSeries(initial: number, returns: readonly number[]) {
  const values = [initial, ...compoundPeriods(initial, returns).map((period) => period.endValue)];
  if (values.some((value) => !Number.isFinite(value))) throw new FinancialInputError("Růst je pro výpočet příliš vysoký.");
  return values;
}
export type BacktestMetrics = {
  values: number[];
  finalValue: number;
  /** Whole period, not annualized. */
  totalReturn: number;
  /** Annualized. */
  cagr: number;
  maxDrawdown: number;
  /** Annualized. */
  volatility: number;
  /** Annualized; null when undefined (see calculateSharpeRatio). */
  sharpeRatio: number | null;
  /** The annual rate sharpeRatio subtracted. */
  riskFreeRate: number;
};
/** Metrics of a value path: values[0] is the start, and returns[i] leads from values[i] to values[i + 1]. */
export function metricsFromValues(values: readonly number[], returns: readonly number[], periodsPerYear = 12): BacktestMetrics {
  const finalValue = values.at(-1)!;
  return {
    values: [...values],
    finalValue,
    totalReturn: calculateTotalReturn(values[0], finalValue),
    cagr: calculateCagr(values[0], finalValue, returns.length / periodsPerYear),
    maxDrawdown: calculateMaxDrawdown(values),
    volatility: calculateVolatility(returns, periodsPerYear),
    sharpeRatio: calculateSharpeRatio(returns, periodsPerYear, BACKTEST_RISK_FREE_RATE),
    riskFreeRate: BACKTEST_RISK_FREE_RATE,
  };
}
export function calculateBacktestMetrics(initial: number, returns: readonly number[], periodsPerYear = 12) {
  return metricsFromValues(calculateGrowthSeries(initial, returns), returns, periodsPerYear);
}
export type MonthlyObservation = { month: string; stocks: number; bonds: number; cash: number };
export function selectMonthlySample(data: readonly MonthlyObservation[], startYear: number, endYear: number) {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) throw new FinancialInputError("Zvol počáteční rok, který je stejný nebo dřívější než konečný rok.");
  const selected = data.filter((row) => row.month >= `${startYear}-01` && row.month <= `${endYear}-12`);
  if (selected.length !== (endYear - startYear + 1) * 12) throw new FinancialInputError("Datová sada musí pro toto období obsahovat úplná měsíční pozorování.");
  selected.forEach((row, index) => {
    const month = `${startYear + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
    if (row.month !== month || [row.stocks, row.bonds, row.cash].some((value) => !Number.isFinite(value) || value < -1)) throw new FinancialInputError("Datová sada obsahuje chybějící, duplicitní, neseřazená nebo neplatná pozorování.");
  });
  return selected;
}
