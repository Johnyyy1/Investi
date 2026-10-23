import "server-only";

import { and, eq, gt, lte, sql } from "drizzle-orm";

import type { db as applicationDatabase } from "@/db";
import { marketDataCache } from "@/db/schema";
import type { MarketDataCacheFamily, SharedMarketDataCacheEntry, SharedMarketDataCacheStore } from "./cache";

/** Bump whenever a cached contract shape changes so rows written by older deployments are ignored. */
export const MARKET_DATA_CACHE_FORMAT_VERSION = 1;
export const MARKET_DATA_CACHE_MAX_KEY_LENGTH = 512;

type Database = Pick<typeof applicationDatabase, "select" | "insert" | "delete">;

/** JSON would silently turn NaN/Infinity into null; such a value is kept out of the shared store. */
function isLosslessJson(value: unknown) {
  let lossless = true;
  try {
    JSON.stringify(value, (_key, item: unknown) => {
      if ((typeof item === "number" && !Number.isFinite(item)) || typeof item === "function" || typeof item === "symbol") lossless = false;
      return item;
    });
  } catch {
    return false;
  }
  return lossless;
}

/**
 * Postgres-backed shared layer: one row per (family, key) with an explicit expiry. Reads filter on
 * the caller's clock so an expired row is never served; writes upsert; the daily cron deletes expired
 * rows. Errors propagate to TieredMarketDataCache, which
 * treats them as a miss.
 */
export class PostgresMarketDataCacheStore implements SharedMarketDataCacheStore {
  constructor(private readonly db: Database) {}

  async get(family: MarketDataCacheFamily, key: string, now: number): Promise<SharedMarketDataCacheEntry | undefined> {
    if (key.length > MARKET_DATA_CACHE_MAX_KEY_LENGTH) return undefined;
    const [row] = await this.db
      .select({ value: marketDataCache.value, expiresAt: marketDataCache.expiresAt })
      .from(marketDataCache)
      .where(and(
        eq(marketDataCache.family, family),
        eq(marketDataCache.cacheKey, key),
        eq(marketDataCache.formatVersion, MARKET_DATA_CACHE_FORMAT_VERSION),
        gt(marketDataCache.expiresAt, new Date(now)),
      ))
      .limit(1);
    return row ? { value: row.value, expiresAt: row.expiresAt.getTime() } : undefined;
  }

  async set(family: MarketDataCacheFamily, key: string, value: unknown, expiresAt: number, now: number) {
    if (key.length > MARKET_DATA_CACHE_MAX_KEY_LENGTH || !(expiresAt > now) || value === undefined || value === null || !isLosslessJson(value)) return;
    await this.db
      .insert(marketDataCache)
      .values({
        family,
        cacheKey: key,
        formatVersion: MARKET_DATA_CACHE_FORMAT_VERSION,
        value,
        storedAt: new Date(now),
        expiresAt: new Date(expiresAt),
      })
      .onConflictDoUpdate({
        target: [marketDataCache.family, marketDataCache.cacheKey],
        set: {
          formatVersion: sql`excluded.format_version`,
          value: sql`excluded.value`,
          storedAt: sql`excluded.stored_at`,
          expiresAt: sql`excluded.expires_at`,
        },
      });
  }

  async purgeExpired(now: number) {
    await this.db.delete(marketDataCache).where(lte(marketDataCache.expiresAt, new Date(now)));
  }
}
