import { asc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  emailDelivery, account, learningProfile, lesson, lessonAward, lessonProgress, learningModule, portfolio, portfolioAllocation,
  portfolioAllocationLine, portfolioTrade, progressionUnlock, session, user, learnerArtifact,
} from "@/db/schema";

/**
 * Personal-data export (GDPR art. 15 and 20): every row Investník keeps about one user, in a stable,
 * machine-readable shape. Secrets are never selected: no password hash, OAuth tokens or session tokens.
 * Money stays in integer minor units and decimals stay as the exact strings PostgreSQL returns.
 */
export const ACCOUNT_EXPORT_FORMAT_VERSION = 1;

type Database = PostgresJsDatabase<Record<string, unknown>>;

export async function readAccountExportRows(database: Database, userId: string) {
  const [owner] = await database.select({
    id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, image: user.image,
    isAnonymous: user.isAnonymous, anonymousKind: user.anonymousKind, createdAt: user.createdAt, updatedAt: user.updatedAt,
  }).from(user).where(eq(user.id, userId));
  if (!owner) return null;
  const [accounts, sessions, profiles, progress, awards, unlocks, portfolios, artifacts, deliveries] = await Promise.all([
    database.select({ providerId: account.providerId, accountId: account.accountId, scope: account.scope, createdAt: account.createdAt, updatedAt: account.updatedAt })
      .from(account).where(eq(account.userId, userId)).orderBy(asc(account.createdAt)),
    database.select({ createdAt: session.createdAt, updatedAt: session.updatedAt, expiresAt: session.expiresAt, ipAddress: session.ipAddress, userAgent: session.userAgent })
      .from(session).where(eq(session.userId, userId)).orderBy(asc(session.createdAt)),
    database.select().from(learningProfile).where(eq(learningProfile.userId, userId)),
    database.select({ moduleSlug: learningModule.slug, lessonSlug: lesson.slug, lessonTitle: lesson.title, status: lessonProgress.status, lastPosition: lessonProgress.lastPosition, completedAt: lessonProgress.completedAt, updatedAt: lessonProgress.updatedAt })
      .from(lessonProgress).innerJoin(lesson, eq(lesson.id, lessonProgress.lessonId)).innerJoin(learningModule, eq(learningModule.id, lesson.moduleId))
      .where(eq(lessonProgress.userId, userId)).orderBy(asc(lessonProgress.updatedAt), asc(lesson.slug)),
    database.select({ moduleSlug: learningModule.slug, lessonSlug: lesson.slug, xp: lessonAward.xp, practiceCapitalMinor: lessonAward.practiceCapitalMinor, rewardPolicyVersion: lessonAward.rewardPolicyVersion, learningDate: lessonAward.learningDate, timeZone: lessonAward.timeZone, awardedAt: lessonAward.awardedAt })
      .from(lessonAward).innerJoin(lesson, eq(lesson.id, lessonAward.lessonId)).innerJoin(learningModule, eq(learningModule.id, lesson.moduleId))
      .where(eq(lessonAward.userId, userId)).orderBy(asc(lessonAward.awardedAt), asc(lesson.slug)),
    database.select().from(progressionUnlock).where(eq(progressionUnlock.userId, userId)).orderBy(asc(progressionUnlock.unlockedAt)),
    database.select().from(portfolio).where(eq(portfolio.userId, userId)).orderBy(asc(portfolio.openedAt)),
    database.select().from(learnerArtifact).where(eq(learnerArtifact.userId, userId)).orderBy(asc(learnerArtifact.kind), asc(learnerArtifact.version)),
    database.select().from(emailDelivery).where(eq(emailDelivery.userId, userId)).orderBy(asc(emailDelivery.createdAt)),
  ]);
  const portfolioIds = portfolios.map((row) => row.id);
  const [trades, allocations] = portfolioIds.length === 0 ? [[], []] : await Promise.all([
    database.select().from(portfolioTrade).where(inArray(portfolioTrade.portfolioId, portfolioIds)).orderBy(asc(portfolioTrade.executedAt), asc(portfolioTrade.id)),
    database.select().from(portfolioAllocation).where(inArray(portfolioAllocation.portfolioId, portfolioIds)).orderBy(asc(portfolioAllocation.createdAt)),
  ]);
  const allocationIds = allocations.map((row) => row.id);
  const lines = allocationIds.length === 0 ? [] : await database.select().from(portfolioAllocationLine)
    .where(inArray(portfolioAllocationLine.allocationId, allocationIds)).orderBy(asc(portfolioAllocationLine.position));
  return { owner, accounts, sessions, profile: profiles.at(0) ?? null, progress, awards, unlocks, portfolios, trades, allocations, lines, artifacts, deliveries };
}

export type AccountExportRows = NonNullable<Awaited<ReturnType<typeof readAccountExportRows>>>;

/** A row without its owner key, which only repeats the parent it is nested under. */
function withoutKey<T extends object, K extends keyof T>(row: T, key: K) {
  return Object.fromEntries(Object.entries(row).filter(([name]) => name !== key)) as Omit<T, K>;
}

/** Nests trades and target mixes under their portfolio generation and drops internal foreign keys. */
export function buildAccountExport(rows: AccountExportRows, exportedAt = new Date()) {
  return {
    format: "investi-account-export",
    formatVersion: ACCOUNT_EXPORT_FORMAT_VERSION,
    exportedAt,
    notes: [
      "Practice Capital and portfolio amounts are educational practice money in integer minor units (1 CZK = 100), not real money.",
      "Quantities, prices and FX rates are exact decimal strings.",
      "Passwords, OAuth tokens and session tokens are never exported.",
    ],
    user: rows.owner,
    signInMethods: rows.accounts,
    emailDeliveries: rows.deliveries.map((delivery) => withoutKey(delivery, "userId")),
    sessions: rows.sessions,
    learningProfile: rows.profile ? withoutKey(rows.profile, "userId") : null,
    lessonProgress: rows.progress,
    learnerArtifacts: rows.artifacts.map((artifact) => withoutKey(withoutKey(artifact, "userId"), "requestId")),
    lessonRewardReceipts: rows.awards,
    progressionUnlocks: rows.unlocks.map((unlock) => withoutKey(unlock, "userId")),
    portfolios: rows.portfolios.map((generation) => ({
      ...withoutKey(generation, "userId"),
      trades: rows.trades.filter((trade) => trade.portfolioId === generation.id).map((trade) => withoutKey(trade, "portfolioId")),
      targetMixes: rows.allocations.filter((allocation) => allocation.portfolioId === generation.id).map((allocation) => ({
        ...withoutKey(allocation, "portfolioId"),
        lines: rows.lines.filter((line) => line.allocationId === allocation.id).map((line) => withoutKey(line, "allocationId")),
      })),
    })),
  };
}

/** JSON with bigint minor units as decimal strings; Dates already serialize as ISO-8601 UTC. */
export function serializeAccountExport(data: ReturnType<typeof buildAccountExport>) {
  return JSON.stringify(data, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2);
}

export function accountExportFilename(exportedAt: Date) {
  return `investnik-moje-data-${exportedAt.toISOString().slice(0, 10)}.json`;
}
