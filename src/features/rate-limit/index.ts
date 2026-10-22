import "server-only";

import { db } from "@/db";
import { env } from "@/lib/env";
import { RateLimiter } from "./limiter";
import { marketDataBuckets, type MarketDataFamily } from "./policy";
import { PostgresRateLimitStore } from "./postgres-store";

/** The application's limiter: counters live in Postgres, so every instance enforces the same limits. */
export const rateLimiter = new RateLimiter({ store: new PostgresRateLimitStore(db), secret: env.BETTER_AUTH_SECRET });

/** Counts one market-data request of `lookups` instruments for the user; throws RequestRateLimitedError when over budget. */
export function enforceMarketDataBudget(userId: string, family: MarketDataFamily, lookups = 1) {
  return rateLimiter.enforce(marketDataBuckets(userId, family, lookups));
}
