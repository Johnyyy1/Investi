import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { perfMeasure } from "@/lib/perf";
import { portfolio, portfolioAllocation, portfolioAllocationLine, portfolioTrade, learningProfile, user } from "@/db/schema";
import { readPracticeCapitalContributions, readPracticeCapitalEntitlementMinor as entitlement } from "@/features/rewards/repository";
import { isDemoIdentity, isGuestIdentity } from "@/features/guest/identity";
import type { Currency } from "@/features/market-data/contracts";
import { planAllocation, validateAllocation, type AllocationInput, type AllocationPlan } from "./allocation";
import { brokerFeeProfile, computeTradeCost, presentTradeCost, type BrokerFeeProfile } from "./costs";
import { foldTrades, type LedgerTrade } from "./domain";
import {
  fxToDecimal,
  PortfolioInputError,
  priceToDecimal,
  quantityToDecimal,
} from "./decimal";
import { portfolioMarketData } from "./environment";
import { observePortfolioExecution, type PortfolioExecutionObservation } from "./market-data";

const BASE_CURRENCY: Currency = "CZK";

export async function readBrokerFeeProfile(query: Pick<typeof db, "select">, userId: string) {
  const [saved] = await query.select({ id: learningProfile.brokerFeeProfileId }).from(learningProfile).where(eq(learningProfile.userId, userId));
  return brokerFeeProfile(saved?.id);
}

export async function setBrokerFeeProfile(userId: string, profileId: string) {
  const profile = brokerFeeProfile(profileId);
  await db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
    if (!owner) throw new PortfolioInputError("PortfolioUnavailable", "Portfolio se nepodařilo najít.");
    await tx.insert(learningProfile).values({ userId, brokerFeeProfileId: profile.id })
      .onConflictDoUpdate({ target: learningProfile.userId, set: { brokerFeeProfileId: profile.id, updatedAt: new Date() } });
  });
  return profile.id;
}

/** Authoritative read-only estimate; execution re-observes and recomputes under lock. */
export async function reviewTrade(userId: string, input: { instrumentId: string; quantity: string; side: "BUY" | "SELL" }) {
  const observation = await observePortfolioExecution(portfolioMarketData, input.instrumentId, input.quantity, BASE_CURRENCY);
  const profile = await readBrokerFeeProfile(db, userId);
  return {
    ...presentTradeCost(computeTradeCost({ ...observation, quoteCurrency: observation.quote.currency, side: input.side, profile }), profile),
    fxReferenceDate: observation.fx.referenceDate, fxProvider: observation.fx.provenance.provider, quoteObservedAt: observation.quote.observedAt,
  };
}

type PortfolioRow = typeof portfolio.$inferSelect;
type TradeRow = typeof portfolioTrade.$inferSelect;

function asLedgerTrade(trade: TradeRow): LedgerTrade {
  return {
    instrumentId: trade.instrumentId,
    instrumentSymbol: trade.instrumentSymbol,
    instrumentName: trade.instrumentName,
    instrumentAssetType: trade.instrumentAssetType,
    side: trade.side,
    quantity: trade.quantity,
    grossAmountBaseMinor: trade.grossAmountBaseMinor,
    feeBaseMinor: trade.feeBaseMinor,
    referenceGrossAmountBaseMinor: trade.referenceGrossAmountBaseMinor,
    cashDeltaBaseMinor: trade.cashDeltaBaseMinor,
  };
}


async function activePortfolio(query: Pick<typeof db, "select">, userId: string) {
  const [row] = await query.select().from(portfolio)
    .where(and(eq(portfolio.userId, userId), isNull(portfolio.closedAt)));
  return row;
}

function tradeValues(portfolioId: string, observation: PortfolioExecutionObservation, side: "BUY" | "SELL", clientIdempotencyKey: string, now: Date, profile: BrokerFeeProfile) {
  const cost = computeTradeCost({ ...observation, quoteCurrency: observation.quote.currency, side, profile });
  return {
    id: randomUUID(),
    portfolioId,
    instrumentId: observation.instrument.instrumentId,
    instrumentSymbol: observation.instrument.symbol,
    instrumentName: observation.instrument.name,
    instrumentAssetType: observation.instrument.assetType,
    side,
    quantity: quantityToDecimal(observation.quantityUnits),
    unitPrice: priceToDecimal(observation.priceUnits),
    quoteCurrency: observation.quote.currency,
    fxRateToBase: fxToDecimal(cost.fxRateUnits),
    grossAmountBaseMinor: cost.grossAmountBaseMinor,
    feeBaseMinor: cost.feeBaseMinor,
    cashDeltaBaseMinor: cost.cashDeltaBaseMinor,
    feeProfileId: profile.id,
    tradeFeeRateBps: profile.tradeFee.rateBps,
    tradeFeeMinMinor: profile.tradeFee.minMinor,
    tradeFeeMaxMinor: profile.tradeFee.maxMinor,
    tradeFeeCurrency: profile.tradeFee.currency,
    fxMarkupBps: cost.fxMarkupBps,
    fxMarkupBaseMinor: cost.fxMarkupBaseMinor,
    referenceFxRateToBase: fxToDecimal(observation.fxUnits),
    referenceGrossAmountBaseMinor: cost.referenceGrossAmountBaseMinor,
    quoteObservedAt: new Date(observation.quote.observedAt),
    executedAt: now,
    marketDataProvider: observation.quote.provenance.provider,
    marketDataDataset: observation.quote.provenance.dataset,
    marketDataKind: observation.quote.provenance.dataKind,
    marketDataIsDeterministic: observation.quote.provenance.isDeterministic,
    fxRateProvider: observation.fx.provenance.provider,
    fxRateDataset: observation.fx.provenance.dataset,
    fxRateKind: observation.fx.provenance.dataKind,
    fxRateIsDeterministic: observation.fx.provenance.isDeterministic,
    fxReferenceDate: observation.fx.referenceDate,
    fxRateRetrievedAt: new Date(observation.fx.retrievedAt),
    clientIdempotencyKey,
  } as const;
}

const demoSeeds = [
  { instrumentId: "US-XNAS:AAPL", quantity: "1" },
  { instrumentId: "IE-XETR:VWCE", quantity: "1" },
] as const;

async function demoObservations() {
  if (portfolioMarketData.provider !== "deterministic") return [];
  return Promise.all(demoSeeds.map((seed) => observePortfolioExecution(
    portfolioMarketData,
    seed.instrumentId,
    seed.quantity,
    BASE_CURRENCY,
  )));
}

/** Lazy, idempotent generation creation. New demo identities receive one seeded ledger. */
export async function getOrCreateActivePortfolio(userId: string) {
  const existing = await activePortfolio(db, userId);
  if (existing) return existing;
  const [owner] = await db.select({ isAnonymous: user.isAnonymous, anonymousKind: user.anonymousKind }).from(user).where(eq(user.id, userId));
  if (!owner) throw new PortfolioInputError("PortfolioUnavailable", "Portfolio se nepodařilo otevřít.");
  // Guests save an account before they get a portfolio, so a guest claim never has trades to move.
  if (isGuestIdentity(owner)) throw new PortfolioInputError("PortfolioUnavailable", "Portfolio Lab otevřeš, až si uložíš účet.");
  const seedObservations = isDemoIdentity(owner) ? await demoObservations() : [];

  return db.transaction(async (tx) => {
    const [lockedOwner] = await tx.select({ isAnonymous: user.isAnonymous, anonymousKind: user.anonymousKind }).from(user).where(eq(user.id, userId)).for("update");
    if (!lockedOwner) throw new PortfolioInputError("PortfolioUnavailable", "Portfolio se nepodařilo otevřít.");
    const current = await activePortfolio(tx, userId);
    if (current) return current;
    const openingCapitalMinor = await entitlement(tx, userId);
    const now = new Date();
    const created: PortfolioRow = {
      id: randomUUID(), userId, baseCurrency: BASE_CURRENCY, openedAt: now, closedAt: null,
      resetFromPortfolioId: null, resetIdempotencyKey: null, openingCapitalMinor,
    };
    await tx.insert(portfolio).values(created);
    if (isDemoIdentity(lockedOwner) && seedObservations.length > 0) {
      const profile = await readBrokerFeeProfile(tx, userId);
      const seeds = seedObservations.map((observation, index) => tradeValues(created.id, observation, "BUY", `demo-seed-v1-${index + 1}`, now, profile));
      const total = seeds.reduce((sum, trade) => sum - trade.cashDeltaBaseMinor, 0n);
      if (total <= openingCapitalMinor) await tx.insert(portfolioTrade).values(seeds);
    }
    return created;
  });
}

export async function executeTrade(userId: string, input: {
  instrumentId: string;
  quantity: string;
  side: "BUY" | "SELL";
  clientIdempotencyKey: string;
  expectedFeeProfileId?: string;
}) {
  const existing = await activePortfolio(db, userId);
  if (existing) {
    const [duplicate] = await db.select().from(portfolioTrade).where(and(
      eq(portfolioTrade.portfolioId, existing.id),
      eq(portfolioTrade.clientIdempotencyKey, input.clientIdempotencyKey),
    ));
    if (duplicate) return { trade: duplicate, duplicate: true };
  }
  const observation = await observePortfolioExecution(
    portfolioMarketData,
    input.instrumentId,
    input.quantity,
    BASE_CURRENCY,
  );
  return db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
    if (!owner) throw new PortfolioInputError("PortfolioUnavailable", "Portfolio se nepodařilo najít.");
    let current = await activePortfolio(tx, userId);
    if (!current) {
      const openingCapitalMinor = await entitlement(tx, userId);
      const [created] = await tx.insert(portfolio).values({
        id: randomUUID(), userId, baseCurrency: BASE_CURRENCY, openedAt: new Date(), openingCapitalMinor,
      }).returning();
      current = created;
    }
    const [duplicate] = await tx.select().from(portfolioTrade).where(and(
      eq(portfolioTrade.portfolioId, current.id),
      eq(portfolioTrade.clientIdempotencyKey, input.clientIdempotencyKey),
    ));
    if (duplicate) return { trade: duplicate, duplicate: true };

    const [earned, trades] = await Promise.all([
      entitlement(tx, userId),
      tx.select().from(portfolioTrade).where(eq(portfolioTrade.portfolioId, current.id)).orderBy(asc(portfolioTrade.executedAt), asc(portfolioTrade.id)),
    ]);
    const folded = foldTrades(earned, trades.map(asLedgerTrade));
    const profile = await readBrokerFeeProfile(tx, userId);
    if (input.expectedFeeProfileId && input.expectedFeeProfileId !== profile.id) throw new PortfolioInputError("PortfolioChanged", "Profil poplatků se změnil. Zkontroluj pokyn znovu.");
    const values = tradeValues(current.id, observation, input.side, input.clientIdempotencyKey, new Date(), profile);
    if (values.grossAmountBaseMinor <= 0n) throw new PortfolioInputError("InvalidQuantity", "Toto množství je po konverzi příliš malé. Zadej větší množství.");
    if (folded.cashMinor + values.cashDeltaBaseMinor < 0n) {
      throw new PortfolioInputError("InsufficientCash", "Na tento obchod včetně nákladů nemáš dost hotovosti.");
    }
    if (input.side === "SELL") {
      const holding = folded.holdings.find(({ instrumentId }) => instrumentId === input.instrumentId);
      if (!holding || observation.quantityUnits > holding.quantityUnits) {
        throw new PortfolioInputError("Oversell", "Nelze prodat více, než kolik pozic držíš.");
      }
    }
    const [trade] = await tx.insert(portfolioTrade).values(values).returning();
    return { trade, duplicate: false };
  });
}

export async function resetActivePortfolio(userId: string, clientIdempotencyKey: string) {
  return db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
    if (!owner) throw new PortfolioInputError("PortfolioUnavailable", "Portfolio se nepodařilo najít.");
    const [duplicate] = await tx.select().from(portfolio).where(and(
      eq(portfolio.userId, userId), eq(portfolio.resetIdempotencyKey, clientIdempotencyKey),
    ));
    if (duplicate) return { portfolio: duplicate, duplicate: true };
    const current = await activePortfolio(tx, userId);
    const now = new Date();
    if (current) await tx.update(portfolio).set({ closedAt: now }).where(and(eq(portfolio.id, current.id), eq(portfolio.userId, userId)));
    const openingCapitalMinor = await entitlement(tx, userId);
    const [created] = await tx.insert(portfolio).values({
      id: randomUUID(), userId, baseCurrency: BASE_CURRENCY, openedAt: now,
      resetFromPortfolioId: current?.id ?? null, resetIdempotencyKey: clientIdempotencyKey, openingCapitalMinor,
    }).returning();
    return { portfolio: created, duplicate: false };
  });
}

export async function loadPortfolioRows(userId: string) {
  return loadLedgerRows(userId, await perfMeasure("portfolio.getOrCreateActivePortfolio", "db", () => getOrCreateActivePortfolio(userId)));
}

/** Entitlement and ordered trades of an already resolved active generation. */
export async function loadLedgerRows(userId: string, current: PortfolioRow) {
  // One MVCC snapshot prevents a concurrent reward/trade from mixing a new cash
  // balance with old dated flows. Mutations retain their existing user-row locks.
  return db.transaction(async (tx) => {
    const contributions = await perfMeasure("portfolio.entitlement", "db", () => readPracticeCapitalContributions(tx, userId));
    const trades = await perfMeasure("portfolio.trades", "db", () => tx.select().from(portfolioTrade).where(eq(portfolioTrade.portfolioId, current.id)).orderBy(asc(portfolioTrade.executedAt), asc(portfolioTrade.id)));
    const earnedPracticeCapitalMinor = contributions.reduce((sum, contribution) => sum + contribution.amountMinor, 0n);
    return { portfolio: current, earnedPracticeCapitalMinor, trades, contributions, readAt: new Date() };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export interface AllocationLineRow {
  instrumentId: string;
  symbol: string;
  name: string;
  assetType: "equity" | "etf" | "bond";
  quoteCurrency: Currency;
  weightBasisPoints: number;
}

export interface SavedAllocation {
  id: string;
  createdAt: Date;
  cashWeightBasisPoints: number;
  appliedValueMinor: bigint;
  lines: AllocationLineRow[];
}

/** The latest saved mix of a generation is its current target; older versions stay for audit. */
export async function loadLatestAllocation(portfolioId: string): Promise<SavedAllocation | null> {
  const [latest] = await db.select().from(portfolioAllocation)
    .where(eq(portfolioAllocation.portfolioId, portfolioId))
    .orderBy(desc(portfolioAllocation.createdAt), desc(portfolioAllocation.id))
    .limit(1);
  if (!latest) return null;
  const lines = await db.select().from(portfolioAllocationLine)
    .where(eq(portfolioAllocationLine.allocationId, latest.id))
    .orderBy(asc(portfolioAllocationLine.position));
  return {
    id: latest.id,
    createdAt: latest.createdAt,
    cashWeightBasisPoints: latest.cashWeightBasisPoints,
    appliedValueMinor: latest.appliedValueMinor,
    lines: lines.map((line) => ({
      instrumentId: line.instrumentId,
      symbol: line.instrumentSymbol,
      name: line.instrumentName,
      assetType: line.instrumentAssetType as AllocationLineRow["assetType"],
      quoteCurrency: line.quoteCurrency as Currency,
      weightBasisPoints: line.weightBasisPoints,
    })),
  };
}

type ExecutionObservations = Map<string, PortfolioExecutionObservation>;

/** One fresh execution observation per instrument the mix touches: every target line and
 * every current holding (a holding outside the mix has a 0 % target and is sold). */
async function observeForAllocation(instrumentIds: readonly string[]): Promise<ExecutionObservations> {
  const observations = await Promise.all(instrumentIds.map((instrumentId) => observePortfolioExecution(portfolioMarketData, instrumentId, "1", BASE_CURRENCY)));
  return new Map(observations.map((observation) => [observation.instrument.instrumentId, observation]));
}

function planningInputs(observations: ExecutionObservations) {
  return new Map([...observations].map(([instrumentId, observation]) => [instrumentId, { priceUnits: observation.priceUnits, fxUnits: observation.fxUnits, quoteCurrency: observation.quote.currency }]));
}

function assertAllocatable(allocation: AllocationInput, observations: ExecutionObservations) {
  for (const line of allocation.lines) {
    const { assetType } = observations.get(line.instrumentId)!.instrument;
    if (assetType !== "equity" && assetType !== "etf" && assetType !== "bond") {
      throw new PortfolioInputError("InvalidInstrument", "Do mixu patří akcie, ETF nebo dluhopisy.");
    }
  }
}

export interface AllocationReview {
  plan: AllocationPlan;
  observations: ExecutionObservations;
}

/** Plans the mix against fresh observations without writing anything. Execution repeats
 * the observation and the plan under the learner lock, so this is an estimate. */
export async function reviewAllocation(userId: string, input: AllocationInput): Promise<AllocationReview> {
  const allocation = validateAllocation(input);
  const rows = await loadPortfolioRows(userId);
  const folded = foldTrades(rows.earnedPracticeCapitalMinor, rows.trades.map(asLedgerTrade));
  const instrumentIds = [...new Set([...allocation.lines.map(({ instrumentId }) => instrumentId), ...folded.holdings.map(({ instrumentId }) => instrumentId)])];
  const observations = await observeForAllocation(instrumentIds);
  assertAllocatable(allocation, observations);
  const plan = planAllocation({ cashMinor: folded.cashMinor, holdings: folded.holdings, observations: planningInputs(observations), allocation, feeProfile: await readBrokerFeeProfile(db, userId) });
  return { plan, observations };
}

/**
 * Saves a target mix and executes it through the append-only ledger. The learner row is
 * locked like every other trade, reset and reward, so cash, holdings and receipts are
 * re-read under the lock and the plan can never overspend or oversell. The client only
 * sends instrument ids, integer weights and an idempotency key.
 */
export async function executeAllocation(userId: string, input: AllocationInput & { clientIdempotencyKey: string }) {
  const allocation = validateAllocation(input);
  const existing = await activePortfolio(db, userId);
  if (existing) {
    const [duplicate] = await db.select().from(portfolioAllocation).where(and(
      eq(portfolioAllocation.portfolioId, existing.id),
      eq(portfolioAllocation.clientIdempotencyKey, input.clientIdempotencyKey),
    ));
    if (duplicate) return { allocationId: duplicate.id, tradeCount: 0, duplicate: true };
  }
  const rows = await loadPortfolioRows(userId);
  const preview = foldTrades(rows.earnedPracticeCapitalMinor, rows.trades.map(asLedgerTrade));
  const observations = await observeForAllocation([...new Set([
    ...allocation.lines.map(({ instrumentId }) => instrumentId),
    ...preview.holdings.map(({ instrumentId }) => instrumentId),
  ])]);
  assertAllocatable(allocation, observations);

  return db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
    if (!owner) throw new PortfolioInputError("PortfolioUnavailable", "Portfolio se nepodařilo najít.");
    const current = await activePortfolio(tx, userId);
    if (!current) throw new PortfolioInputError("PortfolioChanged", "Portfolio se mezitím změnilo. Zkontroluj mix znovu.");
    const [duplicate] = await tx.select().from(portfolioAllocation).where(and(
      eq(portfolioAllocation.portfolioId, current.id),
      eq(portfolioAllocation.clientIdempotencyKey, input.clientIdempotencyKey),
    ));
    if (duplicate) return { allocationId: duplicate.id, tradeCount: 0, duplicate: true };

    const [earned, trades] = await Promise.all([
      entitlement(tx, userId),
      tx.select().from(portfolioTrade).where(eq(portfolioTrade.portfolioId, current.id)).orderBy(asc(portfolioTrade.executedAt), asc(portfolioTrade.id)),
    ]);
    const folded = foldTrades(earned, trades.map(asLedgerTrade));
    if (folded.holdings.some(({ instrumentId }) => !observations.has(instrumentId))) {
      throw new PortfolioInputError("PortfolioChanged", "Portfolio se mezitím změnilo. Zkontroluj mix znovu.");
    }
    const profile = await readBrokerFeeProfile(tx, userId);
    const plan = planAllocation({ cashMinor: folded.cashMinor, holdings: folded.holdings, observations: planningInputs(observations), allocation, feeProfile: profile });
    const now = new Date();
    const allocationId = randomUUID();
    await tx.insert(portfolioAllocation).values({
      id: allocationId,
      portfolioId: current.id,
      createdAt: now,
      cashWeightBasisPoints: allocation.cashWeightBasisPoints,
      appliedValueMinor: plan.totalValueMinor,
      clientIdempotencyKey: input.clientIdempotencyKey,
    });
    await tx.insert(portfolioAllocationLine).values(allocation.lines.map((line, position) => {
      const { instrument } = observations.get(line.instrumentId)!;
      return {
        allocationId,
        position,
        instrumentId: instrument.instrumentId,
        instrumentSymbol: instrument.symbol,
        instrumentName: instrument.name,
        instrumentAssetType: instrument.assetType,
        quoteCurrency: instrument.quoteCurrency,
        weightBasisPoints: line.weightBasisPoints,
      };
    }));
    if (plan.trades.length > 0) {
      await tx.insert(portfolioTrade).values(plan.trades.map((planned, index) => tradeValues(
        current.id,
        { ...observations.get(planned.instrumentId)!, quantityUnits: planned.quantityUnits, grossMinor: planned.grossMinor },
        planned.side,
        `allocation:${input.clientIdempotencyKey}:${index}`,
        now,
        profile,
      )));
    }
    return { allocationId, tradeCount: plan.trades.length, duplicate: false };
  });
}
