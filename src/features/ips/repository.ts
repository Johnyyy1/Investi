import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, like } from "drizzle-orm";
import { db } from "@/db";
import { learnerArtifact, portfolio, portfolioAllocation, portfolioAllocationLine, user } from "@/db/schema";
import { isGuestIdentity } from "@/features/guest/identity";
import { portfolioMarketData } from "@/features/portfolio/environment";
import { PortfolioInputError } from "@/features/portfolio/decimal";
import { artifactContentSchema } from "@/features/artifacts/schemas";
import { ipsTargetAllocation } from "./allocation";
import { ipsSchema } from "./schema";

export async function readIpsPortfolioId(userId: string) {
  const [current] = await db.select({ id: portfolio.id }).from(portfolio).where(and(eq(portfolio.userId, userId), isNull(portfolio.closedAt)));
  return current?.id ?? null;
}

/** Save intent only. Reuses the allocation tables, validation and learner lock; never plans or writes trades. */
export async function applyIpsTarget(userId: string, input: { artifactId: string; portfolioId: string; requestId: string }) {
  return db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: user.id, isAnonymous: user.isAnonymous, anonymousKind: user.anonymousKind }).from(user).where(eq(user.id, userId)).for("update");
    if (!owner || isGuestIdentity(owner)) throw new Error("Saved identity required");
    const [current] = await tx.select().from(portfolio).where(and(eq(portfolio.userId, userId), isNull(portfolio.closedAt)));
    if (!current || current.id !== input.portfolioId) throw new PortfolioInputError("PortfolioChanged", "Portfolio se mezitím změnilo. Otevři znovu Portfolio Lab a zkontroluj plán.");
    // The namespaced key cannot be reused by the existing action that executes a mix.
    const key = `ips:${input.artifactId}:${input.requestId}`;
    const [retry] = await tx.select().from(portfolioAllocation).where(and(eq(portfolioAllocation.portfolioId, current.id), like(portfolioAllocation.clientIdempotencyKey, `ips:%:${input.requestId}`)));
    const [latest] = await tx.select().from(learnerArtifact).where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.kind, "investment_plan"))).orderBy(desc(learnerArtifact.version)).limit(1);
    if (!latest || latest.id !== input.artifactId) throw new PortfolioInputError("InvalidAllocation", "Plán se mezitím změnil nebo je smazaný. Načti jeho aktuální verzi.");
    const content = artifactContentSchema.parse({ kind: latest.kind, payload: latest.payload });
    const plan = ipsSchema.parse(content.payload);
    const allocation = ipsTargetAllocation(plan);
    if (retry) {
      const saved = await tx.select().from(portfolioAllocationLine).where(eq(portfolioAllocationLine.allocationId, retry.id)).orderBy(portfolioAllocationLine.position);
      if (retry.clientIdempotencyKey !== key || retry.cashWeightBasisPoints !== allocation.cashWeightBasisPoints || JSON.stringify(saved.map((line) => ({ instrumentId: line.instrumentId, weightBasisPoints: line.weightBasisPoints }))) !== JSON.stringify(allocation.lines)) throw new PortfolioInputError("InvalidAllocation", "Tento požadavek už patří jinému mixu. Zkontroluj plán znovu.");
      return { allocationId: retry.id, duplicate: true };
    }
    // Metadata only: a target is valid even when the market is closed or a price is unavailable.
    const instruments = await Promise.all(allocation.lines.map(({ instrumentId }) => portfolioMarketData.service.getInstrumentMetadata(instrumentId)));
    if (instruments.some((instrument, i) => !instrument || instrument.instrumentId !== allocation.lines[i].instrumentId || !["equity", "etf", "bond"].includes(instrument.assetType))) throw new PortfolioInputError("InvalidInstrument", "Pro jeden z nástrojů chybí ověřené údaje. Vyber dostupné akcie, ETF nebo dluhopisy v Labu.");
    const [previous] = await tx.select({ createdAt: portfolioAllocation.createdAt }).from(portfolioAllocation).where(eq(portfolioAllocation.portfolioId, current.id)).orderBy(desc(portfolioAllocation.createdAt)).limit(1);
    const createdAt = new Date(Math.max(Date.now(), (previous?.createdAt.getTime() ?? 0) + 1));
    const allocationId = randomUUID();
    await tx.insert(portfolioAllocation).values({ id: allocationId, portfolioId: current.id, createdAt, cashWeightBasisPoints: allocation.cashWeightBasisPoints,
      appliedValueMinor: 0n, clientIdempotencyKey: key }); // No capital was applied; this record expresses intent only.
    await tx.insert(portfolioAllocationLine).values(allocation.lines.map((line, position) => {
      const instrument = instruments[position]!;
      return { allocationId, position, instrumentId: instrument.instrumentId, instrumentSymbol: instrument.symbol,
        instrumentName: instrument.name, instrumentAssetType: instrument.assetType, quoteCurrency: instrument.quoteCurrency, weightBasisPoints: line.weightBasisPoints };
    }));
    return { allocationId, duplicate: false };
  });
}
