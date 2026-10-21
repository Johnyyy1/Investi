import { decimalToQuantityUnits, QUANTITY_SCALE, roundDivide } from "./decimal";

export type TradeSide = "BUY" | "SELL";

export interface LedgerTrade {
  instrumentId: string;
  instrumentSymbol: string;
  instrumentName: string;
  instrumentAssetType: string;
  side: TradeSide;
  quantity: string;
  grossAmountBaseMinor: bigint;
  feeBaseMinor: bigint;
  referenceGrossAmountBaseMinor?: bigint | null;
  cashDeltaBaseMinor: bigint;
}

export interface FoldedHolding {
  instrumentId: string;
  symbol: string;
  name: string;
  assetType: string;
  quantityUnits: bigint;
  costBasisMinor: bigint;
  referenceCostBasisMinor: bigint;
  averageCostBaseMinor: bigint;
  realizedGainLossMinor: bigint;
}

export interface FoldedPortfolio {
  cashMinor: bigint;
  holdings: FoldedHolding[];
  realizedGainLossMinor: bigint;
}

/** Weighted-average cost folding over the immutable execution order. */
export function foldTrades(contributedPracticeCapitalMinor: bigint, trades: readonly LedgerTrade[]): FoldedPortfolio {
  const positions = new Map<string, Omit<FoldedHolding, "averageCostBaseMinor">>();
  let cashMinor = contributedPracticeCapitalMinor;
  let realizedGainLossMinor = 0n;

  for (const trade of trades) {
    const quantityUnits = decimalToQuantityUnits(trade.quantity);
    cashMinor += trade.cashDeltaBaseMinor;
    const current = positions.get(trade.instrumentId) ?? {
      instrumentId: trade.instrumentId,
      symbol: trade.instrumentSymbol,
      name: trade.instrumentName,
      assetType: trade.instrumentAssetType,
      quantityUnits: 0n,
      costBasisMinor: 0n,
      referenceCostBasisMinor: 0n,
      realizedGainLossMinor: 0n,
    };

    if (trade.side === "BUY") {
      current.quantityUnits += quantityUnits;
      current.costBasisMinor += trade.grossAmountBaseMinor + trade.feeBaseMinor;
      current.referenceCostBasisMinor += trade.referenceGrossAmountBaseMinor ?? trade.grossAmountBaseMinor;
    } else {
      if (quantityUnits > current.quantityUnits) throw new Error(`Trade ledger oversells ${trade.instrumentId}.`);
      const allocatedCost = quantityUnits === current.quantityUnits
        ? current.costBasisMinor
        : roundDivide(current.costBasisMinor * quantityUnits, current.quantityUnits);
      const realized = trade.cashDeltaBaseMinor - allocatedCost;
      const allocatedReference = quantityUnits === current.quantityUnits ? current.referenceCostBasisMinor : roundDivide(current.referenceCostBasisMinor * quantityUnits, current.quantityUnits);
      current.referenceCostBasisMinor -= allocatedReference;
      current.quantityUnits -= quantityUnits;
      current.costBasisMinor -= allocatedCost;
      current.realizedGainLossMinor += realized;
      realizedGainLossMinor += realized;
    }
    positions.set(trade.instrumentId, current);
  }

  return {
    cashMinor,
    realizedGainLossMinor,
    holdings: [...positions.values()]
      .filter(({ quantityUnits }) => quantityUnits > 0n)
      .map((holding) => ({
        ...holding,
        averageCostBaseMinor: roundDivide(holding.costBasisMinor * QUANTITY_SCALE, holding.quantityUnits),
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}

export interface HoldingValuation {
  instrumentId: string;
  marketValueMinor: bigint | null;
  quoteObservedAt: string | null;
  unavailableReason?: "quote" | "fx" | "instrument" | "rate-limit" | "provider";
}

export function valuePortfolio(
  contributedPracticeCapitalMinor: bigint,
  folded: FoldedPortfolio,
  valuations: readonly HoldingValuation[],
) {
  const byInstrument = new Map(valuations.map((valuation) => [valuation.instrumentId, valuation]));
  const holdings = folded.holdings.map((holding) => {
    const valuation = byInstrument.get(holding.instrumentId);
    const marketValueMinor = valuation?.marketValueMinor ?? null;
    return {
      ...holding,
      marketValueMinor,
      quoteObservedAt: valuation?.quoteObservedAt ?? null,
      unavailableReason: valuation?.unavailableReason,
      gainLossMinor: marketValueMinor === null ? null : marketValueMinor - holding.costBasisMinor,
    };
  });
  const complete = holdings.every(({ marketValueMinor }) => marketValueMinor !== null);
  const holdingsMarketValueMinor = complete
    ? holdings.reduce((sum, holding) => sum + holding.marketValueMinor!, 0n)
    : null;
  const portfolioTotalMinor = holdingsMarketValueMinor === null ? null : folded.cashMinor + holdingsMarketValueMinor;
  const investmentGainLossMinor = portfolioTotalMinor === null ? null : portfolioTotalMinor - contributedPracticeCapitalMinor;
  return { complete, holdings, holdingsMarketValueMinor, portfolioTotalMinor, investmentGainLossMinor };
}

export function allocationBasisPoints(marketValueMinor: bigint, investedValueMinor: bigint) {
  return investedValueMinor <= 0n ? 0n : roundDivide(marketValueMinor * 10_000n, investedValueMinor);
}
