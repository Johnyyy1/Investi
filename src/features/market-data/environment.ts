import "server-only";

import { db } from "@/db";
import { env } from "@/lib/env";
import { MarketDataError } from "./errors";
import { createMarketDataService } from "./composition";
import type { FxDataProviderName, MarketDataProviderName } from "./composition";
import { PostgresMarketDataCacheStore } from "./postgres-cache";

let configuredService: ReturnType<typeof createMarketDataService> | undefined;

/** Server-only application composition; importing this module never exposes provider secrets to clients. */
export function createConfiguredMarketDataService() {
  const deterministicNow = env.MARKET_DATA_PROVIDER === "deterministic" ? env.DETERMINISTIC_MARKET_NOW : undefined;
  return createMarketDataService({
    provider: env.MARKET_DATA_PROVIDER,
    fxProvider: env.FX_DATA_PROVIDER,
    fmpApiKey: env.FMP_API_KEY,
    sharedCache: new PostgresMarketDataCacheStore(db),
    ...(deterministicNow ? { clock: () => new Date(deterministicNow) } : {}),
  });
}

/** Process-local singleton so in-flight coalescing and the local cache layer are shared; the Postgres layer spans instances. */
export function getConfiguredMarketDataService() {
  configuredService ??= createConfiguredMarketDataService();
  return configuredService;
}

export function getConfiguredMarketDataProviderName(): MarketDataProviderName {
  return env.MARKET_DATA_PROVIDER;
}

export function getConfiguredFxDataProviderName(): FxDataProviderName {
  if (env.FX_DATA_PROVIDER) return env.FX_DATA_PROVIDER;
  if (env.MARKET_DATA_PROVIDER === "deterministic") return "deterministic";
  throw new MarketDataError("ProviderConfiguration", "FX_DATA_PROVIDER must be configured when MARKET_DATA_PROVIDER=fmp.", {
    provider: env.MARKET_DATA_PROVIDER,
    operation: "configuration",
    reason: "missing-fx-provider",
  });
}
