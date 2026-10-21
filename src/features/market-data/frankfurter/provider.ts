import "server-only";

import { z } from "zod";
import {
  currencies,
  type Currency,
  type FxRateProvenance,
  type UtcTimestamp,
} from "../contracts";
import { MarketDataError } from "../errors";
import type { FxRateProvider } from "../provider";
import { FrankfurterClient, FRANKFURTER_PROVIDER_ID } from "./client";

const rateSchema = z.object({
  date: z.string(),
  base: z.string().length(3),
  quote: z.string().length(3),
  rate: z.number().finite().positive(),
});

export type FrankfurterClock = () => Date;

function validCurrency(value: unknown): value is Currency {
  return typeof value === "string" && currencies.includes(value as Currency);
}

function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function malformed(reason: string) {
  return new MarketDataError("MalformedProviderResponse", "Frankfurter returned malformed FX data.", {
    provider: FRANKFURTER_PROVIDER_ID,
    operation: "response-validation",
    endpoint: "v2/rate",
    reason,
  });
}

function provenance(referenceDate: string, retrievedAt: UtcTimestamp): FxRateProvenance {
  return {
    provider: FRANKFURTER_PROVIDER_ID,
    dataset: "v2/rate:blended-reference",
    dataKind: "reference",
    isDeterministic: false,
    isDemo: false,
    referenceDate,
    retrievedAt,
    adjustmentMode: null,
    completeness: "complete",
  };
}

/** Frankfurter v2 adapter for direct, date-based reference FX rates. */
export class FrankfurterFxProvider implements FxRateProvider {
  readonly providerId = FRANKFURTER_PROVIDER_ID;

  constructor(
    private readonly client: FrankfurterClient,
    private readonly clock: FrankfurterClock = () => new Date(),
  ) {}

  async getFxRate(baseCurrency: Currency, quoteCurrency: Currency, asOf: UtcTimestamp) {
    if (!validCurrency(baseCurrency) || !validCurrency(quoteCurrency)) {
      throw new MarketDataError("FxUnavailable", "The requested FX currency is not supported by Investník.", {
        provider: FRANKFURTER_PROVIDER_ID,
        baseCurrency: String(baseCurrency),
        quoteCurrency: String(quoteCurrency),
        reason: "unsupported-currency",
      });
    }
    const retrieved = this.clock();
    if (Number.isNaN(retrieved.getTime())) throw malformed("invalid-retrieval-time");
    const retrievedAt = retrieved.toISOString();
    if (baseCurrency === quoteCurrency) {
      const referenceDate = asOf.slice(0, 10);
      if (!calendarDate(referenceDate)) throw malformed("invalid-reference-date");
      return {
        baseCurrency,
        quoteCurrency,
        rate: 1,
        referenceDate,
        retrievedAt,
        provenance: provenance(referenceDate, retrievedAt),
      };
    }

    const parsed = rateSchema.safeParse(await this.client.getRate(baseCurrency, quoteCurrency, asOf.slice(0, 10)));
    if (!parsed.success) throw malformed("malformed-response");
    const responseBase = parsed.data.base.toLocaleUpperCase("en-US");
    const responseQuote = parsed.data.quote.toLocaleUpperCase("en-US");
    if (responseBase !== baseCurrency || responseQuote !== quoteCurrency) throw malformed("pair-mismatch");
    if (!calendarDate(parsed.data.date)) throw malformed("invalid-reference-date");
    return {
      baseCurrency,
      quoteCurrency,
      rate: parsed.data.rate,
      referenceDate: parsed.data.date,
      retrievedAt,
      provenance: provenance(parsed.data.date, retrievedAt),
    };
  }
}
