import { pearsonCorrelation } from "@/features/instruments/correlation";

/**
 * Lesson-side arithmetic for the Correlation module. The coefficient comes from the same
 * Pearson function as the Lab's comparison, so a lesson number and a Lab number follow one
 * convention. All series here are invented monthly returns in percent, not market data.
 */
export function correlationOf(first: readonly number[], second: readonly number[]) {
  return pearsonCorrelation(first, second);
}

/** Every intermediate step of r for a short series, for the step-by-step table. */
export function correlationSteps(first: readonly number[], second: readonly number[]) {
  const meanFirst = first.reduce((sum, value) => sum + value, 0) / first.length;
  const meanSecond = second.reduce((sum, value) => sum + value, 0) / second.length;
  const rows = first.map((value, index) => {
    const deviationFirst = value - meanFirst, deviationSecond = second[index] - meanSecond;
    return { first: value, second: second[index], product: deviationFirst * deviationSecond, squaredFirst: deviationFirst ** 2, squaredSecond: deviationSecond ** 2 };
  });
  const sum = (key: "product" | "squaredFirst" | "squaredSecond") => rows.reduce((total, row) => total + row[key], 0);
  return { meanFirst, meanSecond, rows, sumOfProducts: sum("product"), sumOfSquaresFirst: sum("squaredFirst"), sumOfSquaresSecond: sum("squaredSecond"), coefficient: correlationOf(first, second) };
}

const base = [3, -2, 4, -1, 2, -3, 1, -4];

/** Four invented pairs of eight monthly returns; B differs, A stays the same. */
export const correlationPairs = [
  { id: "together", label: "Spolu", first: base, second: [2, -1, 3, -2, 3, -2, 0, -3], note: "B většinou roste a klesá ve stejných měsících jako A." },
  { id: "opposite", label: "Proti sobě", first: base, second: [-2, 1, -3, 2, -1, 1, 0, 3], note: "Když A roste, B většinou klesá, a naopak." },
  { id: "independent", label: "Nezávisle", first: base, second: [2, 1, -2, -1, 2, 1, -2, -1], note: "Pohyby B nemají s pohyby A lineární vztah." },
  { id: "half", label: "Spolu, ale menší", first: base, second: base.map((value) => value / 2), note: "B dělá přesně polovinu každého pohybu A. Směr sedí vždy, velikost ne." },
] as const;

/**
 * Two invented stocks that never influence each other: each month's return is a share of one
 * shared market move plus the firm's own move. The three series are mutually uncorrelated, so
 * the share alone sets the correlation, from 0 (no shared move) to 1 (only the shared move).
 */
export const commonFactor = {
  market: [5, 1, 5, 1, -1, -5, -1, -5],
  ownFirst: [3, 1, -3, -1, 3, 1, -3, -1],
  ownSecond: [3, -1, -3, 1, -3, 1, 3, -1],
} as const;

export function commonFactorReturns(share: number) {
  if (!(share >= 0 && share <= 1)) throw new RangeError("The shared share must lie between 0 and 1.");
  const mix = (own: readonly number[]) => commonFactor.market.map((move, index) => share * move + (1 - share) * own[index]);
  const first = mix(commonFactor.ownFirst), second = mix(commonFactor.ownSecond);
  return { first, second, coefficient: correlationOf(first, second) };
}

/** Eighteen invented months: twelve calm ones, then a six-month sell-off. */
export const crisisSample = {
  calm: { first: [2, -1, 3, 1, -2, 2, 0, 1, -1, 2, 1, -1], second: [1, -2, 2, -1, 1, 0, -1, 2, 0, 1, -1, 2] },
  crisis: { first: [-6, -9, 3, -12, -4, 5], second: [-4, -8, 2, -10, -5, 4] },
} as const;

export type CrisisWindow = "calm" | "crisis" | "all";

export function crisisWindow(window: CrisisWindow) {
  const first = window === "all" ? [...crisisSample.calm.first, ...crisisSample.crisis.first] : [...crisisSample[window].first];
  const second = window === "all" ? [...crisisSample.calm.second, ...crisisSample.crisis.second] : [...crisisSample[window].second];
  const halfAndHalf = first.map((value, index) => (value + second[index]) / 2);
  return { first, second, halfAndHalf, coefficient: correlationOf(first, second), worst: { first: Math.min(...first), second: Math.min(...second), halfAndHalf: Math.min(...halfAndHalf) } };
}
