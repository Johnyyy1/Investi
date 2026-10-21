import "server-only";

import type {
  CorporateActionSeries,
  CorporateActionsRequest,
  Currency,
  FxRate,
  HistoricalPriceRequest,
  HistoricalSeries,
  Instrument,
  InstrumentId,
  InstrumentSearchResult,
  MarketDataProvenance,
  UtcTimestamp,
} from "./contracts";

/** A normalized observation; MarketDataService adds policy-based freshness. */
export interface ProviderQuote {
  instrumentId: InstrumentId;
  /** Provider's current/last price field; never a bid, ask, or Investník execution price. */
  price: number;
  currency: Currency;
  observedAt: UtcTimestamp;
  retrievedAt: UtcTimestamp;
  provenance: MarketDataProvenance;
}

/** Security-data capabilities. FX may be composed from a different provider. */
export interface SecurityMarketDataProvider {
  readonly providerId: string;
  searchInstruments(query: string): Promise<readonly InstrumentSearchResult[]>;
  getInstrumentMetadata(instrumentId: InstrumentId): Promise<Instrument>;
  getQuote(instrumentId: InstrumentId): Promise<ProviderQuote>;
  getHistoricalPrices(request: HistoricalPriceRequest): Promise<HistoricalSeries>;
  getCorporateActions(request: CorporateActionsRequest): Promise<CorporateActionSeries>;
}

/** FX capability kept separate so reference rates need not come from the security provider. */
export interface FxRateProvider {
  readonly providerId: string;
  getFxRate(baseCurrency: Currency, quoteCurrency: Currency, asOf: UtcTimestamp): Promise<FxRate>;
}

/** Backward-compatible combined port implemented by the deterministic and FMP adapters. */
export interface MarketDataProvider extends SecurityMarketDataProvider, FxRateProvider {}
