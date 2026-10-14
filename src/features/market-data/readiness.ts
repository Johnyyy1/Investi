import "server-only";

import type { FxDataProviderName, MarketDataProviderName } from "./composition";
import { US_EQUITIES_EXCHANGE_MICS, US_EQUITIES_TIME_ZONE } from "./market-session";

const SECURITY_CAPABILITIES = ["search", "profile", "quote", "history"] as const;
const FX_CAPABILITIES = ["reference-rates"] as const;

export interface MarketDataReadinessConfiguration {
  securityProvider: MarketDataProviderName | string;
  fxProvider: FxDataProviderName | string;
  fmpApiKey?: string;
}

/** Safe, side-effect-free diagnostics: configuration and known capabilities only, never credentials or provider URLs. */
export function inspectMarketDataReadiness(configuration: MarketDataReadinessConfiguration) {
  const supportedSecurityProvider = configuration.securityProvider === "deterministic" || configuration.securityProvider === "fmp";
  const supportedFxProvider = configuration.fxProvider === "deterministic" || configuration.fxProvider === "cnb" || configuration.fxProvider === "frankfurter";
  const securityConfigured = supportedSecurityProvider
    && (configuration.securityProvider !== "fmp" || Boolean(configuration.fmpApiKey?.trim()));
  const fxConfigured = supportedFxProvider;

  return {
    ready: securityConfigured && fxConfigured,
    security: {
      provider: configuration.securityProvider,
      configured: securityConfigured,
      capabilities: supportedSecurityProvider ? SECURITY_CAPABILITIES : [],
    },
    fx: {
      provider: configuration.fxProvider,
      configured: fxConfigured,
      requiresApiKey: false,
      capabilities: supportedFxProvider ? FX_CAPABILITIES : [],
    },
    sessions: {
      calendars: [{
        id: "us-equities" as const,
        configured: true,
        timeZone: US_EQUITIES_TIME_ZONE,
        exchangeMics: US_EQUITIES_EXCHANGE_MICS,
        regularSession: "09:30-16:00",
        earlyClosesSupported: false,
      }],
      unknownExchangePolicy: "age-based-conservative" as const,
    },
  };
}
