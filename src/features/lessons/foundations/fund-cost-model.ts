export const fundCostInputs = { lumpSum: 100_000, monthly: 2_000 } as const;

/** Educational model of lesson 1.1.8, not fund accounting: the net annual return is gross − ongoing costs,
 * the simplification the lesson states. The entry fee comes off every contribution. A regular plan
 * contributes at month end at the constant monthly rate (1 + net)^(1/12) − 1. Before tax and broker fees.
 */
export function fundValue(entryFeePercent: number, ongoingPercent: number, grossPercent: number, years: number, regular: boolean) {
  if (![entryFeePercent, ongoingPercent, grossPercent, years].every(Number.isFinite) || entryFeePercent < 0 || entryFeePercent > 5 || ongoingPercent < 0 || ongoingPercent > 3 || grossPercent < -5 || grossPercent > 12 || !Number.isInteger(years) || years < 1 || years > 40) return null;
  const net = 1 + (grossPercent - ongoingPercent) / 100;
  const kept = 1 - entryFeePercent / 100;
  if (!regular) return { contributed: fundCostInputs.lumpSum, value: fundCostInputs.lumpSum * kept * net ** years };
  const monthlyRate = net ** (1 / 12) - 1;
  let value = 0;
  for (let month = 0; month < years * 12; month++) value = value * (1 + monthlyRate) + fundCostInputs.monthly * kept;
  return { contributed: fundCostInputs.monthly * 12 * years, value };
}

/** The same plan with and without the fund's costs; `costImpact` is what the costs took by the end. */
export function compareFundCosts(entryFeePercent: number, ongoingPercent: number, grossPercent: number, years: number, regular: boolean) {
  const withCosts = fundValue(entryFeePercent, ongoingPercent, grossPercent, years, regular);
  const withoutCosts = fundValue(0, 0, grossPercent, years, regular);
  if (!withCosts || !withoutCosts) return null;
  return { contributed: withCosts.contributed, withCosts: withCosts.value, withoutCosts: withoutCosts.value, costImpact: withoutCosts.value - withCosts.value };
}
