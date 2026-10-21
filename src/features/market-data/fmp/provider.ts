import "server-only";

import { z } from "zod";
import {
  adjustmentPolicies,
  currencies,
  type CorporateActionsRequest,
  type Currency,
  type FxRateProvenance,
  type HistoricalPricePoint,
  type HistoricalPriceRequest,
  type Instrument,
  type InstrumentId,
  type InstrumentSearchResult,
  type MarketDataProvenance,
  type UtcTimestamp,
} from "../contracts";
import { instrumentNotFound, MarketDataError } from "../errors";
import type { MarketDataProvider } from "../provider";
import { FmpClient, FMP_PROVIDER_ID } from "./client";

const legacyInstrumentIdSchema = z.string().regex(/^[A-Z]{2}-[A-Z0-9]{4}:[A-Za-z0-9.^_-]{1,40}$/);
const searchResultSchema = z.object({
  symbol: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(300),
  currency: z.string().trim().min(1).max(12),
  exchange: z.string().trim().min(1).max(80),
  exchangeFullName: z.string().trim().min(1).max(200),
});
const quoteSchema = z.object({
  symbol: z.string().min(1),
  price: z.number().finite().positive(),
  timestamp: z.number().int().nonnegative(),
});
const profileSchema = z.object({
  symbol: z.string().min(1),
  companyName: z.string().min(1),
  currency: z.string().min(1),
  exchange: z.string().min(1),
  isEtf: z.boolean(),
  isFund: z.boolean(),
  sector: z.unknown().optional(),
  industry: z.unknown().optional(),
  country: z.unknown().optional(),
  marketCap: z.unknown().optional(),
});

function optionalText(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function optionalPositiveNumber(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null; }
const historicalPointSchema = z.object({
  symbol: z.string().min(1),
  date: z.string().min(1),
  open: z.number().finite().nonnegative(),
  high: z.number().finite().nonnegative(),
  low: z.number().finite().nonnegative(),
  close: z.number().finite().nonnegative(),
  volume: z.number().finite().nonnegative(),
});
/** One EOD response holds at most this many rows (the newest ones); older rows need another request. */
const FMP_HISTORY_ROW_LIMIT = 5_000;
/** 8 × 5,000 trading days is far beyond any listed history; hitting it marks the series partial. */
const FMP_HISTORY_MAX_PAGES = 8;

const exchangeMics: Readonly<Record<string, string>> = {
  AMEX: "XASE",
  ASX: "XASX",
  LSE: "XLON",
  NASDAQ: "XNAS",
  NYSE: "XNYS",
  SIX: "XSWX",
  TSX: "XTSE",
  XETRA: "XETR",
};
const exchangeCodesByMic = Object.fromEntries(Object.entries(exchangeMics).map(([code, mic]) => [mic, code]));
const FMP_INSTRUMENT_PREFIX = "FMP:";
const SEARCH_RESULT_LIMIT = 20;

interface InstrumentReference {
  instrumentId: InstrumentId;
  symbol: string;
  exchangeCode: string | null;
  exchangeMic: string | null;
}

export type FmpClock = () => Date;

function invalidProviderResponse(endpoint: string, reason: string) {
  return new MarketDataError("MalformedProviderResponse", "Financial Modeling Prep returned malformed market data.", {
    provider: FMP_PROVIDER_ID,
    operation: "response-validation",
    endpoint,
    reason,
  });
}

function parseArray<T extends z.ZodType>(endpoint: string, schema: T, payload: unknown): z.infer<T>[] {
  const result = z.array(schema).safeParse(payload);
  if (!result.success) throw invalidProviderResponse(endpoint, "malformed-response");
  return result.data;
}

function referenceFromInstrumentId(instrumentId: InstrumentId): InstrumentReference {
  if (instrumentId.startsWith(FMP_INSTRUMENT_PREFIX)) {
    const parts = instrumentId.slice(FMP_INSTRUMENT_PREFIX.length).split(":");
    if (parts.length === 2) {
      try {
        const exchangeCode = decodeURIComponent(parts[0]).toLocaleUpperCase("en-US");
        const symbol = decodeURIComponent(parts[1]);
        if (exchangeCode && symbol && !/[\u0000-\u001f\u007f]/.test(`${exchangeCode}${symbol}`)) {
          return {
            instrumentId,
            exchangeCode,
            exchangeMic: exchangeMics[exchangeCode] ?? null,
            symbol,
          };
        }
      } catch {
        // Fall through to the normalized unsupported-instrument error.
      }
    }
  }

  const parsed = legacyInstrumentIdSchema.safeParse(instrumentId);
  if (parsed.success) {
    const separator = instrumentId.indexOf(":");
    const exchangeMic = instrumentId.slice(3, separator);
    return {
      instrumentId,
      exchangeCode: exchangeCodesByMic[exchangeMic] ?? null,
      exchangeMic,
      symbol: instrumentId.slice(separator + 1),
    };
  }

  throw new MarketDataError("UnsupportedInstrument", "The instrument identifier cannot be resolved by Financial Modeling Prep.", {
    instrumentId,
    provider: FMP_PROVIDER_ID,
  });
}

function fmpInstrumentId(exchangeCode: string, symbol: string) {
  return `${FMP_INSTRUMENT_PREFIX}${encodeURIComponent(exchangeCode)}:${encodeURIComponent(symbol)}`;
}

function normalizedExchangeCode(value: string, endpoint: string) {
  const normalized = value.trim().toLocaleUpperCase("en-US");
  if (!normalized || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw invalidProviderResponse(endpoint, "invalid-exchange");
  }
  return normalized;
}

function supportedCurrency(value: string): Currency | undefined {
  const normalized = value.toLocaleUpperCase("en-US");
  return currencies.includes(normalized as Currency) ? normalized as Currency : undefined;
}

function compareSearchResults(query: string, a: z.infer<typeof searchResultSchema>, b: z.infer<typeof searchResultSchema>) {
  const rank = (result: z.infer<typeof searchResultSchema>) => {
    const symbol = result.symbol.toLocaleLowerCase("en-US");
    const name = result.name.toLocaleLowerCase("en-US");
    return symbol === query ? 0 : symbol.startsWith(query) ? 1 : name.startsWith(query) ? 2 : 3;
  };
  return rank(a) - rank(b)
    || a.symbol.localeCompare(b.symbol, "en-US")
    || a.name.localeCompare(b.name, "en-US")
    || a.exchange.localeCompare(b.exchange, "en-US")
    || a.currency.localeCompare(b.currency, "en-US");
}

function validateCurrency(value: string, instrumentId: InstrumentId): Currency {
  const normalized = supportedCurrency(value);
  if (!normalized) {
    throw new MarketDataError("UnsupportedInstrument", "The instrument's quote currency is not supported by Investi.", {
      instrumentId,
      currency: value.toLocaleUpperCase("en-US"),
      provider: FMP_PROVIDER_ID,
    });
  }
  return normalized;
}

function validCurrency(value: unknown): value is Currency {
  return typeof value === "string" && currencies.includes(value as Currency);
}

function validateFxRequest(baseCurrency: Currency, quoteCurrency: Currency) {
  if (!validCurrency(baseCurrency) || !validCurrency(quoteCurrency)) {
    throw new MarketDataError("FxUnavailable", "The requested FX currency is not supported by Investi.", {
      baseCurrency,
      quoteCurrency,
      provider: FMP_PROVIDER_ID,
    });
  }
  if (quoteCurrency !== "CZK") {
    throw new MarketDataError("FxUnavailable", "This FMP adapter currently supports conversions into CZK only.", {
      baseCurrency,
      quoteCurrency,
      provider: FMP_PROVIDER_ID,
    });
  }
}

function searchResultIdentity(result: z.infer<typeof searchResultSchema>, endpoint: string) {
  const exchangeCode = normalizedExchangeCode(result.exchange, endpoint);
  return {
    exchangeCode,
    instrumentId: fmpInstrumentId(exchangeCode, result.symbol),
  };
}

function assertMatchingSymbol(endpoint: string, expected: string, actual: string) {
  if (actual.toLocaleUpperCase("en-US") !== expected.toLocaleUpperCase("en-US")) {
    throw invalidProviderResponse(endpoint, "symbol-mismatch");
  }
}

function calendarDate(value: string, endpoint: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalidProviderResponse(endpoint, "invalid-date");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw invalidProviderResponse(endpoint, "invalid-date");
  }
  return value;
}

function timestampFromUnixSeconds(value: number, endpoint: string): UtcTimestamp {
  const date = new Date(value * 1_000);
  if (Number.isNaN(date.getTime())) throw invalidProviderResponse(endpoint, "invalid-timestamp");
  return date.toISOString();
}

function retrievedAt(clock: FmpClock): UtcTimestamp {
  const value = clock();
  if (Number.isNaN(value.getTime())) throw invalidProviderResponse("clock", "invalid-retrieval-time");
  return value.toISOString();
}

function provenance(input: {
  dataset: string;
  dataKind: MarketDataProvenance["dataKind"];
  observedAt: UtcTimestamp;
  retrievedAt: UtcTimestamp;
  adjustmentMode: MarketDataProvenance["adjustmentMode"];
  completeness?: MarketDataProvenance["completeness"];
}): MarketDataProvenance {
  return {
    provider: FMP_PROVIDER_ID,
    dataset: input.dataset,
    dataKind: input.dataKind,
    isDeterministic: false,
    isDemo: false,
    observedAt: input.observedAt,
    retrievedAt: input.retrievedAt,
    adjustmentMode: input.adjustmentMode,
    completeness: input.completeness ?? "complete",
  };
}

function fxProvenance(input: {
  dataset: string;
  referenceDate: string;
  retrievedAt: UtcTimestamp;
}): FxRateProvenance {
  return {
    provider: FMP_PROVIDER_ID,
    dataset: input.dataset,
    dataKind: "reference",
    isDeterministic: false,
    isDemo: false,
    referenceDate: input.referenceDate,
    retrievedAt: input.retrievedAt,
    adjustmentMode: null,
    completeness: "complete",
  };
}

function normalizePoint(
  endpoint: string,
  reference: InstrumentReference,
  point: z.infer<typeof historicalPointSchema>,
): HistoricalPricePoint {
  assertMatchingSymbol(endpoint, reference.symbol, point.symbol);
  const date = calendarDate(point.date, endpoint);
  if (point.high < point.low || point.high < point.open || point.high < point.close || point.low > point.open || point.low > point.close) {
    throw invalidProviderResponse(endpoint, "invalid-ohlc-range");
  }
  return {
    date,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    volume: point.volume,
  };
}

/** FMP Stable adapter. Corporate actions and total-return history are deferred. */
export class FmpMarketDataProvider implements MarketDataProvider {
  readonly providerId = FMP_PROVIDER_ID;

  constructor(
    private readonly client: FmpClient,
    private readonly clock: FmpClock = () => new Date(),
  ) {}

  async searchInstruments(query: string) {
    const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
    if (!normalizedQuery || normalizedQuery.length > 80 || /[\u0000-\u001f\u007f]/.test(normalizedQuery)) {
      throw new MarketDataError("InvalidSearchQuery", "Enter a valid company name or ticker symbol.", {
        provider: FMP_PROVIDER_ID,
      });
    }
    const endpoint = "search-symbol";
    const upstream = parseArray(endpoint, searchResultSchema, await this.client.get(endpoint, { query: normalizedQuery }));
    const supported = upstream
      .filter((result) => supportedCurrency(result.currency) !== undefined)
      .sort((a, b) => compareSearchResults(normalizedQuery, a, b));
    const normalized = new Map<InstrumentId, InstrumentSearchResult>();
    for (const result of supported) {
      const candidate = this.normalizeSearchResult(result, endpoint);
      if (!normalized.has(candidate.instrumentId)) normalized.set(candidate.instrumentId, candidate);
      if (normalized.size === SEARCH_RESULT_LIMIT) break;
    }
    return [...normalized.values()];
  }

  async getInstrumentMetadata(instrumentId: InstrumentId): Promise<Instrument> {
    const reference = referenceFromInstrumentId(instrumentId);
    const endpoint = "profile";
    const profiles = parseArray(endpoint, profileSchema, await this.client.get(endpoint, { symbol: reference.symbol }));
    if (profiles.length === 0) throw instrumentNotFound(instrumentId);
    if (profiles.length !== 1) throw invalidProviderResponse(endpoint, "ambiguous-response");
    const profile = profiles[0];
    assertMatchingSymbol(endpoint, reference.symbol, profile.symbol);
    const profileExchangeCode = normalizedExchangeCode(profile.exchange, endpoint);
    if (reference.exchangeCode && profileExchangeCode !== reference.exchangeCode) throw invalidProviderResponse(endpoint, "exchange-mismatch");
    const fmpMic = exchangeMics[profileExchangeCode] ?? null;
    if (reference.exchangeMic && fmpMic && fmpMic !== reference.exchangeMic) throw invalidProviderResponse(endpoint, "exchange-mismatch");
    if (profile.isFund && !profile.isEtf) {
      throw new MarketDataError("UnsupportedInstrument", "Mutual funds are not supported by the Investi market-data contract.", {
        instrumentId,
        provider: FMP_PROVIDER_ID,
      });
    }
    return {
      instrumentId,
      symbol: profile.symbol,
      name: profile.companyName,
      assetType: profile.isEtf ? "etf" : "equity",
      exchangeMic: reference.exchangeMic ?? fmpMic,
      quoteCurrency: validateCurrency(profile.currency, instrumentId),
      ...(profile.isEtf ? {} : { equityProfile: {
        sector: optionalText(profile.sector),
        industry: optionalText(profile.industry),
        country: optionalText(profile.country),
        marketCap: optionalPositiveNumber(profile.marketCap),
      } }),
    };
  }

  async getQuote(instrumentId: InstrumentId) {
    const reference = referenceFromInstrumentId(instrumentId);
    const endpoint = "quote";
    const quotes = parseArray(endpoint, quoteSchema, await this.client.get(endpoint, { symbol: reference.symbol }));
    if (quotes.length === 0) {
      throw new MarketDataError("QuoteUnavailable", "Financial Modeling Prep returned no quote for the instrument.", {
        instrumentId,
        provider: FMP_PROVIDER_ID,
      });
    }
    if (quotes.length !== 1) throw invalidProviderResponse(endpoint, "ambiguous-response");
    const quote = quotes[0];
    assertMatchingSymbol(endpoint, reference.symbol, quote.symbol);
    const instrument = await this.getInstrumentMetadata(instrumentId);
    const observedAt = timestampFromUnixSeconds(quote.timestamp, endpoint);
    const retrieved = retrievedAt(this.clock);
    return {
      instrumentId,
      price: quote.price,
      currency: instrument.quoteCurrency,
      observedAt,
      retrievedAt: retrieved,
      provenance: provenance({
        dataset: "stable/quote",
        dataKind: "live",
        observedAt,
        retrievedAt: retrieved,
        adjustmentMode: null,
      }),
    };
  }

  async getHistoricalPrices(request: HistoricalPriceRequest) {
    const reference = referenceFromInstrumentId(request.instrumentId);
    if (request.adjustment.mode === "total-return") {
      throw new MarketDataError("UnsupportedAdjustment", "FMP dividend-adjusted closes are not equivalent to Investi's reinvested total-return policy.", {
        instrumentId: request.instrumentId,
        mode: request.adjustment.mode,
        provider: FMP_PROVIDER_ID,
      });
    }
    const splitAdjusted = request.adjustment.mode === "split-adjusted";
    // FMP exposes a separate Stable non-split-adjusted route for raw OHLC. The
    // regular full route is therefore normalized as split-adjusted OHLC; no
    // separate adjustedClose is invented because that route does not return one.
    const endpoint = splitAdjusted ? "historical-price-eod/full" : "historical-price-eod/non-split-adjusted";
    // A capped response keeps the newest rows, so long ranges (Max) page backwards
    // until a response is shorter than the cap or reaches the requested start.
    const upstreamPoints: HistoricalPricePoint[] = [];
    let to = request.endDate;
    let truncated = false;
    for (let page = 0; ; page++) {
      if (page === FMP_HISTORY_MAX_PAGES) { truncated = true; break; }
      const payload = await this.client.get(endpoint, { symbol: reference.symbol, from: request.startDate, to });
      const rows = parseArray(endpoint, historicalPointSchema, payload).map((point) => normalizePoint(endpoint, reference, point));
      upstreamPoints.push(...rows);
      if (rows.length < FMP_HISTORY_ROW_LIMIT) break;
      const oldest = rows.reduce((min, { date }) => date < min ? date : min, rows[0].date);
      if (oldest <= request.startDate) break;
      to = new Date(Date.parse(`${oldest}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
    }
    const points = upstreamPoints
      .filter(({ date }) => date >= request.startDate && date <= request.endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (points.length === 0) {
      throw new MarketDataError("HistoricalDataUnavailable", "Financial Modeling Prep returned no prices in the requested date range.", {
        instrumentId: request.instrumentId,
        startDate: request.startDate,
        endDate: request.endDate,
        provider: FMP_PROVIDER_ID,
      });
    }
    if (new Set(points.map(({ date }) => date)).size !== points.length) {
      throw invalidProviderResponse(endpoint, "duplicate-date");
    }
    const instrument = await this.getInstrumentMetadata(request.instrumentId);
    const retrieved = retrievedAt(this.clock);
    const observedAt = `${points.at(-1)!.date}T00:00:00.000Z`;
    return {
      instrumentId: request.instrumentId,
      currency: instrument.quoteCurrency,
      interval: "daily" as const,
      timeZone: "UTC" as const,
      adjustment: adjustmentPolicies[request.adjustment.mode],
      points,
      provenance: provenance({
        dataset: `stable/${endpoint}`,
        dataKind: "historical",
        observedAt,
        retrievedAt: retrieved,
        adjustmentMode: request.adjustment.mode,
        completeness: truncated ? "partial" : "complete",
      }),
    };
  }

  async getFxRate(baseCurrency: Currency, quoteCurrency: Currency, asOf: UtcTimestamp) {
    validateFxRequest(baseCurrency, quoteCurrency);
    const retrieved = retrievedAt(this.clock);
    if (baseCurrency === quoteCurrency) {
      const referenceDate = asOf.slice(0, 10);
      return {
        baseCurrency,
        quoteCurrency,
        rate: 1,
        referenceDate,
        retrievedAt: retrieved,
        provenance: fxProvenance({
          dataset: "identity",
          referenceDate,
          retrievedAt: retrieved,
        }),
      };
    }

    const endpoint = "quote";
    // FMP symbols are BASE+QUOTE: USDCZK is the number of CZK for one USD.
    const pair = `${baseCurrency}${quoteCurrency}`;
    const quotes = parseArray(endpoint, quoteSchema, await this.client.get(endpoint, { symbol: pair }));
    if (quotes.length === 0) {
      throw new MarketDataError("FxUnavailable", "Financial Modeling Prep returned no quote for the requested FX pair.", {
        baseCurrency,
        quoteCurrency,
        provider: FMP_PROVIDER_ID,
      });
    }
    if (quotes.length !== 1) throw invalidProviderResponse(endpoint, "ambiguous-fx-response");
    const quote = quotes[0];
    assertMatchingSymbol(endpoint, pair, quote.symbol);
    if (quote.price <= 0) throw invalidProviderResponse(endpoint, "invalid-fx-rate");
    const observedAt = timestampFromUnixSeconds(quote.timestamp, endpoint);
    const referenceDate = observedAt.slice(0, 10);
    return {
      baseCurrency,
      quoteCurrency,
      rate: quote.price,
      referenceDate,
      retrievedAt: retrieved,
      provenance: fxProvenance({
        dataset: "stable/quote:forex",
        referenceDate,
        retrievedAt: retrieved,
      }),
    };
  }

  async getCorporateActions(request: CorporateActionsRequest): Promise<never> {
    throw new MarketDataError("ProviderUnavailable", "Financial Modeling Prep corporate actions are not enabled in this phase.", {
      instrumentId: request.instrumentId,
      provider: FMP_PROVIDER_ID,
      operation: "corporate-actions",
      reason: "unsupported-capability",
    });
  }

  private normalizeSearchResult(result: z.infer<typeof searchResultSchema>, endpoint: string): InstrumentSearchResult {
    const { exchangeCode, instrumentId } = searchResultIdentity(result, endpoint);
    return {
      instrumentId,
      symbol: result.symbol,
      name: result.name,
      assetType: null,
      exchangeMic: exchangeMics[exchangeCode] ?? null,
      exchangeCode,
      quoteCurrency: validateCurrency(result.currency, instrumentId),
      provider: FMP_PROVIDER_ID,
      providerSymbol: result.symbol,
    };
  }
}
