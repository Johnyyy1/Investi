import { portfolioWeightedReturn, validatePortfolioWeights } from "@/features/finance/foundations";
import { FinancialInputError } from "@/features/finance/returns";
export const portfolioAssets = [
  { id: "stocks", label: "Akcie", color: "bg-primary" },
  { id: "bonds", label: "Dluhopisy", color: "bg-warning" },
  { id: "cash", label: "Hotovost", color: "bg-success" },
] as const;
/** Sliders redistribute the remainder proportionally, so exploring never breaks the 100% total. */
export function rebalanceAllocation(weights: readonly number[], index: number, percentage: number) {
  validatePortfolioWeights(weights.map((value) => value / 100));
  if (!Number.isInteger(index) || index < 0 || index >= weights.length || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new FinancialInputError("Rozložení musí být od 0 % do 100 %.");
  const remainder = 100 - percentage;
  const others = weights.reduce((sum, value, i) => sum + (i === index ? 0 : value), 0);
  const result = weights.map((value, i) => i === index ? percentage : others > 0 ? remainder * value / others : remainder / (weights.length - 1));
  const last = weights.length - 1 === index ? weights.length - 2 : weights.length - 1;
  result[last] += 100 - result.reduce((sum, value) => sum + value, 0);
  return result;
}
export function portfolioScenario(weights: readonly number[], returns: readonly number[], initial: number) {
  if (!Number.isFinite(initial) || initial <= 0) throw new FinancialInputError("Počáteční částka musí být větší než nula.");
  if (returns.some((value) => value < -1)) throw new FinancialInputError("Výnos nemůže být nižší než −100 %.");
  const returnValue = portfolioWeightedReturn(weights, returns);
  const finalValue = initial * (1 + returnValue);
  if (!Number.isFinite(finalValue)) throw new FinancialInputError("Výsledek je příliš vysoký. Použij menší hodnoty.");
  return { returnValue, finalValue, change: finalValue - initial, contributions: weights.map((weight, index) => weight * returns[index]), largestWeight: Math.max(...weights) };
}
