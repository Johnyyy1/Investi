/** Educational model only: effective annual borrowing cost approximated by a constant monthly rate.
 * Both paths start with 25,000 Kč cash/debt and the same 1,000 Kč monthly budget.
 * Contributions/payments happen at month end; investment values are hypothetical, before tax/costs.
 */
export function compareDebtAndInvest(debtPercent: number, returnPercent: number, years: number) {
  if (![debtPercent, returnPercent, years].every(Number.isFinite) || debtPercent < 0 || debtPercent > 40 || returnPercent < -50 || returnPercent > 30 || !Number.isInteger(years) || years < 1 || years > 10) return null;
  const debtRate = (1 + debtPercent / 100) ** (1 / 12) - 1;
  const investmentRate = (1 + returnPercent / 100) ** (1 / 12) - 1;
  let remainingDebt = 25_000;
  let investFirst = 25_000;
  let repayFirst = 0;
  let costs = 0;
  for (let month = 0; month < years * 12; month++) {
    const cost = remainingDebt * debtRate;
    costs += cost;
    remainingDebt += cost;
    const payment = Math.min(1_000, remainingDebt);
    remainingDebt -= payment;
    investFirst = investFirst * (1 + investmentRate) + (1_000 - payment);
    repayFirst = repayFirst * (1 + investmentRate) + 1_000;
  }
  return { repayFirst, investFirst, remainingDebt, costs, difference: repayFirst - (investFirst - remainingDebt) };
}
