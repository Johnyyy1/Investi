import { decimalToPriceUnits, decimalToQuantityUnits, FX_SCALE, PRICE_SCALE, QUANTITY_SCALE, roundDivide } from "./decimal";

/**
 * Splits investment gain/loss into what prices did and what exchange rates did.
 * Read-only: it uses the immutable ledger and the same current observations as the
 * valuation, and its parts sum exactly to the investment gain/loss.
 *
 *   unrealized   = market value − cost basis                      (base currency)
 *   price effect = value at today's price but purchase FX − cost basis
 *   FX effect    = unrealized − price effect
 *
 * Purchase FX is the weighted-average rate implied by the ledger: cost basis divided by
 * the same cost in the quote currency. Realized gain/loss from sells is reported apart.
 */
const MONEY_SCALE = 100n;

export interface QuoteCostTrade {
  instrumentId: string;
  side: "BUY" | "SELL";
  quantity: string;
  unitPrice: string;
}

/** Remaining cost in quote currency, scaled by QUANTITY_SCALE × PRICE_SCALE, using the
 * same weighted-average allocation on sells as the base-currency fold. */
export function foldQuoteCost(trades: readonly QuoteCostTrade[]) {
  const positions = new Map<string, { quantityUnits: bigint; costQuoteUnits: bigint }>();
  for (const trade of trades) {
    const quantityUnits = decimalToQuantityUnits(trade.quantity);
    const priceUnits = decimalToPriceUnits(trade.unitPrice);
    const current = positions.get(trade.instrumentId) ?? { quantityUnits: 0n, costQuoteUnits: 0n };
    if (trade.side === "BUY") {
      current.quantityUnits += quantityUnits;
      current.costQuoteUnits += quantityUnits * priceUnits;
    } else {
      if (quantityUnits > current.quantityUnits) throw new Error(`Trade ledger oversells ${trade.instrumentId}.`);
      const allocated = quantityUnits === current.quantityUnits
        ? current.costQuoteUnits
        : roundDivide(current.costQuoteUnits * quantityUnits, current.quantityUnits);
      current.quantityUnits -= quantityUnits;
      current.costQuoteUnits -= allocated;
    }
    positions.set(trade.instrumentId, current);
  }
  return positions;
}

export interface AttributionInput {
  quoteCurrency: string;
  quantityUnits: bigint;
  costBasisMinor: bigint;
  costQuoteUnits: bigint;
  marketValueMinor: bigint;
  priceUnits: bigint;
}

export function attributeHolding(holding: AttributionInput, baseCurrency: string) {
  const unrealizedMinor = holding.marketValueMinor - holding.costBasisMinor;
  if (holding.quoteCurrency === baseCurrency || holding.costQuoteUnits <= 0n) {
    return { priceEffectMinor: unrealizedMinor, fxEffectMinor: 0n };
  }
  const marketValueQuoteUnits = holding.quantityUnits * holding.priceUnits;
  const valueAtPurchaseFxMinor = roundDivide(holding.costBasisMinor * marketValueQuoteUnits, holding.costQuoteUnits);
  const priceEffectMinor = valueAtPurchaseFxMinor - holding.costBasisMinor;
  return { priceEffectMinor, fxEffectMinor: unrealizedMinor - priceEffectMinor };
}

/** Weighted-average purchase FX (base per quote unit) in FX_SCALE units. */
export function impliedPurchaseFxUnits(costBasisMinor: bigint, costQuoteUnits: bigint) {
  if (costQuoteUnits <= 0n) return null;
  return roundDivide(costBasisMinor * QUANTITY_SCALE * PRICE_SCALE * FX_SCALE, costQuoteUnits * MONEY_SCALE);
}
