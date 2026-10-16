import "server-only";

import { TieredMarketDataCache, type SharedMarketDataCacheStore } from "./cache";
import { FIXTURE_RETRIEVED_AT } from "./deterministic/fixtures";
import { DeterministicMarketDataProvider } from "./deterministic/provider";
import { DeterministicEquityFundamentalsProvider } from "./deterministic/fundamentals";
import { DeterministicEtfAnalyticsProvider } from "./deterministic/etf-analytics";
import type { FmpClientOptions } from "./fmp/client";
import { FmpClient } from "./fmp/client";
import { FmpMarketDataProvider } from "./fmp/provider";
import { FmpEquityFundamentalsProvider } from "./fmp/equity-fundamentals";
import { FmpEtfAnalyticsProvider } from "./fmp/etf-analytics";
import type { CnbClientOptions } from "./cnb/client";
import { CNB_FX_CACHE_MILLISECONDS, createCnbFxProvider } from "./cnb/provider";
import type { FrankfurterClientOptions } from "./frankfurter/client";
import { createFrankfurterFxProvider, FRANKFURTER_FX_CACHE_MILLISECONDS } from "./frankfurter/service";
import { MarketDataError } from "./errors";
import { MarketDataService, type MarketDataServiceOptions } from "./service";

export type MarketDataProviderName = "deterministic" | "fmp";
export type FxDataProviderName = "deterministic" | "cnb" | "frankfurter";

export interface MarketDataCompositionOptions extends Omit<MarketDataServiceOptions, "fxProvider"> {
  provider: MarketDataProviderName | string;
  fxProvider?: FxDataProviderName | string;
  fmpApiKey?: string;
  fmpBaseUrl?: string;
  frankfurterBaseUrl?: string;
  fetch?: FmpClientOptions["fetch"];
  frankfurterFetch?: FrankfurterClientOptions["fetch"];
  cnbFetch?: CnbClientOptions["fetch"];
  /** Cross-instance layer behind the process-local cache; only used when external providers are configured. */
  sharedCache?: SharedMarketDataCacheStore;
}

/** Pure composition boundary. Environment access is deliberately kept in environment.ts. */
export function createMarketDataService(options: MarketDataCompositionOptions) {
  const {
    provider,
    fxProvider: configuredFxProvider,
    fmpApiKey,
    fmpBaseUrl,
    frankfurterBaseUrl,
    fetch,
    frankfurterFetch,
    cnbFetch,
    sharedCache,
    ...serviceOptions
  } = options;
  const fxProviderName = configuredFxProvider ?? (provider === "deterministic" ? "deterministic" : undefined);
  if (!fxProviderName) {
    throw new MarketDataError("ProviderConfiguration", "FX_DATA_PROVIDER must be set when live security data is selected.", {
      provider,
      operation: "configuration",
      reason: "missing-fx-provider",
    });
  }
  const clock = serviceOptions.clock ?? (provider === "deterministic" && fxProviderName === "deterministic"
    ? () => new Date(FIXTURE_RETRIEVED_AT)
    : () => new Date());

  const fmpClient = provider === "fmp" ? new FmpClient({ apiKey: fmpApiKey, baseUrl: fmpBaseUrl, fetch }) : undefined;
  const securityProvider = provider === "deterministic"
    ? new DeterministicMarketDataProvider(clock)
    : provider === "fmp"
      ? new FmpMarketDataProvider(fmpClient!, clock)
      : undefined;
  if (!securityProvider) {
    throw new MarketDataError("ProviderConfiguration", "The configured market-data provider is not supported.", { provider });
  }

  const fxProvider = fxProviderName === "deterministic"
    ? provider === "deterministic" ? securityProvider : new DeterministicMarketDataProvider(clock)
    : fxProviderName === "cnb"
      ? createCnbFxProvider({ fetch: cnbFetch, clock })
      : fxProviderName === "frankfurter"
        ? createFrankfurterFxProvider({ baseUrl: frankfurterBaseUrl, fetch: frankfurterFetch, clock })
        : undefined;
  if (!fxProvider) {
    throw new MarketDataError("ProviderConfiguration", "The configured FX data provider is not supported.", { fxProvider: fxProviderName });
  }

  const externalData = provider === "fmp" || fxProviderName === "frankfurter" || fxProviderName === "cnb";
  const cache = serviceOptions.cache ?? (externalData
    ? new TieredMarketDataCache({
        clock: () => clock().getTime(),
        shared: sharedCache,
        ttls: fxProviderName === "frankfurter" ? { fxMilliseconds: FRANKFURTER_FX_CACHE_MILLISECONDS }
          : fxProviderName === "cnb" ? { fxMilliseconds: CNB_FX_CACHE_MILLISECONDS } : undefined,
      })
    : undefined);
  const equityFundamentalsProvider = provider === "deterministic" ? new DeterministicEquityFundamentalsProvider(clock) : new FmpEquityFundamentalsProvider(fmpClient!, clock);
  const etfAnalyticsProvider = provider === "deterministic" ? new DeterministicEtfAnalyticsProvider(clock) : new FmpEtfAnalyticsProvider(fmpClient!, clock);
  return new MarketDataService(securityProvider, { ...serviceOptions, ...(cache ? { cache } : {}), clock, fxProvider, equityFundamentalsProvider, etfAnalyticsProvider });
}
