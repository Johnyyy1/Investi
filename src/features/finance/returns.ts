import { parseNumericAnswer } from "./numeric-input";

export class FinancialInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinancialInputError";
  }
}

function assertFinite(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new FinancialInputError(`${label} musí být konečné číslo.`);
  }
}

function assertStartingPrice(start: number) {
  assertFinite(start, "Počáteční cena");
  if (start <= 0) {
    throw new FinancialInputError("Počáteční cena musí být větší než nula.");
  }
}

function assertEndingPrice(end: number) {
  assertFinite(end, "Konečná cena");
  if (end < 0) {
    throw new FinancialInputError("Konečná cena nemůže být záporná.");
  }
}

function assertSimpleReturn(returnValue: number) {
  assertFinite(returnValue, "Výnos za období");
  if (returnValue < -1) {
    throw new FinancialInputError("Jednoduchý výnos nemůže být nižší než −100 %.");
  }
}

/** The unrounded change in price units. */
export function absoluteChange(start: number, end: number) {
  assertStartingPrice(start);
  assertEndingPrice(end);
  return end - start;
}

/** The unrounded simple return expressed as a decimal (0.15 represents 15%). */
export function simpleReturn(start: number, end: number) {
  assertStartingPrice(start);
  assertEndingPrice(end);
  return end / start - 1;
}

/** Unrounded decimal log return. Both prices must be finite and strictly positive. */
export function logReturn(previousPrice: number, currentPrice: number) {
  assertStartingPrice(previousPrice);
  assertFinite(currentPrice, "Konečná cena");
  if (currentPrice <= 0) {
    throw new FinancialInputError("Pro logaritmický výnos musí být konečná cena větší než nula.");
  }
  const ratio = currentPrice / previousPrice;
  // Positive finite prices can still overflow or underflow during division.
  return ratio > 0 && Number.isFinite(ratio)
    ? Math.log(ratio)
    : Math.log(currentPrice) - Math.log(previousPrice);
}

/** Converts an unrounded decimal log return back to a decimal simple return. */
export function simpleReturnFromLog(value: number) {
  assertFinite(value, "Logaritmický výnos");
  const result = Math.expm1(value);
  if (!Number.isFinite(result) || result <= -1) {
    throw new FinancialInputError("Výnos je mimo číselný rozsah výpočtu.");
  }
  return result;
}

/** Unrounded period returns for each consecutive pair in a price series. */
export function consecutiveSimpleReturns(prices: readonly number[]) {
  if (prices.length < 2) {
    throw new FinancialInputError("Pro výpočet výnosů za období jsou potřeba alespoň dvě ceny.");
  }
  return prices.slice(1).map((currentPrice, index) => simpleReturn(prices[index], currentPrice));
}

/** Unrounded compounded return; an empty series has the identity return of zero. */
export function cumulativeReturn(returns: readonly number[]) {
  return returns.reduce((growthFactor, returnValue) => {
    assertSimpleReturn(returnValue);
    return growthFactor * (1 + returnValue);
  }, 1) - 1;
}

/** Ending value after applying each unrounded period return in sequence. */
export function compoundValue(startValue: number, returns: readonly number[]) {
  assertStartingPrice(startValue);
  return startValue * (1 + cumulativeReturn(returns));
}

export type CompoundingPeriod = {
  period: number;
  startValue: number;
  returnValue: number;
  change: number;
  endValue: number;
};

/** Period-by-period values for explaining a compounded sequence. */
export function compoundPeriods(startValue: number, returns: readonly number[]): CompoundingPeriod[] {
  assertStartingPrice(startValue);
  let currentValue = startValue;
  return returns.map((returnValue, index) => {
    assertSimpleReturn(returnValue);
    const endValue = currentValue * (1 + returnValue);
    const period = { period: index + 1, startValue: currentValue, returnValue, change: endValue - currentValue, endValue };
    currentValue = endValue;
    return period;
  });
}

/** Required gain after a positive loss magnitude, e.g. 0.5 loss requires 1.0 gain. */
export function recoveryReturn(loss: number) {
  assertFinite(loss, "Ztráta");
  if (loss < 0 || loss >= 1) {
    throw new FinancialInputError("Ztráta musí být alespoň 0 % a menší než 100 %.");
  }
  return 1 / (1 - loss) - 1;
}

/** Parses user-entered price strings without treating an empty field as zero. */
export function parsePrice(value: string, label: string) {
  if (value.trim() === "") {
    throw new FinancialInputError(`Pole „${label}“ je povinné.`);
  }
  const parsed = parseNumericAnswer(value);
  assertFinite(parsed, label);
  return parsed;
}
