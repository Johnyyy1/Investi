import "server-only";

import { perfCount, perfMeasure } from "@/lib/perf";
import { NoopMarketDataCache, type CachedEtfDataset, type MarketDataCache } from "./cache";
import {
  adjustmentPolicies,
  currencies,
  type CorporateActionsRequest,
  type Currency,
  type HistoricalPriceRequest,
  type Instrument,
  type InstrumentId,
  type PriceAdjustmentPolicy,
  type Quote,
  type UtcTimestamp,
} from "./contracts";
import { isMarketDataError, MarketDataError } from "./errors";
import { evaluateQuoteUsability, nextUsEquitiesSessionOpen } from "./market-session";
import type { FxRateProvider, ProviderQuote, SecurityMarketDataProvider } from "./provider";
import type { EquityFundamentalsProvider, EquityFundamentalsSnapshot } from "./equity-fundamentals";
import type { EtfAnalyticsProvider, EtfAnalyticsSnapshot, EtfDataset, EtfDatasetName } from "./etf-analytics";

const DAY = 24 * 60 * 60 * 1_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SEARCH_CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const MAX_SEARCH_LENGTH = 80;

export interface MarketDataServiceOptions {
  cache?: MarketDataCache;
  clock?: () => Date;
  fxProvider?: FxRateProvider;
  equityFundamentalsProvider?: EquityFundamentalsProvider;
  etfAnalyticsProvider?: EtfAnalyticsProvider;
  fxReferenceUnavailableAfterMilliseconds?: number;
  quoteFreshForMilliseconds?: number;
  quoteUnavailableAfterMilliseconds?: number;
}

function supportsFxRates(provider: SecurityMarketDataProvider): provider is SecurityMarketDataProvider & FxRateProvider {
  return "getFxRate" in provider && typeof provider.getFxRate === "function";
}

function isValidCalendarDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidUtcTimestamp(value: string) {
  return UTC_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}

function validateDateRange(startDate: string, endDate: string) {
  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate) || startDate > endDate) {
    throw new MarketDataError("InvalidDateRange", "Use a valid start date on or before the end date.", { startDate, endDate });
  }
}

function validateAdjustment(adjustment: PriceAdjustmentPolicy) {
  const expected = adjustmentPolicies[adjustment?.mode];
  if (!expected || expected.splitTreatment !== adjustment.splitTreatment || expected.dividendTreatment !== adjustment.dividendTreatment) {
    throw new MarketDataError("UnsupportedAdjustment", "The requested price-adjustment policy is not supported.", { mode: adjustment?.mode });
  }
}

/** Application boundary for validation, freshness, caching and normalized failures. */
export class MarketDataService {
  private readonly cache: MarketDataCache;
  private readonly clock: () => Date;
  private readonly freshFor: number;
  private readonly unavailableAfter: number;
  private readonly fxReferenceUnavailableAfter: number;
  private readonly fxProvider: FxRateProvider;
  private readonly equityFundamentalsProvider?: EquityFundamentalsProvider;
  private readonly etfAnalyticsProvider?: EtfAnalyticsProvider;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly provider: SecurityMarketDataProvider, options: MarketDataServiceOptions = {}) {
    this.cache = options.cache ?? new NoopMarketDataCache();
    this.clock = options.clock ?? (() => new Date());
    this.freshFor = options.quoteFreshForMilliseconds ?? 15 * 60 * 1_000;
    this.unavailableAfter = options.quoteUnavailableAfterMilliseconds ?? DAY;
    this.fxReferenceUnavailableAfter = options.fxReferenceUnavailableAfterMilliseconds ?? 7 * DAY;
    const fxProvider = options.fxProvider ?? (supportsFxRates(provider) ? provider : undefined);
    if (!fxProvider) {
      throw new MarketDataError("ProviderConfiguration", "An FX data provider must be configured separately.", {
        provider: provider.providerId,
        operation: "configuration",
        reason: "missing-fx-provider",
      });
    }
    this.fxProvider = fxProvider;
    this.equityFundamentalsProvider = options.equityFundamentalsProvider;
    this.etfAnalyticsProvider = options.etfAnalyticsProvider;
    if (this.freshFor < 0 || this.unavailableAfter < this.freshFor) {
      throw new RangeError("Quote freshness thresholds must be ordered, nonnegative durations.");
    }
    if (!Number.isFinite(this.fxReferenceUnavailableAfter) || this.fxReferenceUnavailableAfter < 0) {
      throw new RangeError("FX reference availability must be a nonnegative finite duration.");
    }
  }

  /** The service clock, so callers can request same-day reference data beside a quote. */
  now() {
    return this.clock();
  }

  async searchInstruments(query: string) {
    const normalized = query.trim().toLocaleLowerCase("en-US");
    if (!normalized || normalized.length > MAX_SEARCH_LENGTH || SEARCH_CONTROL_CHARACTER.test(normalized)) {
      throw new MarketDataError("InvalidSearchQuery", "Enter a valid company name or ticker symbol.", {
        queryLength: normalized.length,
      });
    }
    const key = JSON.stringify([this.provider.providerId, normalized]);
    return this.loadCached(
      `search:${key}`,
      () => this.cache.getSearch(key),
      (value) => this.cache.setSearch(key, value),
      () => this.call("search", this.provider, () => this.provider.searchInstruments(normalized)),
    );
  }

  async getInstrumentMetadata(instrumentId: InstrumentId) {
    const key = JSON.stringify([this.provider.providerId, instrumentId]);
    return this.loadCached(
      `instrument:${key}`,
      () => this.cache.getInstrument(key),
      (value) => this.cache.setInstrument(key, value),
      () => this.call("metadata", this.provider, () => this.provider.getInstrumentMetadata(instrumentId)),
    );
  }

  async getQuote(instrumentId: InstrumentId): Promise<Quote> {
    const instrument = await this.getInstrumentMetadata(instrumentId);
    const key = JSON.stringify([this.provider.providerId, instrumentId]);
    const observation = await this.loadCached(
      `quote:${key}`,
      () => this.cache.getQuote(key),
      (value) => this.cache.setQuote(key, value, this.closedMarketQuoteExpiry(instrument, value.observedAt)),
      async () => {
        const value = await this.call("quote", this.provider, () => this.provider.getQuote(instrumentId));
        this.validateQuote(value);
        return value;
      },
    );
    this.validateQuote(observation);
    if (observation.instrumentId !== instrument.instrumentId || observation.currency !== instrument.quoteCurrency) {
      throw new MarketDataError("MalformedProviderResponse", "The quote does not match the normalized instrument.", { operation: "quote", instrumentId });
    }
    try {
      return {
        ...observation,
        usability: evaluateQuoteUsability(instrument, observation.observedAt, this.clock(), {
          freshForMilliseconds: this.freshFor,
          unavailableAfterMilliseconds: this.unavailableAfter,
        }),
      };
    } catch (error) {
      throw new MarketDataError("ProviderUnavailable", "The quote observation time is invalid.", { operation: "quote-usability" }, { cause: error });
    }
  }

  /** A completed-session reference cannot change while the market is closed, so it is kept until the
   * next open instead of being refetched every few seconds. Any other quote keeps the default TTL, and
   * usability is still evaluated on every read, so execution always needs a fresh open-market quote. */
  private closedMarketQuoteExpiry(instrument: Instrument, observedAt: UtcTimestamp): number | undefined {
    const now = this.clock();
    try {
      const usability = evaluateQuoteUsability(instrument, observedAt, now, { freshForMilliseconds: this.freshFor, unavailableAfterMilliseconds: this.unavailableAfter });
      return usability.status === "closed-market-reference" ? nextUsEquitiesSessionOpen(now).getTime() : undefined;
    } catch {
      return undefined;
    }
  }

  async getHistoricalPrices(request: HistoricalPriceRequest) {
    this.validateHistoricalRequest(request);
    const key = JSON.stringify([
      this.provider.providerId,
      request.instrumentId,
      request.startDate,
      request.endDate,
      request.interval,
      request.timeZone,
      request.adjustment.mode,
    ]);
    return this.loadCached(
      `history:${key}`,
      () => this.cache.getHistory(key),
      (value) => this.cache.setHistory(key, value),
      () => this.call("history", this.provider, () => this.provider.getHistoricalPrices(request)),
    );
  }

  async getFxRate(baseCurrency: Currency, quoteCurrency: Currency, asOf: UtcTimestamp) {
    if (!currencies.includes(baseCurrency) || !currencies.includes(quoteCurrency) || !isValidUtcTimestamp(asOf)) {
      throw new MarketDataError("FxUnavailable", "Use a valid UTC timestamp for the FX request.", { baseCurrency, quoteCurrency, asOf });
    }
    if (baseCurrency === quoteCurrency) return this.identityFxRate(baseCurrency, asOf);
    const key = JSON.stringify([this.fxProvider.providerId, baseCurrency, quoteCurrency, asOf.slice(0, 10)]);
    const rate = await this.loadCached(
      `fx:${key}`,
      () => this.cache.getFx(key),
      (value) => this.cache.setFx(key, value),
      async () => {
        const value = await this.call("fx", this.fxProvider, () => this.fxProvider.getFxRate(baseCurrency, quoteCurrency, asOf));
        this.validateFxRate(value, baseCurrency, quoteCurrency, asOf);
        return value;
      },
    );
    this.validateFxRate(rate, baseCurrency, quoteCurrency, asOf);
    return rate;
  }

  async getCorporateActions(request: CorporateActionsRequest) {
    validateDateRange(request.startDate, request.endDate);
    const key = JSON.stringify([this.provider.providerId, request.instrumentId, request.startDate, request.endDate]);
    return this.loadCached(
      `corporate-actions:${key}`,
      () => this.cache.getCorporateActions(key),
      (value) => this.cache.setCorporateActions(key, value),
      () => this.call("corporate-actions", this.provider, () => this.provider.getCorporateActions(request)),
    );
  }

  async getEquityFundamentals(instrumentId: InstrumentId): Promise<EquityFundamentalsSnapshot> {
    const instrument = await this.getInstrumentMetadata(instrumentId);
    if (instrument.assetType !== "equity") throw new MarketDataError("UnsupportedInstrument", "Company fundamentals are available for equities only.", { instrumentId });
    const provider = this.equityFundamentalsProvider;
    if (!provider) throw new MarketDataError("ProviderConfiguration", "Equity fundamentals are not configured.", { instrumentId });
    const key = JSON.stringify([provider.providerId, instrumentId]);
    const result = await this.loadCached(
      `equity-fundamentals:${key}`,
      () => this.cache.getEquityFundamentals(key),
      (value) => this.cache.setEquityFundamentals(key, value),
      async () => {
        const value = await this.call("equity-fundamentals", provider, () => provider.getEquityFundamentals(instrument));
        if (value.instrumentId !== instrumentId || value.provenance.provider !== provider.providerId) {
          throw new MarketDataError("MalformedProviderResponse", "Equity fundamentals do not match the instrument.", { instrumentId });
        }
        return value;
      },
      (value) => value.provenance.unavailableDatasets.length === 0,
    );
    if (result.instrumentId !== instrumentId || result.provenance.provider !== provider.providerId) {
      throw new MarketDataError("MalformedProviderResponse", "Equity fundamentals do not match the instrument.", { instrumentId });
    }
    return result;
  }

  async getEtfAnalytics(instrumentId: InstrumentId): Promise<EtfAnalyticsSnapshot> {
    const instrument = await this.getInstrumentMetadata(instrumentId);
    if (instrument.assetType !== "etf") throw new MarketDataError("UnsupportedInstrument", "ETF analytics are available for ETFs only.", { instrumentId });
    const provider = this.etfAnalyticsProvider;
    if (!provider) throw new MarketDataError("ProviderConfiguration", "ETF analytics are not configured.", { instrumentId });
    const load = async <T>(name: EtfDatasetName, execute: () => Promise<EtfDataset<T>>): Promise<EtfDataset<T>> => {
      const key = `${name}:${JSON.stringify([provider.providerId, instrumentId])}`;
      return this.loadCached(
        `etf:${key}`,
        async () => this.cache.getEtfDataset(key, name) as Promise<EtfDataset<T> | undefined>,
        (value) => this.cache.setEtfDataset(key, value as CachedEtfDataset, name),
        async () => {
          const value = await this.call(`etf-${name}`, provider, execute);
          if (value.instrumentId !== instrumentId || value.provider !== provider.providerId || !isValidUtcTimestamp(value.retrievedAt)) {
            throw new MarketDataError("MalformedProviderResponse", "ETF analytics do not match the instrument.", { instrumentId, dataset: name });
          }
          if (name !== "info") {
            const rows = name === "holdings"
              ? (value as EtfDataset<{ rows: readonly { weight: number }[] }>).value?.rows
              : (value as EtfDataset<readonly { weight: number }[]>).value;
            if (!Array.isArray(rows) || rows.length === 0 || rows.some((row) => !row || !Number.isFinite(row.weight) || row.weight < 0 || row.weight > 1)) {
              throw new MarketDataError("MalformedProviderResponse", "ETF weights must be normalized decimal fractions.", { instrumentId, dataset: name });
            }
          }
          return value;
        },
      );
    };
    const [info, holdings, sectors, countries] = await Promise.allSettled([
      load("info", () => provider.getEtfInfo(instrument)),
      load("holdings", () => provider.getEtfHoldings(instrument)),
      load("sectors", () => provider.getEtfSectors(instrument)),
      load("countries", () => provider.getEtfCountries(instrument)),
    ]);
    const results = [info, holdings, sectors, countries];
    if (results.every((result) => result.status === "rejected")) {
      const first = results[0] as PromiseRejectedResult;
      if (isMarketDataError(first.reason)) throw first.reason;
      throw new MarketDataError("ProviderUnavailable", "ETF analytics are unavailable.", { instrumentId });
    }
    const names: EtfDatasetName[] = ["info", "holdings", "sectors", "countries"];
    return {
      instrumentId,
      info: info.status === "fulfilled" ? info.value : null,
      holdings: holdings.status === "fulfilled" ? holdings.value : null,
      sectors: sectors.status === "fulfilled" ? sectors.value : null,
      countries: countries.status === "fulfilled" ? countries.value : null,
      unavailableDatasets: names.filter((_, index) => results[index].status === "rejected"),
    };
  }

  private validateHistoricalRequest(request: HistoricalPriceRequest) {
    validateDateRange(request.startDate, request.endDate);
    if (request.interval !== "daily") {
      throw new MarketDataError("UnsupportedInterval", "Only daily historical prices are supported.", { interval: request.interval });
    }
    if (request.timeZone !== "UTC") {
      throw new MarketDataError("UnsupportedTimeZone", "Only the explicit UTC convention is supported.", { timeZone: request.timeZone });
    }
    validateAdjustment(request.adjustment);
  }

  private validateQuote(quote: ProviderQuote) {
    if (!Number.isFinite(quote.price) || quote.price <= 0 || !isValidUtcTimestamp(quote.observedAt) || !isValidUtcTimestamp(quote.retrievedAt)) {
      throw new MarketDataError("MalformedProviderResponse", "The provider returned an invalid normalized quote.", { operation: "quote" });
    }
  }

  private validateFxRate(rate: Awaited<ReturnType<FxRateProvider["getFxRate"]>>, baseCurrency: Currency, quoteCurrency: Currency, asOf: UtcTimestamp) {
    const reference = Date.parse(`${rate.referenceDate}T00:00:00.000Z`);
    const retrieved = Date.parse(rate.retrievedAt);
    const requested = Date.parse(`${asOf.slice(0, 10)}T00:00:00.000Z`);
    const now = this.clock().getTime();
    const mismatchedPair = rate.baseCurrency !== baseCurrency || rate.quoteCurrency !== quoteCurrency;
    const malformedProvenance = rate.provenance.provider !== this.fxProvider.providerId
      || rate.provenance.referenceDate !== rate.referenceDate
      || rate.provenance.retrievedAt !== rate.retrievedAt;
    if (mismatchedPair || malformedProvenance || !Number.isFinite(rate.rate) || rate.rate <= 0 || !isValidCalendarDate(rate.referenceDate) || !isValidUtcTimestamp(rate.retrievedAt)) {
      throw new MarketDataError("MalformedProviderResponse", "The provider returned an invalid normalized FX rate.", {
        operation: "fx",
        baseCurrency,
        quoteCurrency,
      });
    }
    if (reference > requested || retrieved > now || requested - reference > this.fxReferenceUnavailableAfter) {
      throw new MarketDataError("FxUnavailable", "No sufficiently current FX rate is available for the requested observation.", {
        baseCurrency,
        quoteCurrency,
        asOf,
      });
    }
  }

  private identityFxRate(currency: Currency, asOf: UtcTimestamp) {
    const retrieved = this.clock();
    if (Number.isNaN(retrieved.getTime())) {
      throw new MarketDataError("ProviderUnavailable", "The identity FX observation time is invalid.", { operation: "fx-identity" });
    }
    const retrievedAt = retrieved.toISOString();
    const referenceDate = asOf.slice(0, 10);
    if (!isValidUtcTimestamp(retrievedAt) || !isValidCalendarDate(referenceDate)) {
      throw new MarketDataError("ProviderUnavailable", "The identity FX observation time is invalid.", { operation: "fx-identity" });
    }
    return {
      baseCurrency: currency,
      quoteCurrency: currency,
      rate: 1,
      referenceDate,
      retrievedAt,
      provenance: {
        provider: "investi-identity",
        dataset: "identity",
        dataKind: "reference" as const,
        isDeterministic: false,
        isDemo: false,
        referenceDate,
        retrievedAt,
        adjustmentMode: null,
        completeness: "complete" as const,
      },
    };
  }

  private async call<T>(operation: string, provider: { providerId: string }, execute: () => Promise<T>): Promise<T> {
    try {
      return await perfMeasure(`market.provider.${operation}`, "external", execute);
    } catch (error) {
      if (isMarketDataError(error)) throw error;
      throw new MarketDataError(
        "ProviderUnavailable",
        "Market data is temporarily unavailable.",
        { operation, provider: provider.providerId },
        { cause: error },
      );
    }
  }

  private async loadCached<T>(
    flightKey: string,
    get: () => Promise<T | undefined>,
    set: (value: T) => Promise<void>,
    load: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true,
  ): Promise<T> {
    const family = flightKey.slice(0, flightKey.indexOf(":"));
    const existing = this.inFlight.get(flightKey) as Promise<T> | undefined;
    if (existing) { perfCount(`market.cache.coalesced.${family}`); return existing; }
    // Concurrent callers share one cache read as well as one provider call.
    const pending = (async () => {
      const cached = await get();
      if (cached !== undefined) { perfCount(`market.cache.hit.${family}`); return cached; }
      perfCount(`market.cache.miss.${family}`);
      const value = await load();
      if (shouldCache(value)) await set(value);
      return value;
    })();
    this.inFlight.set(flightKey, pending);
    try {
      return await pending;
    } finally {
      if (this.inFlight.get(flightKey) === pending) this.inFlight.delete(flightKey);
    }
  }
}
