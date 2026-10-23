import "server-only";

import { db } from "@/db";
import { listLearnerArtifacts } from "@/features/artifacts/repository";
import { portfolioProcess, type ProcessFeedback } from "./process";
import type { Currency } from "@/features/market-data/contracts";
import { attributeHolding, foldQuoteCost, impliedPurchaseFxUnits } from "./attribution";
import { allocationBasisPoints, foldTrades, valuePortfolio, type HoldingValuation, type TradeSide } from "./domain";
import { decimalToPriceUnits, fxToDecimal, quantityToDecimal, roundDivide } from "./decimal";
import { loadPortfolioPerformance } from "./performance-loader";
import type { PortfolioPerformance } from "./performance";
import { presentTaxView, type TaxView } from "./tax-lots";
import { portfolioExposure, type ExposureDimension, type PortfolioExposure } from "./exposure";
import { perfMeasure } from "@/lib/perf";
import { portfolioMarketData } from "./environment";
import {
  loadPortfolioInstrumentPreview,
  marketDataMode,
  observeAllocationQuote,
  observeHoldingClassification,
  observePortfolioHoldingValue,
  type AllocationQuote,
  type PortfolioInstrumentPreview,
  type ValuationUnavailableReason,
} from "./market-data";
import { getOrCreateActivePortfolio, loadLatestAllocation, loadLedgerRows, loadPortfolioRows, readBrokerFeeProfile, type AllocationLineRow } from "./repository";
import { tradeDecisionCards } from "./decision-cards";

/** Sector or country split of the whole portfolio; "unvalued" while any quote or FX is missing. */
export type PortfolioExposureView =
  | { status: "unvalued"; missingSymbols: string[] }
  | {
    status: "valued";
    categories: Array<{
      key: string;
      kind: "classified" | "unknown" | "cash";
      valueMinor: string;
      weightBasisPoints: string;
      contributions: Array<{ symbol: string; valueMinor: string }>;
    }>;
    unclassified: Array<{ symbol: string; coverage: "none" | "partial" }>;
  };

export interface PortfolioView {
  process: ProcessFeedback;
  feeProfileId: string;
  portfolioId: string;
  baseCurrency: Currency;
  openedAt: string;
  openingCapitalMinor: string;
  earnedPracticeCapitalMinor: string;
  availableCashMinor: string;
  holdingsMarketValueMinor: string | null;
  portfolioTotalMinor: string | null;
  investmentGainLossMinor: string | null;
  performance: PortfolioPerformance;
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
    /** Remaining buy costs; sold portions are already included in realized gain/loss. */
    costEffectMinor?: string;
    fxEffectMinor: string;
    realizedGainLossMinor: string;
    currencies: Array<{ currency: Currency; purchaseFxRate: string; currentFxRate: string; effectMinor: string }>;
  } | null;
  /** Look-through exposure by sector and country, cash included. */
  exposure: Record<ExposureDimension, PortfolioExposureView>;
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
  /** FIFO tranche map and yearly sale proceeds; separate from the weighted-average P&L. */
  tax: TaxView;
  recentActivity: Array<{
    id: string;
    side: "BUY" | "SELL";
    symbol: string;
    name: string;
    quantity: string;
    unitPrice: string;
    quoteCurrency: string;
    grossAmountBaseMinor: string;
    feeBaseMinor?: string;
    fxMarkupBaseMinor?: string | null;
    feeProfileId?: string | null;
    cashDeltaBaseMinor?: string;
    executedAt: string;
  }>;
}

export type InstrumentPreview = PortfolioInstrumentPreview;

export async function loadPortfolioView(userId: string): Promise<PortfolioView> {
  const current = await perfMeasure("portfolio.getOrCreateActivePortfolio", "db", () => getOrCreateActivePortfolio(userId));
  // The saved mix needs only the generation id, so it loads alongside the ledger.
  const [rows, allocation, plans] = await Promise.all([
    loadLedgerRows(userId, current),
    perfMeasure("portfolio.latestAllocation", "db", () => loadLatestAllocation(current.id)),
    perfMeasure("portfolio.processIps", "db", () => listLearnerArtifacts(userId, "investment_plan")),
  ]);
  const baseCurrency = rows.portfolio.baseCurrency as Currency;
  const folded = foldTrades(rows.earnedPracticeCapitalMinor, rows.trades);
  const [observations, classifications] = await Promise.all([
    perfMeasure("portfolio.observeAllHoldings", "external", () => Promise.all(folded.holdings.map((holding) => perfMeasure("portfolio.observeHolding", "external", () => observePortfolioHoldingValue(portfolioMarketData, holding, baseCurrency))))),
    perfMeasure("portfolio.classifyHoldings", "external", () => Promise.all(folded.holdings.map((holding) => observeHoldingClassification(portfolioMarketData, holding)))),
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
  const performance = await loadPortfolioPerformance(portfolioMarketData.service, {
    openedAt: rows.portfolio.openedAt.toISOString(),
    openingCapitalMinor: rows.portfolio.openingCapitalMinor,
    earnedPracticeCapitalMinor: rows.earnedPracticeCapitalMinor,
    receipts: rows.contributions.map(({ at, amountMinor }) => ({ at: at.toISOString(), amountMinor })),
    trades: rows.trades,
    endingMinor: total,
    endedAt: rows.readAt.toISOString(),
    baseCurrency,
  });
  const attributed = new Map(valued.holdings.flatMap((holding) => {
    const observation = observationByInstrument.get(holding.instrumentId);
    if (holding.marketValueMinor === null || !observation?.currentPrice) return [];
    const cost = quoteCost.get(holding.instrumentId)!;
    return [[holding.instrumentId, attributeHolding({
      quoteCurrency: quoteCurrency.get(holding.instrumentId)!,
      quantityUnits: holding.quantityUnits,
      costBasisMinor: holding.referenceCostBasisMinor,
      costQuoteUnits: cost.costQuoteUnits,
      marketValueMinor: holding.marketValueMinor,
      priceUnits: decimalToPriceUnits(observation.currentPrice),
    }, baseCurrency)] as const];
  }));
  const symbolOf = new Map(valued.holdings.map((holding) => [holding.instrumentId, holding.symbol]));
  const classificationOf = new Map(classifications.map((classification) => [classification.instrumentId, classification]));
  const exposureView = (dimension: ExposureDimension): PortfolioExposureView => {
    const exposure: PortfolioExposure = portfolioExposure(folded.cashMinor, valued.holdings.map((holding) => ({
      instrumentId: holding.instrumentId,
      marketValueMinor: holding.marketValueMinor,
      breakdown: classificationOf.get(holding.instrumentId)?.[dimension] ?? null,
    })));
    if (exposure.status === "unvalued") return { status: "unvalued", missingSymbols: exposure.missingInstrumentIds.map((id) => symbolOf.get(id) ?? id) };
    return {
      status: "valued",
      categories: exposure.categories.map((category) => ({
        key: category.key,
        kind: category.kind,
        valueMinor: category.valueMinor.toString(),
        weightBasisPoints: category.weightBasisPoints.toString(),
        contributions: category.kind === "cash" ? [] : category.contributions.map(({ instrumentId, valueMinor }) => ({ symbol: symbolOf.get(instrumentId) ?? instrumentId, valueMinor: valueMinor.toString() })),
      })),
      unclassified: exposure.unclassified.map(({ instrumentId, coverage }) => ({ symbol: symbolOf.get(instrumentId) ?? instrumentId, coverage })),
    };
  };
  const foreign = [...new Set(valued.holdings.map(({ instrumentId }) => quoteCurrency.get(instrumentId)!).filter((currency) => currency !== baseCurrency))];
  const attribution = !valued.complete ? null : {
    priceEffectMinor: [...attributed.values()].reduce((sum, value) => sum + value.priceEffectMinor, 0n).toString(),
    fxEffectMinor: [...attributed.values()].reduce((sum, value) => sum + value.fxEffectMinor, 0n).toString(),
    realizedGainLossMinor: folded.realizedGainLossMinor.toString(),
    costEffectMinor: valued.holdings.reduce((sum, holding) => sum + holding.referenceCostBasisMinor - holding.costBasisMinor, 0n).toString(),
    currencies: foreign.flatMap((currency) => {
      const members = valued.holdings.filter(({ instrumentId }) => quoteCurrency.get(instrumentId) === currency);
      const purchase = impliedPurchaseFxUnits(
        members.reduce((sum, holding) => sum + holding.referenceCostBasisMinor, 0n),
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
    process: portfolioProcess({
      openedAt: rows.portfolio.openedAt.toISOString(), asOf: rows.readAt.toISOString(),
      cashMinor: folded.cashMinor, totalMinor: total,
      holdings: valued.holdings, trades: rows.trades, ips: plans[0] ?? null,
    }),
    feeProfileId: (await readBrokerFeeProfile(db, userId)).id,
    portfolioId: rows.portfolio.id,
    baseCurrency: rows.portfolio.baseCurrency as Currency,
    openedAt: rows.portfolio.openedAt.toISOString(),
    openingCapitalMinor: rows.portfolio.openingCapitalMinor.toString(),
    earnedPracticeCapitalMinor: rows.earnedPracticeCapitalMinor.toString(),
    availableCashMinor: folded.cashMinor.toString(),
    holdingsMarketValueMinor: invested?.toString() ?? null,
    portfolioTotalMinor: valued.portfolioTotalMinor?.toString() ?? null,
    investmentGainLossMinor: valued.investmentGainLossMinor?.toString() ?? null,
    performance,
    valuationComplete: valued.complete,
    valuedHoldingsCount: observations.filter(({ marketValueMinor }) => marketValueMinor !== null).length,
    totalHoldingsCount: folded.holdings.length,
    marketDataMode: marketDataMode(portfolioMarketData),
    realizedGainLossMinor: folded.realizedGainLossMinor.toString(),
    cashWeightBasisPoints: total === null || total <= 0n ? null : allocationBasisPoints(folded.cashMinor, total).toString(),
    attribution,
    exposure: { sector: exposureView("sector"), country: exposureView("country") },
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
        gainLossBasisPoints: holding.gainLossMinor === null || holding.costBasisMinor <= 0n ? null : roundDivide(holding.gainLossMinor * 10_000n, holding.costBasisMinor).toString(),
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
    tax: presentTaxView(rows.trades, rows.readAt),
    recentActivity: rows.trades.slice(-8).reverse().map((trade) => ({
      id: trade.id,
      side: trade.side,
      symbol: trade.instrumentSymbol,
      name: trade.instrumentName,
      quantity: trade.quantity,
      unitPrice: trade.unitPrice,
      quoteCurrency: trade.quoteCurrency,
      grossAmountBaseMinor: trade.grossAmountBaseMinor.toString(),
      feeBaseMinor: trade.feeBaseMinor.toString(),
      fxMarkupBaseMinor: trade.fxMarkupBaseMinor?.toString() ?? null,
      feeProfileId: trade.feeProfileId,
      cashDeltaBaseMinor: trade.cashDeltaBaseMinor.toString(),
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

/** Server-evaluated decision cards for a reviewed trade, with the learner's saved safeguards. */
export async function loadTradeDecisionCards(userId: string, input: { instrumentId: string; side: TradeSide }) {
  const [rows, plans, safeguards] = await Promise.all([
    loadPortfolioRows(userId), listLearnerArtifacts(userId, "investment_plan"), listLearnerArtifacts(userId, "safeguards"),
  ]);
  const baseCurrency = rows.portfolio.baseCurrency as Currency;
  const folded = foldTrades(rows.earnedPracticeCapitalMinor, rows.trades);
  // Only the disposition rule needs gains, so a buy reads no extra quotes.
  const valuations = input.side === "SELL" ? await Promise.all(folded.holdings.map((holding) => observePortfolioHoldingValue(portfolioMarketData, holding, baseCurrency))) : [];
  const rules = safeguards[0]?.kind === "safeguards" ? safeguards[0].payload.rules : [];
  return {
    kinds: tradeDecisionCards({
      ...input, now: rows.readAt, trades: rows.trades, ips: plans[0]?.payload,
      holdings: valuePortfolio(rows.earnedPracticeCapitalMinor, folded, valuations).holdings,
    }),
    safeguards: rules.map(({ trigger, action }) => ({ trigger, action })),
  };
}
