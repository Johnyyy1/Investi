import { parseNumericAnswer } from "@/features/finance/numeric-input";

/** Educational monthly estimate in Kč, not persistent portfolio money or an investment recommendation.
 * Annual costs are spread over 12 months; no rounding before the presentation boundary.
 */
export function monthlyBudget(income: number, fixed: number, variable: number, annual: number) {
  if ([income, fixed, variable, annual].some((value) => !Number.isFinite(value) || value < 0 || value > 1_000_000_000)) {
    throw new Error("Zadej nezáporné částky nejvýše 1 000 000 000 Kč.");
  }
  const monthlyIrregular = annual / 12;
  const expenses = fixed + variable + monthlyIrregular;
  const surplus = income - expenses;
  return { monthlyIrregular, expenses, surplus, savingsRate: income === 0 ? null : surplus / income };
}

export function parseBudgetAmount(raw: string) {
  const value = parseNumericAnswer(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1_000_000_000 ? value : null;
}
