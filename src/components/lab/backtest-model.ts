import { portfolioWeightedReturn } from "@/features/finance/foundations";
import { parsePrice } from "@/features/finance/returns";
import { calculateBacktestMetrics, selectMonthlySample, type MonthlyObservation } from "@/features/lab/backtest";
import { syntheticMonthlyData } from "@/features/lab/sample-data";
import type { HistoryBacktestResult } from "@/features/backtesting/catalog";
import type { Currency } from "@/features/market-data/contracts";
import { formatCurrency, formatDecimal, formatPercentage } from "@/lib/formatters";

export const backtestStrategies = [
  { id: "mixed", name: "Mix 60 / 30 / 10", description: "60 % akcií, 30 % dluhopisů a 10 % hotovosti.", weights: [0.6, 0.3, 0.1] },
  { id: "stocks", name: "100 % akciový vzorek", description: "Celá částka v syntetickém akciovém vzorku.", weights: [1, 0, 0] },
  { id: "bonds", name: "100 % dluhopisový vzorek", description: "Celá částka v syntetickém dluhopisovém vzorku.", weights: [0, 1, 0] },
] as const;
export const backtestPeriods = [
  { id: "all", name: "Celý vzorek", start: 2015, end: 2025 },
  { id: "2020", name: "Vzorek 2020–2021", start: 2020, end: 2021 },
  { id: "2022", name: "Vzorek 2022", start: 2022, end: 2022 },
  { id: "recent", name: "Vzorek 2023–2025", start: 2023, end: 2025 },
] as const;
export const backtestYears = Array.from({ length: 11 }, (_, index) => 2015 + index);
export type BacktestPrediction = "strategy" | "benchmark" | "unknown";
export type BacktestConfig = { strategy: string; start: number; end: number; amount: string };
export type ComparisonPoint = { label: string; value: number; benchmark: number };
/** The synthetic sample's benchmark B: the stock sample bought once and held. */
export const sampleBenchmarkName = "Buy-and-hold akciového vzorku";

/** Presentation snapshot only. All arithmetic and data validation stay in the existing domain. */
export function buildBacktestResult(config: BacktestConfig, data: readonly MonthlyObservation[] = syntheticMonthlyData) {
  const rows = selectMonthlySample(data, config.start, config.end);
  const strategy = backtestStrategies.find((item) => item.id === config.strategy);
  if (!strategy) throw new Error("Vyber dostupný vzorek.");
  const amount = parsePrice(config.amount, "Počáteční částka");
  const metrics = calculateBacktestMetrics(amount, rows.map((row) => portfolioWeightedReturn(strategy.weights, [row.stocks, row.bonds, row.cash])));
  const benchmark = calculateBacktestMetrics(amount, rows.map((row) => row.stocks));
  const labels = [`${config.start - 1}-12`, ...rows.map((row) => row.month)];
  return {
    config: { ...config }, strategy, amount, metrics, benchmark,
    source: { kind: "sample" } as const, benchmarkName: sampleBenchmarkName, currency: "CZK" as Currency,
    period: `Leden ${config.start} – prosinec ${config.end}`,
    months: rows.length,
    points: labels.map((label, index): ComparisonPoint => ({ label, value: metrics.values[index], benchmark: benchmark.values[index] })),
  };
}
export type SampleBacktestResult = ReturnType<typeof buildBacktestResult>;
/** Either the synthetic sample (computed in the browser) or a price-history run (computed on the server). */
export type BacktestResult = (SampleBacktestResult | HistoryBacktestResult) & { prediction?: BacktestPrediction };
export function formatBacktestMoney(value: number, currency: Currency = "CZK") {
  return formatCurrency(value, currency, { maximumFractionDigits: Math.abs(value) < 1000 ? 2 : 0 });
}
/** Signed difference A − B; zero has no sign. */
export function formatBacktestMoneyDifference(value: number, currency: Currency = "CZK") {
  return formatCurrency(value, currency, { maximumFractionDigits: Math.abs(value) < 1000 ? 2 : 0, signDisplay: "exceptZero" });
}
/** Signed difference of two ratios in percentage points: 0.0123 is „+1,23 p. b.“; unsigned, „1,23 p. b.“. */
export function formatPercentagePoints(value: number, { signed = true } = {}) {
  return `${formatDecimal(value * 100, { maximumFractionDigits: 2, signDisplay: signed ? "exceptZero" : "auto" })} p. b.`;
}
/** Sharpe ratio to two decimals. An undefined ratio is shown as unavailable, never as 0. */
export function formatSharpeRatio(value: number | null) {
  return value === null ? "Nedostupné" : formatDecimal(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** Signed difference A − B of two Sharpe ratios; unavailable when either one is. */
export function formatSharpeDifference(strategy: number | null, benchmark: number | null) {
  return strategy === null || benchmark === null ? "Nedostupné" : formatDecimal(strategy - benchmark, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
}
/** A cost rate in basis points as a percentage: 10 is „0,1 %“. */
export function formatCostRate(rateBps: number) {
  return formatPercentage(rateBps / 10_000);
}
/** Which run a result with costs shows: with them (the default) or the same closes without them. */
export type CostView = "with" | "without";
export function viewWithCosts(result: BacktestResult, view: CostView): BacktestResult {
  if (view === "with" || result.source.kind !== "history" || !("withoutCosts" in result) || !result.withoutCosts) return result;
  const { metrics, benchmark, points, education, split } = result.withoutCosts;
  return { ...result, metrics, benchmark, points, education, split };
}
export function formatBacktestMonth(month: string) {
  return new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}
