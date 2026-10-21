import "server-only";

import { currencies, type Currency, type Instrument } from "../contracts";
import { MarketDataError } from "../errors";
import type { EtfAllocation, EtfAnalyticsProvider, EtfDataset, EtfHolding, EtfHoldings, EtfInfo } from "../etf-analytics";
import { FmpClient, FMP_PROVIDER_ID } from "./client";

type Row = Record<string, unknown>;
function record(value: unknown): value is Row { return value !== null && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function finite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
function nonnegative(value: unknown): number | null { const n = finite(value); return n !== null && n >= 0 ? n : null; }
function positive(value: unknown): number | null { const n = finite(value); return n !== null && n > 0 ? n : null; }
function count(value: unknown): number | null { const n = nonnegative(value); return n !== null && Number.isSafeInteger(n) ? n : null; }
function currency(value: unknown): Currency | null { return typeof value === "string" && currencies.includes(value as Currency) ? value as Currency : null; }
function date(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}
function timestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value.replace(" ", "T") + (/Z$|[+-]\d\d:\d\d$/.test(value) ? "" : "Z"));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
/** FMP weightPercentage and expenseRatio are percentage points; Investník stores decimal fractions. */
export function fmpPercent(value: unknown): number | null {
  const n = typeof value === "string" && value.trim().endsWith("%") ? finite(value.trim().slice(0, -1)) : finite(value);
  return n !== null && n >= 0 && n <= 100 ? n / 100 : null;
}
function malformed(dataset: string) { return new MarketDataError("MalformedProviderResponse", "Financial Modeling Prep returned malformed ETF analytics.", { provider: FMP_PROVIDER_ID, dataset }); }
function rows(payload: unknown, dataset: string): Row[] {
  if (!Array.isArray(payload) || payload.length === 0 || !payload.every(record)) throw malformed(dataset);
  return payload;
}
function matches(row: Row, symbol: string) { return typeof row.symbol === "string" && row.symbol.toUpperCase() === symbol.toUpperCase(); }
function sortWeighted<T extends { weight: number }>(values: T[]): T[] { return values.sort((a, b) => b.weight - a.weight || JSON.stringify(a).localeCompare(JSON.stringify(b))); }

export class FmpEtfAnalyticsProvider implements EtfAnalyticsProvider {
  readonly providerId = FMP_PROVIDER_ID;
  constructor(private readonly client: FmpClient, private readonly clock: () => Date = () => new Date()) {}
  private dataset<T>(instrument: Instrument, value: T, sourceTime: string | null, partial: boolean): EtfDataset<T> {
    return { instrumentId: instrument.instrumentId, value, asOf: sourceTime, retrievedAt: this.clock().toISOString(), provider: this.providerId, isDeterministic: false, completeness: partial ? "partial" : "complete" };
  }
  private async fetch(instrument: Instrument, endpoint: string): Promise<Row[]> {
    if (instrument.assetType !== "etf") throw new MarketDataError("UnsupportedInstrument", "ETF analytics are available for ETFs only.", { instrumentId: instrument.instrumentId });
    return rows(await this.client.get(`etf/${endpoint}`, { symbol: instrument.symbol }), endpoint);
  }
  async getEtfInfo(instrument: Instrument): Promise<EtfDataset<EtfInfo>> {
    const records = await this.fetch(instrument, "info");
    if (records.length !== 1 || !matches(records[0], instrument.symbol)) throw malformed("info");
    const row = records[0];
    const value: EtfInfo = {
      expenseRatio: fmpPercent(row.expenseRatio),
      assetsUnderManagement: positive(row.assetsUnderManagement),
      // FMP info reports AUM without a separate currency field; do not infer from quote currency.
      assetsCurrency: currency(row.assetsCurrency),
      nav: positive(row.nav),
      navCurrency: currency(row.navCurrency),
      inceptionDate: date(row.inceptionDate),
      holdingsCount: count(row.holdingsCount),
    };
    return this.dataset(instrument, value, timestamp(row.updatedAt), false);
  }
  async getEtfHoldings(instrument: Instrument): Promise<EtfDataset<EtfHoldings>> {
    const source = await this.fetch(instrument, "holdings");
    const valid: EtfHolding[] = [];
    const timestamps: string[] = [];
    for (const row of source) {
      if (!matches(row, instrument.symbol)) continue;
      const weight = fmpPercent(row.weightPercentage);
      const name = text(row.name) ?? text(row.asset);
      if (weight === null || !name) continue;
      valid.push({ symbol: text(row.asset), name, isin: text(row.isin), weight, marketValue: nonnegative(row.marketValue), shares: nonnegative(row.sharesNumber) });
      const time = timestamp(row.updatedAt);
      if (time) timestamps.push(time);
    }
    if (!valid.length) throw malformed("holdings");
    const asOf = timestamps.length === valid.length ? timestamps.sort()[0] : null;
    return this.dataset(instrument, { rows: sortWeighted(valid), totalCount: null }, asOf, valid.length !== source.length);
  }
  private async allocations(instrument: Instrument, kind: "sector-weightings" | "country-weightings", field: "sector" | "country"): Promise<EtfDataset<readonly EtfAllocation[]>> {
    const source = await this.fetch(instrument, kind);
    const valid: EtfAllocation[] = [];
    const timestamps: string[] = [];
    for (const row of source) {
      if (!matches(row, instrument.symbol)) continue;
      const name = text(row[field]);
      const weight = fmpPercent(row.weightPercentage);
      if (!name || weight === null) continue;
      valid.push({ name, weight });
      const time = timestamp(row.updatedAt);
      if (time) timestamps.push(time);
    }
    if (!valid.length) throw malformed(kind);
    return this.dataset(instrument, sortWeighted(valid), timestamps.length === valid.length ? timestamps.sort()[0] : null, valid.length !== source.length);
  }
  getEtfSectors(instrument: Instrument) { return this.allocations(instrument, "sector-weightings", "sector"); }
  getEtfCountries(instrument: Instrument) { return this.allocations(instrument, "country-weightings", "country"); }
}
