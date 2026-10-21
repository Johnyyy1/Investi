import type { Currency, Instrument, InstrumentId, UtcTimestamp } from "./contracts";

/** All weights are decimal fractions: 0.042 means 4.2% of fund assets. */
export interface EtfHolding {
  symbol: string | null;
  name: string;
  isin: string | null;
  weight: number;
  marketValue: number | null;
  shares: number | null;
}

export interface EtfAllocation { name: string; weight: number }
export interface EtfInfo {
  expenseRatio: number | null;
  assetsUnderManagement: number | null;
  assetsCurrency: Currency | null;
  nav: number | null;
  navCurrency: Currency | null;
  inceptionDate: string | null;
  holdingsCount: number | null;
  /** Optional field dates: a mixed-date overview has no single observation date. */
  expenseRatioAsOf?: UtcTimestamp | null;
  assetsAsOf?: UtcTimestamp | null;
  assetsScope?: "fund" | "all-share-classes" | "etf-share-class";
}
export interface EtfDataset<T> {
  instrumentId: InstrumentId;
  value: T;
  /** Source observation date/time when supplied; retrieval time is separate. */
  asOf: UtcTimestamp | null;
  retrievedAt: UtcTimestamp;
  provider: string;
  isDeterministic: boolean;
  /** Partial means rejected rows, truncation or incomplete exposure coverage. */
  completeness: "complete" | "partial";
  /** Plain text only; provider HTML must never enter the rendering contract. */
  source?: { name: string; url: string; citation: string | null; license: string };
  sourceKind?: "issuer" | "regulatory-filing" | "other";
  /** Fractions of fund assets, never rescaled to make an incomplete distribution sum to 1. */
  coverage?: { knownWeight: number | null; unclassifiedWeight: number | null; inferred: boolean; classificationCoverage?: number | null };
}
export interface EtfHoldings {
  rows: readonly EtfHolding[];
  /** A returned row count is never treated as the fund's total holding count. */
  totalCount: number | null;
}
export type EtfDatasetName = "info" | "holdings" | "sectors" | "countries";
export interface EtfAnalyticsSnapshot {
  instrumentId: InstrumentId;
  info: EtfDataset<EtfInfo> | null;
  holdings: EtfDataset<EtfHoldings> | null;
  sectors: EtfDataset<readonly EtfAllocation[]> | null;
  countries: EtfDataset<readonly EtfAllocation[]> | null;
  unavailableDatasets: EtfDatasetName[];
}

export interface EtfAnalyticsProvider {
  readonly providerId: string;
  getEtfInfo(instrument: Instrument): Promise<EtfDataset<EtfInfo>>;
  getEtfHoldings(instrument: Instrument): Promise<EtfDataset<EtfHoldings>>;
  getEtfSectors(instrument: Instrument): Promise<EtfDataset<readonly EtfAllocation[]>>;
  getEtfCountries(instrument: Instrument): Promise<EtfDataset<readonly EtfAllocation[]>>;
}
