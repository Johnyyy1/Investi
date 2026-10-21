import type { Currency } from "@/features/market-data/contracts";
import { fxToDecimal, priceToDecimal, FX_SCALE, grossBaseMinor, PRICE_SCALE, QUANTITY_SCALE, roundDivide } from "./decimal";
import type { TradeSide } from "./domain";

export interface BrokerFeeProfile {
  /** Immutable, versioned identity. Change the id when changing a tariff. */
  readonly id: string;
  readonly name: string;
  readonly tradeFee: { readonly rateBps: number; readonly minMinor: bigint; readonly maxMinor: bigint; readonly currency: "CZK" };
  readonly fxMarkupBps: number;
}

/** Fictional educational tariffs, never a representation of a real broker's prices.
 * V1 charges commission in the portfolio's CZK currency; custody needs simulated time. */
export const BROKER_FEE_PROFILES = [
  { id: "investi-standard-v1", name: "investi standard", tradeFee: { rateBps: 10, minMinor: 1_000n, maxMinor: 20_000n, currency: "CZK" }, fxMarkupBps: 50 },
  { id: "investi-low-fx-v1", name: "investi nižší konverze", tradeFee: { rateBps: 20, minMinor: 2_500n, maxMinor: 30_000n, currency: "CZK" }, fxMarkupBps: 10 },
] as const satisfies readonly BrokerFeeProfile[];
export const DEFAULT_FEE_PROFILE = BROKER_FEE_PROFILES[0];

export function brokerFeeProfile(id: string | null | undefined): BrokerFeeProfile {
  if (id == null) return DEFAULT_FEE_PROFILE;
  const found = BROKER_FEE_PROFILES.find((profile) => profile.id === id);
  if (!found) throw new RangeError("Unknown broker fee profile.");
  return found;
}

/** Shared boundary for lesson exercises and authoritative Lab review/execution. No rounded unit
 * price or JS floating point enters accounting. Each money product rounds once at
 * the minor-unit boundary, half away from zero. Commission uses reference notional.
 * The 12 dp execution FX is reference × (1 ± markup); valuation keeps reference FX. */
export function computeTradeCost(input: {
  quantityUnits: bigint; priceUnits: bigint; fxUnits: bigint;
  quoteCurrency: Currency; side: TradeSide; profile: BrokerFeeProfile;
}) {
  const { quantityUnits, priceUnits, fxUnits, profile, side } = input;
  const { rateBps, minMinor, maxMinor, currency } = profile.tradeFee;
  if (quantityUnits <= 0n || priceUnits <= 0n || fxUnits <= 0n
    || !Number.isSafeInteger(rateBps) || rateBps < 0
    || !Number.isSafeInteger(profile.fxMarkupBps) || profile.fxMarkupBps < 0 || profile.fxMarkupBps >= 10_000
    || minMinor < 0n || maxMinor < minMinor || currency !== "CZK") throw new RangeError("Invalid trade cost inputs.");
  const fxMarkupBps = input.quoteCurrency === "CZK" ? 0 : profile.fxMarkupBps;
  const fxRateUnits = roundDivide(fxUnits * (10_000n + (side === "BUY" ? 1n : -1n) * BigInt(fxMarkupBps)), 10_000n);
  const referenceGrossAmountBaseMinor = grossBaseMinor(quantityUnits, priceUnits, fxUnits);
  const grossAmountBaseMinor = grossBaseMinor(quantityUnits, priceUnits, fxRateUnits);
  const percentageFee = roundDivide(quantityUnits * priceUnits * fxUnits * 100n * BigInt(rateBps), QUANTITY_SCALE * PRICE_SCALE * FX_SCALE * 10_000n);
  const feeBaseMinor = percentageFee < minMinor ? minMinor : percentageFee > maxMinor ? maxMinor : percentageFee;
  const fxMarkupBaseMinor = side === "BUY" ? grossAmountBaseMinor - referenceGrossAmountBaseMinor : referenceGrossAmountBaseMinor - grossAmountBaseMinor;
  return {
    referenceFxRateUnits: fxUnits, priceUnits,
    referenceGrossAmountBaseMinor, grossAmountBaseMinor, feeBaseMinor, fxMarkupBaseMinor, fxMarkupBps, fxRateUnits,
    totalCostBaseMinor: feeBaseMinor + fxMarkupBaseMinor,
    cashDeltaBaseMinor: side === "BUY" ? -(grossAmountBaseMinor + feeBaseMinor) : grossAmountBaseMinor - feeBaseMinor,
  };
}

export type TradeCost = ReturnType<typeof computeTradeCost>;

/** Explicit presentation boundary for Server Action results. */
export function presentTradeCost(cost: TradeCost, profile: BrokerFeeProfile) {
  return {
    feeProfileId: profile.id, feeProfileName: profile.name,
    price: priceToDecimal(cost.priceUnits), referenceFxRate: fxToDecimal(cost.referenceFxRateUnits), executionFxRate: fxToDecimal(cost.fxRateUnits),
    referenceGrossAmountBaseMinor: cost.referenceGrossAmountBaseMinor.toString(),
    grossAmountBaseMinor: cost.grossAmountBaseMinor.toString(),
    feeBaseMinor: cost.feeBaseMinor.toString(), fxMarkupBaseMinor: cost.fxMarkupBaseMinor.toString(),
    totalCostBaseMinor: cost.totalCostBaseMinor.toString(), cashDeltaBaseMinor: cost.cashDeltaBaseMinor.toString(),
    fxMarkupBps: cost.fxMarkupBps,
  };
}
export type TradeCostView = ReturnType<typeof presentTradeCost>;

export interface TradeReviewView extends TradeCostView {
  fxReferenceDate: string;
  fxProvider: string;
  quoteObservedAt: string;
}
