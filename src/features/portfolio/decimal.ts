/**
 * Ledger precision policy:
 * - quantities: 8 decimal places
 * - normalized prices: 8 decimal places
 * - FX rates: 12 decimal places
 * - money: integer minor units, rounded half away from zero
 */
export const QUANTITY_SCALE = 100_000_000n;
export const PRICE_SCALE = 100_000_000n;
export const FX_SCALE = 1_000_000_000_000n;
const MONEY_SCALE = 100n;

export class PortfolioInputError extends Error {
  constructor(
    public readonly code: "InvalidQuantity" | "InvalidInstrument" | "InsufficientCash" | "Oversell" | "MarketClosed" | "QuoteUnavailable" | "FxUnavailable" | "PortfolioUnavailable" | "InvalidAllocation" | "PortfolioChanged",
    message: string,
  ) {
    super(message);
    this.name = "PortfolioInputError";
  }
}

export function roundDivide(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) throw new RangeError("The rounding denominator must be positive.");
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const rounded = (absolute + denominator / 2n) / denominator;
  return negative ? -rounded : rounded;
}

export function parseQuantity(value: string) {
  const normalized = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match || (match[2]?.length ?? 0) > 8) {
    throw new PortfolioInputError("InvalidQuantity", "Zadej množství s nejvýše 8 desetinnými místy.");
  }
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(8, "0") || "0");
  const units = whole * QUANTITY_SCALE + fraction;
  if (units <= 0n || units >= 10n ** 24n) {
    throw new PortfolioInputError("InvalidQuantity", "Množství musí být větší než nula a v podporovaném rozsahu.");
  }
  return units;
}

function decimalFromNumber(value: number, decimalPlaces: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be a positive finite number.`);
  // Market-data contracts normalize provider observations as numbers. This is the
  // sole conversion boundary; all ledger calculations after it use scaled bigint.
  return value.toFixed(decimalPlaces);
}

export function priceUnitsFromNumber(value: number) {
  return decimalToScaled(decimalFromNumber(value, 8, "Price"), PRICE_SCALE, 8);
}

export function fxUnitsFromNumber(value: number) {
  return decimalToScaled(decimalFromNumber(value, 12, "FX rate"), FX_SCALE, 12);
}

/** Composition weights (a fund's sector or country shares) at 6 dp: parts per million. */
export const WEIGHT_SCALE = 1_000_000n;

export function weightUnitsFromFraction(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError("Weight must be a fraction between 0 and 1.");
  return decimalToScaled(value.toFixed(6), WEIGHT_SCALE, 6);
}

function decimalToScaled(value: string, scale: bigint, decimalPlaces: number) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * scale + BigInt(fraction.padEnd(decimalPlaces, "0").slice(0, decimalPlaces) || "0");
}

export function scaledToDecimal(units: bigint, scaleDigits: number) {
  const scale = 10n ** BigInt(scaleDigits);
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(scaleDigits, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function quantityToDecimal(units: bigint) {
  return scaledToDecimal(units, 8);
}

export function priceToDecimal(units: bigint) {
  return scaledToDecimal(units, 8);
}

export function fxToDecimal(units: bigint) {
  return scaledToDecimal(units, 12);
}

export function grossBaseMinor(quantityUnits: bigint, priceUnits: bigint, fxUnits: bigint) {
  const denominator = QUANTITY_SCALE * PRICE_SCALE * FX_SCALE;
  return roundDivide(quantityUnits * priceUnits * fxUnits * MONEY_SCALE, denominator);
}

export function decimalToQuantityUnits(value: string) {
  return parseQuantity(value);
}

/** Persisted execution prices share the 8 dp quantity scale. */
export function decimalToPriceUnits(value: string) {
  return parseQuantity(value);
}
