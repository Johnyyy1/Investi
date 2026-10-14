import "server-only";

import type { Currency } from "@/features/market-data/contracts";
import { attributeHolding, foldQuoteCost, impliedPurchaseFxUnits } from "./attribution";
import { allocationBasisPoints, foldTrades, valuePortfolio, type HoldingValuation } from "./domain";
import { decimalToPriceUnits, fxToDecimal, quantityToDecimal } from "./decimal";
import { perfMeasure } from "@/lib/perf";
import { portfolioMarketData } from "./environment";
import {
  loadPortfolioInstrumentPreview,
  marketDataMode,
  observeAllocationQuote,
  observePortfolioHoldingValue,
  type AllocationQuote,
  type PortfolioInstrumentPreview,
  type ValuationUnavailableReason,
} from "./market-data";
import { loadLatestAllocation, loadPortfolioRows, type AllocationLineRow } from "./repository";

export interface PortfolioView {
  portfolioId: string;
  baseCurrency: Currency;
  openedAt: string;
  openingCapitalMinor: string;
  earnedPracticeCapitalMinor: string;
  availableCashMinor: string;
  holdingsMarketValueMinor: string | null;
  portfolioTotalMinor: string | null;
  investmentGainLossMinor: string | null;
  investmentGainLossBasisPoints: string | null;
  valuationComplete: boolean;
  valuedHoldingsCount: number;
  totalHoldingsCount: number;
  marketDataMode: "sample" | "market";
  /** Realized gain/loss of closed sells in this generation (exact, from the ledger). */
  realizedGainLossMinor: string;
  /** Cash as a share of the portfolio total; null while the valuation is incomplete. */
  cashWeightBasisPoints: string | null;
  /** Price/FX split of the investment gain/loss; null while the valuation is incomplete. */
  attribution: {
    priceEffectMinor: string;
    fxEffectMinor: string;
    realizedGainLossMinor: string;
    currencies: Array<{ currency: Currency; purchaseFxRate: string; currentFxRate: string; effectMinor: string }>;
  } | null;
  /** Latest saved target mix of the active generation. */
  allocation: {
    id: string;
    createdAt: string;
    cashWeightBasisPoints: number;
    appliedValueMinor: string;
    lines: AllocationLineRow[];
  } | null;
  holdings: Array<{
    instrumentId: string;
    symbol: string;
    name: string;
    assetType: string;
    quoteCurrency: Currency;
    quantity: string;
    averageCostBaseMinor: string;
    costBasisMinor: string;
    currentPrice: string | null;
    currentPriceCurrency: Currency | null;
    marketValueMinor: string | null;
    allocationBasisPoints: string | null;
    /** Market value as a share of the whole portfolio including cash. */
    portfolioWeightBasisPoints: string | null;
    gainLossMinor: string | null;
    gainLossBasisPoints: string | null;
    priceEffectMinor: string | null;
    fxEffectMinor: string | null;
    quoteObservedAt: string | null;
    quoteRetrievedAt: string | null;
    quoteUsability: "fresh" | "closed-market-reference" | "stale" | "unavailable" | null;
    marketSessionState: "open" | "closed" | "unknown" | null;
    usableForExecution: boolean;
    fxReferenceDate: string | null;
    fxRetrievedAt: string | null;
    fxProvider: string | null;
    fxRate: string | null;
    unavailableReason?: ValuationUnavailableReason;
  }>;
  recentActivity: Array<{
    id: string;
    side: "BUY" | "SELL";
    symbol: string;
    name: string;
    quantity: string;
    unitPrice: string;
    quoteCurrency: string;
    grossAmountBaseMinor: string;
    executedAt: string;
  }>;
}

export type InstrumentPreview = PortfolioInstrumentPreview;

export async function loadPortfolioView(userId: string): Promise<PortfolioView> {
  const rows = await loadPortfolioRows(userId);
  const baseCurrency = rows.portfolio.baseCurrency as Currency;
  const folded = foldTrades(rows.earnedPracticeCapitalMinor, rows.trades);
  const [observations, allocation] = await Promise.all([
    perfMeasure("portfolio.observeAllHoldings", "external", () => Promise.all(folded.holdings.map((holding) => perfMeasure("portfolio.observeHolding", "external", () => observePortfolioHoldingValue(portfolioMarketData, holding, baseCurrency))))),
    perfMeasure("portfolio.latestAllocation", "db", () => loadLatestAllocation(rows.portfolio.id)),
  ]);
  const quoteCost = foldQuoteCost(rows.trades);
  const quoteCurrency = new Map(rows.trades.map((trade) => [trade.instrumentId, trade.quoteCurrency as Currency]));
  const observationByInstrument = new Map(observations.map((observation) => [observation.instrumentId, observation]));
  const valuations: HoldingValuation[] = observations.map((observation) => ({
    instrumentId: observation.instrumentId,
    marketValueMinor: observation.marketValueMinor,
    quoteObservedAt: observation.quoteObservedAt,
    unavailableReason: observation.unavailableReason,
  }));
  const valued = valuePortfolio(rows.earnedPracticeCapitalMinor, folded, valuations);
  const invested = valued.holdingsMarketValueMinor;
  const total = valued.portfolioTotalMinor;
  const attributed = new Map(valued.holdings.flatMap((holding) => {
    const observation = observationByInstrument.get(holding.instrumentId);
    if (holding.marketValueMinor === null || !observation?.currentPrice) return [];
    const cost = quoteCost.get(holding.instrumentId)!;
    return [[holding.instrumentId, attributeHolding({
      quoteCurrency: quoteCurrency.get(holding.instrumentId)!,
      quantityUnits: holding.quantityUnits,
      costBasisMinor: holding.costBasisMinor,
      costQuoteUnits: cost.costQuoteUnits,
      marketValueMinor: holding.marketValueMinor,
      priceUnits: decimalToPriceUnits(observation.currentPrice),
    }, baseCurrency)] as const];
  }));
  const foreign = [...new Set(valued.holdings.map(({ instrumentId }) => quoteCurrency.get(instrumentId)!).filter((currency) => currency !== baseCurrency))];
  const attribution = !valued.complete ? null : {
    priceEffectMinor: [...attributed.values()].reduce((sum, value) => sum + value.priceEffectMinor, 0n).toString(),
    fxEffectMinor: [...attributed.values()].reduce((sum, value) => sum + value.fxEffectMinor, 0n).toString(),
    realizedGainLossMinor: folded.realizedGainLossMinor.toString(),
    currencies: foreign.flatMap((currency) => {
      const members = valued.holdings.filter(({ instrumentId }) => quoteCurrency.get(instrumentId) === currency);
      const purchase = impliedPurchaseFxUnits(
        members.reduce((sum, holding) => sum + holding.costBasisMinor, 0n),
        members.reduce((sum, holding) => sum + quoteCost.get(holding.instrumentId)!.costQuoteUnits, 0n),
      );
      const currentFxRate = observationByInstrument.get(members[0].instrumentId)?.fxRate;
      if (purchase === null || !currentFxRate) return [];
      return [{
        currency,
        purchaseFxRate: fxToDecimal(purchase),
        currentFxRate,
        effectMinor: members.reduce((sum, holding) => sum + (attributed.get(holding.instrumentId)?.fxEffectMinor ?? 0n), 0n).toString(),
      }];
    }),
  };
  return {
    portfolioId: rows.portfolio.id,
    baseCurrency: rows.portfolio.baseCurrency as Currency,
    openedAt: rows.portfolio.openedAt.toISOString(),
    openingCapitalMinor: rows.portfolio.openingCapitalMinor.toString(),
    earnedPracticeCapitalMinor: rows.earnedPracticeCapitalMinor.toString(),
    availableCashMinor: folded.cashMinor.toString(),
    holdingsMarketValueMinor: invested?.toString() ?? null,
    portfolioTotalMinor: valued.portfolioTotalMinor?.toString() ?? null,
    investmentGainLossMinor: valued.investmentGainLossMinor?.toString() ?? null,
    investmentGainLossBasisPoints: valued.investmentGainLossMinor === null || rows.earnedPracticeCapitalMinor === 0n
      ? null
      : ((valued.investmentGainLossMinor * 10_000n) / rows.earnedPracticeCapitalMinor).toString(),
    valuationComplete: valued.complete,
    valuedHoldingsCount: observations.filter(({ marketValueMinor }) => marketValueMinor !== null).length,
    totalHoldingsCount: folded.holdings.length,
    marketDataMode: marketDataMode(portfolioMarketData),
    realizedGainLossMinor: folded.realizedGainLossMinor.toString(),
    cashWeightBasisPoints: total === null || total <= 0n ? null : allocationBasisPoints(folded.cashMinor, total).toString(),
    attribution,
    allocation: allocation ? {
      id: allocation.id,
      createdAt: allocation.createdAt.toISOString(),
      cashWeightBasisPoints: allocation.cashWeightBasisPoints,
      appliedValueMinor: allocation.appliedValueMinor.toString(),
      lines: allocation.lines,
    } : null,
    holdings: valued.holdings.map((holding) => {
      const observation = observationByInstrument.get(holding.instrumentId);
      const effects = attributed.get(holding.instrumentId);
      return {
        instrumentId: holding.instrumentId,
        symbol: holding.symbol,
        name: holding.name,
        assetType: holding.assetType,
        quoteCurrency: quoteCurrency.get(holding.instrumentId)!,
        quantity: quantityToDecimal(holding.quantityUnits),
        averageCostBaseMinor: holding.averageCostBaseMinor.toString(),
        costBasisMinor: holding.costBasisMinor.toString(),
        currentPrice: observation?.currentPrice ?? null,
        currentPriceCurrency: observation?.currentPriceCurrency ?? null,
        marketValueMinor: holding.marketValueMinor?.toString() ?? null,
        allocationBasisPoints: holding.marketValueMinor === null || invested === null ? null : allocationBasisPoints(holding.marketValueMinor, invested).toString(),
        portfolioWeightBasisPoints: holding.marketValueMinor === null || total === null || total <= 0n ? null : allocationBasisPoints(holding.marketValueMinor, total).toString(),
        gainLossMinor: holding.gainLossMinor?.toString() ?? null,
        gainLossBasisPoints: holding.gainLossMinor === null || holding.costBasisMinor <= 0n ? null : ((holding.gainLossMinor * 10_000n) / holding.costBasisMinor).toString(),
        priceEffectMinor: effects?.priceEffectMinor.toString() ?? null,
        fxEffectMinor: effects?.fxEffectMinor.toString() ?? null,
        quoteObservedAt: holding.quoteObservedAt,
        quoteRetrievedAt: observation?.quoteRetrievedAt ?? null,
        quoteUsability: observation?.quoteUsability ?? null,
        marketSessionState: observation?.marketSessionState ?? null,
        usableForExecution: observation?.usableForExecution ?? false,
        fxReferenceDate: observation?.fxReferenceDate ?? null,
        fxRetrievedAt: observation?.fxRetrievedAt ?? null,
        fxProvider: observation?.fxProvider ?? null,
        fxRate: observation?.fxRate ?? null,
        unavailableReason: holding.unavailableReason,
      };
    }),
    recentActivity: rows.trades.slice(-8).reverse().map((trade) => ({
      id: trade.id,
      side: trade.side,
      symbol: trade.instrumentSymbol,
      name: trade.instrumentName,
      quantity: trade.quantity,
      unitPrice: trade.unitPrice,
      quoteCurrency: trade.quoteCurrency,
      grossAmountBaseMinor: trade.grossAmountBaseMinor.toString(),
      executedAt: trade.executedAt.toISOString(),
    })),
  };
}

export async function loadInstrumentPreview(instrumentId: string): Promise<InstrumentPreview | null> {
  return loadPortfolioInstrumentPreview(portfolioMarketData, instrumentId);
}

export type { AllocationQuote };

export async function loadAllocationQuotes(instrumentIds: readonly string[]): Promise<AllocationQuote[]> {
  return Promise.all(instrumentIds.map((instrumentId) => observeAllocationQuote(portfolioMarketData, instrumentId, "CZK")));
}
