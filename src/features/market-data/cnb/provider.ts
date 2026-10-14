import "server-only";

import { currencies, type Currency, type FxRate, type FxRateProvenance, type UtcTimestamp } from "../contracts";
import { isMarketDataError, MarketDataError } from "../errors";
import type { FxRateProvider } from "../provider";
import { CnbClient, type CnbClientOptions } from "./client";
import { CNB_PROVIDER_ID, parseCnbDailyRates } from "./parse";

export const CNB_FX_CACHE_MILLISECONDS = 60 * 60 * 1_000;

export type CnbClock = () => Date;

function provenance(referenceDate: string, retrievedAt: UtcTimestamp): FxRateProvenance {
  return {
    provider: CNB_PROVIDER_ID,
    dataset: "denni_kurz:fixing",
    dataKind: "reference",
    isDeterministic: false,
    isDemo: false,
    referenceDate,
    retrievedAt,
    adjustmentMode: null,
    completeness: "complete",
  };
}

/**
 * ČNB daily fixing adapter. ČNB publishes CZK per foreign unit, so only X/CZK pairs
 * are served directly; other pairs are reported unavailable instead of triangulated.
 */
export class CnbFxProvider implements FxRateProvider {
  readonly providerId = CNB_PROVIDER_ID;

  constructor(
    private readonly client: CnbClient,
    private readonly clock: CnbClock = () => new Date(),
  ) {}

  async getFxRate(baseCurrency: Currency, quoteCurrency: Currency, asOf: UtcTimestamp): Promise<FxRate> {
    if (!currencies.includes(baseCurrency) || quoteCurrency !== "CZK") {
      throw new MarketDataError("FxUnavailable", "ČNB publishes rates against CZK only.", {
        provider: CNB_PROVIDER_ID,
        baseCurrency: String(baseCurrency),
        quoteCurrency: String(quoteCurrency),
        reason: "unsupported-pair",
      });
    }
    const retrievedAt = this.clock().toISOString();
    const requestedDate = asOf.slice(0, 10);
    if (baseCurrency === "CZK") {
      return { baseCurrency, quoteCurrency, rate: 1, referenceDate: requestedDate, retrievedAt, provenance: provenance(requestedDate, retrievedAt) };
    }

    let parsed;
    try {
      parsed = parseCnbDailyRates(await this.client.getDailyRates(requestedDate));
    } catch (error) {
      if (isMarketDataError(error) && error.code === "MalformedProviderResponse") {
        console.error("[market-data:cnb]", error.code, error.message, error.context);
      }
      throw error;
    }
    const rate = parsed.rates.get(baseCurrency);
    if (rate === undefined) {
      const error = new MarketDataError("FxUnavailable", "ČNB did not publish the requested currency.", {
        provider: CNB_PROVIDER_ID,
        baseCurrency,
        referenceDate: parsed.date,
        reason: "missing-currency",
      });
      console.error("[market-data:cnb]", error.code, error.message, error.context);
      throw error;
    }
    return { baseCurrency, quoteCurrency, rate, referenceDate: parsed.date, retrievedAt, provenance: provenance(parsed.date, retrievedAt) };
  }
}

export function createCnbFxProvider(options: CnbClientOptions & { clock?: CnbClock } = {}) {
  return new CnbFxProvider(new CnbClient({ url: options.url, fetch: options.fetch }), options.clock);
}
