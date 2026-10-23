import { parseNumericAnswer } from "@/features/finance/numeric-input";

/** Reviewed domain spec of the 2026 rules behind lesson 0.1.5, in whole Kč and integer percent.
 * pension-and-dip.test.ts pins it to every registry version of dps.statni_prispevek, dps.odpocet and zam.prispevek.
 * shortcut: the 20 % rate and the 1 700 Kč deduction threshold have no numeric fact yet; add them before publication.
 */
export const pensionRules = { statePercent: 20, minMonthly: 500, capMonthly: 1700, sharedDeductionAnnual: 48000, taxPercent: 15 } as const;

/** Monthly state contribution to DPS for one month's own contribution. */
export function stateContribution(monthly: number) {
  return monthly < pensionRules.minMonthly ? 0 : Math.min(monthly, pensionRules.capMonthly) * pensionRules.statePercent / 100;
}

/** Annual deduction from a constant monthly DPS contribution plus annual DIP contributions, capped by the shared limit. */
export function annualDeduction(monthlyDps: number, annualDip = 0) {
  return Math.min(Math.max(0, monthlyDps - pensionRules.capMonthly) * 12 + annualDip, pensionRules.sharedDeductionAnnual);
}

/** Assumes the 15 % rate and a tax base large enough to absorb the whole deduction. */
export const taxSaving = (deduction: number) => deduction * pensionRules.taxPercent / 100;

export function parseWholeKc(raw: string) {
  const value = parseNumericAnswer(raw);
  return Number.isInteger(value) && value >= 0 && value <= 10_000_000 ? value : null;
}
