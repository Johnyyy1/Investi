import { FX_SCALE, grossBaseMinor, PortfolioInputError, PRICE_SCALE, QUANTITY_SCALE } from "./decimal";

/**
 * Target mixes ("Uložit portfolio"). A mix is the learner's intent; executing it produces
 * ordinary ledger trades at server-observed prices. Nothing here stores or derives a balance.
 */
export const FULL_WEIGHT_BASIS_POINTS = 10_000;
export const MAX_ALLOCATION_LINES = 12;
/** Differences smaller than 1 Kč are left alone instead of producing dust trades. */
export const MINIMUM_REBALANCE_TRADE_MINOR = 100n;

const MONEY_SCALE = 100n;

export interface AllocationLineInput {
  instrumentId: string;
  weightBasisPoints: number;
}

export interface AllocationInput {
  lines: readonly AllocationLineInput[];
  cashWeightBasisPoints: number;
}

function isWeight(value: number, minimum: number) {
  return Number.isSafeInteger(value) && value >= minimum && value <= FULL_WEIGHT_BASIS_POINTS;
}

/** Exact integer validation: at least one instrument, unique lines, weights summing to 100 %. */
export function validateAllocation(input: AllocationInput): AllocationInput {
  const invalid = (message: string) => new PortfolioInputError("InvalidAllocation", message);
  if (input.lines.length === 0) throw invalid("Přidej do mixu alespoň jeden nástroj.");
  if (input.lines.length > MAX_ALLOCATION_LINES) throw invalid(`Mix může mít nejvýše ${MAX_ALLOCATION_LINES} nástrojů.`);
  if (!isWeight(input.cashWeightBasisPoints, 0)) throw invalid("Váha hotovosti musí být mezi 0 a 100 %.");
  const seen = new Set<string>();
  for (const line of input.lines) {
    if (seen.has(line.instrumentId)) throw invalid("Každý nástroj může být v mixu jen jednou.");
    seen.add(line.instrumentId);
    if (!isWeight(line.weightBasisPoints, 1)) throw invalid("Každý nástroj v mixu potřebuje váhu větší než 0 %.");
  }
  const total = input.lines.reduce((sum, line) => sum + line.weightBasisPoints, input.cashWeightBasisPoints);
  if (total !== FULL_WEIGHT_BASIS_POINTS) throw invalid("Váhy musí dohromady dát přesně 100 %.");
  return { lines: input.lines.map((line) => ({ ...line })), cashWeightBasisPoints: input.cashWeightBasisPoints };
}

/** Largest whole quantity (8 dp) whose execution value does not exceed the amount. */
export function quantityUnitsForAmount(amountMinor: bigint, priceUnits: bigint, fxUnits: bigint) {
  if (amountMinor <= 0n) return 0n;
  if (priceUnits <= 0n || fxUnits <= 0n) throw new RangeError("Price and FX must be positive.");
  return (amountMinor * QUANTITY_SCALE * PRICE_SCALE * FX_SCALE) / (priceUnits * fxUnits * MONEY_SCALE);
}

export interface PlanningObservation {
  priceUnits: bigint;
  fxUnits: bigint;
}

export interface PlannedTrade {
  instrumentId: string;
  side: "BUY" | "SELL";
  quantityUnits: bigint;
  grossMinor: bigint;
}

export interface PlannedPosition {
  instrumentId: string;
  /** null for a holding that is not part of the mix (target 0 %). */
  weightBasisPoints: number | null;
  targetValueMinor: bigint;
  currentValueMinor: bigint;
  currentQuantityUnits: bigint;
  resultingQuantityUnits: bigint;
  resultingValueMinor: bigint;
}

export interface AllocationPlan {
  totalValueMinor: bigint;
  targetCashMinor: bigint;
  resultingCashMinor: bigint;
  trades: PlannedTrade[];
  positions: PlannedPosition[];
}

/**
 * Turns target weights into ledger trades against one set of server observations.
 * Sells come first; buys spend at most the cash that is actually available, so cash
 * never goes negative. Quantities are floored to 8 dp, so each executed value is at
 * most its target; the remainder stays as cash.
 */
export function planAllocation(input: {
  cashMinor: bigint;
  holdings: readonly { instrumentId: string; quantityUnits: bigint }[];
  observations: ReadonlyMap<string, PlanningObservation>;
  allocation: AllocationInput;
  minimumTradeMinor?: bigint;
}): AllocationPlan {
  const allocation = validateAllocation(input.allocation);
  const minimum = input.minimumTradeMinor ?? MINIMUM_REBALANCE_TRADE_MINOR;
  if (input.cashMinor < 0n) throw new RangeError("Cash cannot be negative before planning.");
  const observation = (instrumentId: string) => {
    const value = input.observations.get(instrumentId);
    if (!value) throw new PortfolioInputError("QuoteUnavailable", "Pro jeden z nástrojů chybí aktuální tržní pozorování.");
    return value;
  };
  const held = new Map(input.holdings.filter(({ quantityUnits }) => quantityUnits > 0n).map((holding) => [holding.instrumentId, holding.quantityUnits]));
  const valueOf = (instrumentId: string, quantityUnits: bigint) => {
    if (quantityUnits === 0n) return 0n;
    const { priceUnits, fxUnits } = observation(instrumentId);
    return grossBaseMinor(quantityUnits, priceUnits, fxUnits);
  };

  const ordered = [
    ...allocation.lines.map((line) => line.instrumentId),
    ...[...held.keys()].filter((instrumentId) => !allocation.lines.some((line) => line.instrumentId === instrumentId)),
  ];
  const currentValue = new Map(ordered.map((instrumentId) => [instrumentId, valueOf(instrumentId, held.get(instrumentId) ?? 0n)]));
  const totalValueMinor = [...currentValue.values()].reduce((sum, value) => sum + value, input.cashMinor);
  if (totalValueMinor <= 0n) throw new PortfolioInputError("InsufficientCash", "Mix nemá co rozdělit. Získej nejdřív cvičný kapitál v lekcích.");

  const weightOf = (instrumentId: string) => allocation.lines.find((line) => line.instrumentId === instrumentId)?.weightBasisPoints ?? null;
  const target = new Map(ordered.map((instrumentId) => [instrumentId, (totalValueMinor * BigInt(weightOf(instrumentId) ?? 0)) / BigInt(FULL_WEIGHT_BASIS_POINTS)]));
  const quantity = new Map(ordered.map((instrumentId) => [instrumentId, held.get(instrumentId) ?? 0n]));
  const trades: PlannedTrade[] = [];
  let cash = input.cashMinor;

  for (const instrumentId of ordered) {
    const heldUnits = quantity.get(instrumentId)!;
    const surplus = currentValue.get(instrumentId)! - target.get(instrumentId)!;
    if (heldUnits === 0n || surplus <= 0n) continue;
    const { priceUnits, fxUnits } = observation(instrumentId);
    const sellAll = target.get(instrumentId) === 0n;
    if (!sellAll && surplus < minimum) continue;
    const floored = sellAll ? heldUnits : quantityUnitsForAmount(surplus, priceUnits, fxUnits);
    const units = floored > heldUnits ? heldUnits : floored;
    const grossMinor = units === 0n ? 0n : grossBaseMinor(units, priceUnits, fxUnits);
    if (grossMinor <= 0n) continue;
    trades.push({ instrumentId, side: "SELL", quantityUnits: units, grossMinor });
    quantity.set(instrumentId, heldUnits - units);
    cash += grossMinor;
  }

  for (const line of allocation.lines) {
    const shortfall = target.get(line.instrumentId)! - currentValue.get(line.instrumentId)!;
    if (shortfall < minimum) continue;
    const amount = shortfall < cash ? shortfall : cash;
    const { priceUnits, fxUnits } = observation(line.instrumentId);
    const units = quantityUnitsForAmount(amount, priceUnits, fxUnits);
    const grossMinor = units === 0n ? 0n : grossBaseMinor(units, priceUnits, fxUnits);
    if (grossMinor <= 0n || grossMinor > cash) continue;
    trades.push({ instrumentId: line.instrumentId, side: "BUY", quantityUnits: units, grossMinor });
    quantity.set(line.instrumentId, quantity.get(line.instrumentId)! + units);
    cash -= grossMinor;
  }
  if (cash < 0n) throw new Error("Allocation planning produced negative cash.");

  const allocatedMinor = [...target.values()].reduce((sum, value) => sum + value, 0n);
  return {
    totalValueMinor,
    targetCashMinor: totalValueMinor - allocatedMinor,
    resultingCashMinor: cash,
    trades,
    positions: ordered.map((instrumentId) => ({
      instrumentId,
      weightBasisPoints: weightOf(instrumentId),
      targetValueMinor: target.get(instrumentId)!,
      currentValueMinor: currentValue.get(instrumentId)!,
      currentQuantityUnits: held.get(instrumentId) ?? 0n,
      resultingQuantityUnits: quantity.get(instrumentId)!,
      resultingValueMinor: valueOf(instrumentId, quantity.get(instrumentId)!),
    })),
  };
}
