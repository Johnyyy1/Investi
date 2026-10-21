/** Stable Investník identity. Symbols are display/search attributes, never identifiers. */
export type InstrumentId = string;

/** ISO 4217 currencies supported by the initial Investník market-data boundary. */
export const currencies = ["CZK", "USD", "EUR"] as const;
export type Currency = (typeof currencies)[number];

export const assetTypes = ["equity", "etf", "bond", "cash", "index"] as const;
export type AssetType = (typeof assetTypes)[number];

/** YYYY-MM-DD in the request's explicit time-zone convention. */
export type CalendarDate = string;
/** ISO-8601 UTC timestamp. */
export type UtcTimestamp = string;

export interface Instrument {
  instrumentId: InstrumentId;
  symbol: string;
  name: string;
  assetType: AssetType;
  exchangeMic: string | null;
  quoteCurrency: Currency;
  /** Normalized company context from profile data; present only for equities. */
  equityProfile?: {
    sector: string | null;
    industry: string | null;
    country: string | null;
    /** Profile market capitalization in the instrument's quote currency. */
    marketCap: number | null;
  };
}

export interface InstrumentSearchResult {
  instrumentId: InstrumentId;
  symbol: string;
  name: string;
  /** Search endpoints may not distinguish an equity from an ETF until profile lookup. */
  assetType: AssetType | null;
  exchangeMic: string | null;
  /** Provider-reported exchange code, retained when no reliable MIC mapping exists. */
  exchangeCode: string | null;
  quoteCurrency: Currency;
  provider: string;
  /** Exact provider symbol required for later quote/profile requests. */
  providerSymbol: string;
}

export type DataKind = "synthetic" | "historical" | "live" | "reference";
export type DataCompleteness = "complete" | "partial";
export type AdjustmentMode = "raw" | "split-adjusted" | "total-return";

export interface MarketDataProvenance {
  provider: string;
  dataset: string;
  dataKind: DataKind;
  isDeterministic: boolean;
  isDemo: boolean;
  observedAt: UtcTimestamp;
  retrievedAt: UtcTimestamp;
  adjustmentMode: AdjustmentMode | null;
  completeness: DataCompleteness;
}

/** Provenance for an FX fixing/reference rate whose source supplies a calendar date, not an intraday observation. */
export interface FxRateProvenance {
  provider: string;
  dataset: string;
  dataKind: Extract<DataKind, "synthetic" | "reference">;
  isDeterministic: boolean;
  isDemo: boolean;
  referenceDate: CalendarDate;
  retrievedAt: UtcTimestamp;
  adjustmentMode: null;
  completeness: DataCompleteness;
}

export type MarketCalendarId = "us-equities";
export type MarketSessionState = "open" | "closed" | "unknown";
export type QuoteUsabilityStatus = "fresh" | "closed-market-reference" | "stale" | "unavailable";

export interface QuoteUsability {
  status: QuoteUsabilityStatus;
  ageMilliseconds: number;
  marketState: MarketSessionState;
  marketCalendar: MarketCalendarId | null;
  usableForValuation: boolean;
  usableForExecution: boolean;
}

export interface Quote {
  instrumentId: InstrumentId;
  /** Provider's current/last price field; never a bid, ask, or Investník execution price. */
  price: number;
  currency: Currency;
  observedAt: UtcTimestamp;
  retrievedAt: UtcTimestamp;
  provenance: MarketDataProvenance;
  usability: QuoteUsability;
}

export const adjustmentPolicies = {
  raw: {
    mode: "raw",
    splitTreatment: "unadjusted",
    dividendTreatment: "excluded",
  },
  "split-adjusted": {
    mode: "split-adjusted",
    splitTreatment: "adjusted",
    dividendTreatment: "excluded",
  },
  "total-return": {
    mode: "total-return",
    splitTreatment: "adjusted",
    dividendTreatment: "reinvested",
  },
} as const;

export type PriceAdjustmentPolicy = (typeof adjustmentPolicies)[AdjustmentMode];
export type HistoricalInterval = "daily";
export type MarketTimeZone = "UTC";

export interface HistoricalPriceRequest {
  instrumentId: InstrumentId;
  startDate: CalendarDate;
  endDate: CalendarDate;
  interval: HistoricalInterval;
  timeZone: MarketTimeZone;
  adjustment: PriceAdjustmentPolicy;
}

export interface HistoricalPricePoint {
  date: CalendarDate;
  /**
   * Daily OHLC values under the enclosing series' explicit adjustment policy.
   * `close` is the session close—not a quote, bid, ask, or execution price.
   */
  open: number;
  high: number;
  low: number;
  close: number;
  /** Optional comparative adjusted close when a source exposes raw and adjusted values together. */
  adjustedClose?: number;
  volume?: number;
}

export interface HistoricalSeries {
  instrumentId: InstrumentId;
  currency: Currency;
  interval: HistoricalInterval;
  timeZone: MarketTimeZone;
  adjustment: PriceAdjustmentPolicy;
  points: readonly HistoricalPricePoint[];
  provenance: MarketDataProvenance;
}

export interface FxRate {
  baseCurrency: Currency;
  quoteCurrency: Currency;
  /** Quote-currency units per one base-currency unit. */
  rate: number;
  /** Provider-supplied calendar date; no intraday observation time is implied. */
  referenceDate: CalendarDate;
  retrievedAt: UtcTimestamp;
  provenance: FxRateProvenance;
}

interface CorporateActionBase {
  actionId: string;
  instrumentId: InstrumentId;
  exDate: CalendarDate;
}

export interface SplitCorporateAction extends CorporateActionBase {
  type: "split";
  ratio: number;
}

export interface DividendCorporateAction extends CorporateActionBase {
  type: "dividend";
  amount: number;
  currency: Currency;
  payDate: CalendarDate;
}

export type CorporateAction = SplitCorporateAction | DividendCorporateAction;

export interface CorporateActionsRequest {
  instrumentId: InstrumentId;
  startDate: CalendarDate;
  endDate: CalendarDate;
}

export interface CorporateActionSeries {
  instrumentId: InstrumentId;
  actions: readonly CorporateAction[];
  provenance: MarketDataProvenance;
}
