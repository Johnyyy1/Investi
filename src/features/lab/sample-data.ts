import type { MonthlyObservation } from "./backtest";
/**
 * Investník synthetic fixture v1, authored for this Lab. No external market observations.
 * 132 invented monthly simple returns, Jan 2015–Dec 2025. Deterministic cycles and shocks
 * illustrate compounding, recovery, and bond/stock co-movement. Calendar labels are illustrative.
 * Never label this fixture historical/live. Replace via MonthlyObservation when a real source exists.
 */
export const syntheticMonthlyData: readonly MonthlyObservation[] = Array.from({ length: 132 }, (_, i) => {
  const year = 2015 + Math.floor(i / 12);
  const month = i % 12 + 1;
  const stocks = i === 62 ? -0.24 : i === 63 ? 0.14 : year === 2022 ? -0.012 + 0.024 * Math.sin(i * 1.7) : 0.008 + 0.033 * Math.sin(i * 1.7) + 0.016 * Math.cos(i * 0.43);
  const bonds = year === 2022 ? -0.008 + 0.009 * Math.cos(i) : 0.002 + 0.007 * Math.cos(i * 0.8);
  return { month: `${year}-${String(month).padStart(2, "0")}`, stocks: Number(stocks.toFixed(6)), bonds: Number(bonds.toFixed(6)), cash: 0.001 };
});
