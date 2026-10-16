import "server-only";

import { lte, sql } from "drizzle-orm";

import type { db as applicationDatabase } from "@/db";
import { rateLimitBucket } from "@/db/schema";
import type { RateLimitCount, RateLimitCounter, RateLimitStore } from "./limiter";

const PURGE_INTERVAL_MILLISECONDS = 15 * 60 * 1_000;
/** Denied hits keep counting; the cap only keeps a hammered counter far from integer overflow. */
const COUNT_CAP = 1_000_000_000;

type Database = Pick<typeof applicationDatabase, "insert" | "delete">;

/**
 * Postgres-backed shared counters. One multi-row INSERT … ON CONFLICT DO UPDATE adds a hit to every
 * counter of a request: Postgres row-locks each conflicting key, so concurrent requests on any
 * instance serialize per key and never lose an increment. A window that has ended restarts at 1.
 * Keys are locked in sorted order so two requests sharing keys cannot deadlock. Errors propagate:
 * a limiter that cannot count denies by failing the request instead of silently allowing it.
 */
export class PostgresRateLimitStore implements RateLimitStore {
  private lastPurge = Number.NEGATIVE_INFINITY;

  constructor(private readonly db: Database) {}

  async increment(counters: readonly RateLimitCounter[], now: number): Promise<RateLimitCount[]> {
    const unique = [...new Map(counters.map((counter) => [counter.key, counter])).values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    if (unique.length === 0) return [];
    for (const counter of unique) {
      if (!Number.isInteger(counter.windowSeconds) || counter.windowSeconds <= 0) throw new Error("A rate-limit window must be a positive whole number of seconds.");
    }
    const startedAt = new Date(now);
    const expired = sql`${rateLimitBucket.expiresAt} <= excluded.window_started_at`;
    const rows = await this.db
      .insert(rateLimitBucket)
      .values(unique.map((counter) => ({ key: counter.key, count: 1, windowStartedAt: startedAt, expiresAt: new Date(now + counter.windowSeconds * 1_000) })))
      .onConflictDoUpdate({
        target: rateLimitBucket.key,
        set: {
          count: sql`case when ${expired} then 1 else least(${rateLimitBucket.count} + 1, ${COUNT_CAP}) end`,
          windowStartedAt: sql`case when ${expired} then excluded.window_started_at else ${rateLimitBucket.windowStartedAt} end`,
          expiresAt: sql`case when ${expired} then excluded.expires_at else ${rateLimitBucket.expiresAt} end`,
        },
      })
      .returning({ key: rateLimitBucket.key, count: rateLimitBucket.count, expiresAt: rateLimitBucket.expiresAt });
    if (now - this.lastPurge >= PURGE_INTERVAL_MILLISECONDS) {
      this.lastPurge = now;
      // Housekeeping only: an expired row is restarted on its next hit anyway, so a failed purge is harmless.
      await this.purgeExpired(now).catch((error: unknown) => console.error("rate-limit purge failed", error instanceof Error ? error.message : "unknown"));
    }
    return rows.map((row) => ({ key: row.key, count: row.count, expiresAt: row.expiresAt.getTime() }));
  }

  async purgeExpired(now: number) {
    await this.db.delete(rateLimitBucket).where(lte(rateLimitBucket.expiresAt, new Date(now)));
  }
}
