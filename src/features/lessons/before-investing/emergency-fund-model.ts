import { parseNumericAnswer } from "@/features/finance/numeric-input";

/** Educational one-year estimate in Kč, never portfolio accounting. Rates are decimal fractions.
 * Assumes a constant balance/rate and one interest payment; excludes fees and compounding within the year.
 */
export function emergencyFundEstimate(expenses: number, months: number, nominal: number, inflation: number, tax: number) {
  if (!Number.isFinite(expenses) || expenses < 0 || expenses > 1_000_000_000 ||
      !Number.isFinite(months) || months < 1 || months > 36 ||
      !Number.isFinite(nominal) || nominal < 0 || nominal > 1 ||
      !Number.isFinite(inflation) || inflation <= -1 || inflation > 10 ||
      !Number.isFinite(tax) || tax < 0 || tax > 1) throw new Error("Invalid emergency fund inputs.");
  const netNominal = nominal * (1 - tax);
  return { target: expenses * months, netNominal, realBeforeTax: (1 + nominal) / (1 + inflation) - 1, realAfterTax: (1 + netNominal) / (1 + inflation) - 1 };
}

export function parseEmergencyInput(raw: string, min: number, max: number) {
  const value = parseNumericAnswer(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

/** Typed server-resolved inputs, with their scope and freshness; never parse formatted fact tokens. */
export type EmergencyFundFacts = {
  inflation: DatedRate;
  tax: DatedRate;
};
type DatedRate = { rate: number; label: string; period: string; verifiedAt: string; stale: boolean; source: { title: string; url: string } };
