import "server-only";

import { TtlStore } from "../cache";
import type { Instrument } from "../contracts";
import { MarketDataError, type MarketDataErrorCode } from "../errors";
import type { EtfAllocation, EtfAnalyticsProvider, EtfDataset, EtfHolding, EtfHoldings, EtfInfo } from "../etf-analytics";

export const TICKERINSIDE_PROVIDER_ID = "tickerinside";
export type TickerInsideFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export interface TickerInsideOptions {
  fetch?: TickerInsideFetch;
  clock?: () => Date;
  timeoutMilliseconds?: number;
}
type Row = Record<string, unknown>;
type Fund = { row: Row; retrievedAt: string };
const origin = "https://tickerinside.com";
const usExchanges: Readonly<Record<string, string>> = { AMEX: "XASE", NASDAQ: "XNAS", NYSE: "XNYS" };
const sourceExchanges = new Set(["NYSE Arca", "NYSE American", "NYSE", "NASDAQ", "Nasdaq", "Cboe BZX", "BATS"]);
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function record(value: unknown): value is Row { return value !== null && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function nonnegative(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null; }
function percent(value: unknown): number | null { const n = nonnegative(value); return n !== null && n <= 100 ? n / 100 : null; }
function billions(value: unknown): number | null { const n = nonnegative(value); return n !== null && Number.isFinite(n * 1e9) ? n * 1e9 : null; }
function date(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed.toISOString() : null;
}
function failure(code: MarketDataErrorCode, reason: string) {
  return new MarketDataError(code, "TickerInside ETF analytics are unavailable.", { provider: TICKERINSIDE_PROVIDER_ID, reason });
}
function weighted<T extends { weight: number }>(rows: T[]) { return rows.sort((a, b) => b.weight - a.weight); }
// Allow small published rounding differences, without hiding meaningful missing exposure.
function incomplete(weight: number) { return weight < 0.9999 || weight > 1.0001; }

/** Deliberately accepts only provider-qualified US listings verified by FMP profile metadata. */
function tickerFor(instrument: Instrument) {
  const match = /^FMP:([A-Z]+):([A-Za-z0-9][A-Za-z0-9.-]{0,19})$/.exec(instrument.instrumentId);
  if (instrument.assetType !== "etf" || instrument.quoteCurrency !== "USD" || !match
    || !usExchanges[match[1]] || usExchanges[match[1]] !== instrument.exchangeMic
    || match[2].toUpperCase() !== instrument.symbol.toUpperCase()) {
    throw failure("UnsupportedInstrument", "unverified-us-etf");
  }
  return match[2].toUpperCase();
}

export class TickerInsideEtfAnalyticsProvider implements EtfAnalyticsProvider {
  readonly providerId = TICKERINSIDE_PROVIDER_ID;
  private readonly fetchImplementation: TickerInsideFetch;
  private readonly clock: () => Date;
  private readonly timeout: number;
  private readonly inFlight = new Map<string, Promise<Fund>>();
  private readonly snapshots: TtlStore<Fund>;

  constructor(options: TickerInsideOptions = {}) {
    this.fetchImplementation = options.fetch ?? fetch;
    this.clock = options.clock ?? (() => new Date());
    this.timeout = options.timeoutMilliseconds ?? 10_000;
    // Bridges independently timed cache misses for four views of the same file. The service's
    // normalized 12h/24h caches remain authoritative; this bounded bridge lives for one minute.
    this.snapshots = new TtlStore(60_000, () => this.clock().getTime(), 50);
  }

  private async request(ticker: string): Promise<Fund> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetchImplementation(`${origin}/api/v1/fund/${ticker.toLowerCase()}.json`, {
        method: "GET", headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw failure(response.status === 404 ? "UnsupportedInstrument" : response.status === 429 ? "RateLimited" : "ProviderUnavailable", `http-${response.status}`);
      let row: unknown;
      try { row = await response.json(); }
      catch { throw failure(controller.signal.aborted ? "ProviderUnavailable" : "MalformedProviderResponse", "invalid-json"); }
      if (!record(row) || text(row.ticker)?.toUpperCase() !== ticker || row.error
        || row.kind === "mutual_fund" || row.share_class_of
        || (row.identifiers != null && (!record(row.identifiers)
          || row.identifiers.asset_type !== "etf"
          || !sourceExchanges.has(String(row.identifiers.exchange))))) {
        throw failure("MalformedProviderResponse", "fund-identity-mismatch");
      }
      // Do not keep weekly returns, flows (separate terms), cite_html, or other unused fields.
      const fields = ["ticker", "name", "page_url", "cite_as", "source_layer", "holdings_as_of", "expense_ratio", "expense_ratio_as_of", "aum_b", "aum_date", "etf_class_net_assets_b", "etf_class_net_assets_as_of", "multi_class", "holdings", "breakdown", "unmapped_pct", "listed_pct"];
      return { row: Object.fromEntries(fields.map((key) => [key, row[key]])), retrievedAt: this.clock().toISOString() };
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      throw failure("ProviderUnavailable", controller.signal.aborted ? "timeout" : "network");
    } finally { clearTimeout(timer); }
  }

  private async fund(instrument: Instrument): Promise<Fund> {
    const ticker = tickerFor(instrument);
    const cached = this.snapshots.get(ticker);
    if (cached) return cached;
    const existing = this.inFlight.get(ticker);
    if (existing) return existing;
    const pending = this.request(ticker);
    this.inFlight.set(ticker, pending);
    try {
      const value = await pending;
      this.snapshots.set(ticker, value);
      return value;
    } finally { this.inFlight.delete(ticker); }
  }

  private dataset<T>(instrument: Instrument, fund: Fund, value: T, asOf: string | null, partial: boolean): EtfDataset<T> {
    // Construct links from the validated ticker; never trust cite_html or arbitrary provider URLs.
    const page = `${origin}/etf/${instrument.symbol.toLowerCase()}/`;
    return {
      instrumentId: instrument.instrumentId, value, asOf, retrievedAt: fund.retrievedAt,
      provider: this.providerId, isDeterministic: false, completeness: partial ? "partial" : "complete",
      source: { name: "TickerInside", url: fund.row.page_url === page ? page : `${origin}/api/v1/fund/${instrument.symbol.toLowerCase()}.json`, citation: text(fund.row.cite_as), license: "CC BY 4.0" },
      sourceKind: fund.row.source_layer === "issuer" ? "issuer" : String(fund.row.source_layer).startsWith("sec_nport") ? "regulatory-filing" : "other",
    };
  }

  async getEtfInfo(instrument: Instrument): Promise<EtfDataset<EtfInfo>> {
    const fund = await this.fund(instrument);
    const row = fund.row;
    const shareClassAssets = billions(row.etf_class_net_assets_b);
    const assets = shareClassAssets ?? billions(row.aum_b);
    const value: EtfInfo = {
      expenseRatio: percent(row.expense_ratio), expenseRatioAsOf: date(row.expense_ratio_as_of),
      assetsUnderManagement: assets, assetsCurrency: assets === null ? null : "USD",
      assetsAsOf: assets === null ? null : date(shareClassAssets !== null ? row.etf_class_net_assets_as_of : row.aum_date),
      assetsScope: shareClassAssets !== null ? "etf-share-class" : row.multi_class === true || /^Vanguard\b/i.test(text(row.name) ?? "") ? "all-share-classes" : "fund",
      // last_close is a market price; positions counts map keys, not an official fund count.
      nav: null, navCurrency: null, inceptionDate: null, holdingsCount: null,
    };
    return this.dataset(instrument, fund, value, null, false);
  }

  async getEtfHoldings(instrument: Instrument): Promise<EtfDataset<EtfHoldings>> {
    const fund = await this.fund(instrument);
    if (!record(fund.row.holdings) || !Object.keys(fund.row.holdings).length) throw failure("HistoricalDataUnavailable", "no-holdings");
    const rows: EtfHolding[] = [];
    for (const [identifier, sourceWeight] of Object.entries(fund.row.holdings)) {
      const weight = percent(sourceWeight);
      if (weight === null || !identifier.trim() || identifier.length > 200 || /[\u0000-\u001f\u007f]/.test(identifier)) continue;
      rows.push({ symbol: /^[A-Z0-9][A-Z0-9.^_:/-]{0,79}$/i.test(identifier) ? identifier : null, name: identifier, weight, isin: null, shares: null, marketValue: null });
    }
    if (!rows.length) throw failure("MalformedProviderResponse", "invalid-holdings");
    const knownWeight = rows.reduce((sum, row) => sum + row.weight, 0);
    const partial = rows.length !== Object.keys(fund.row.holdings).length || incomplete(knownWeight)
      || (nonnegative(fund.row.unmapped_pct) ?? 0) > 0 || (percent(fund.row.listed_pct) ?? 1) < 1;
    return this.dataset(instrument, fund, { rows: weighted(rows), totalCount: null }, date(fund.row.holdings_as_of), partial);
  }

  private async allocations(instrument: Instrument, kind: "sectors" | "countries"): Promise<EtfDataset<readonly EtfAllocation[]>> {
    const fund = await this.fund(instrument);
    const breakdown = fund.row.breakdown;
    if (!record(breakdown)) throw failure("HistoricalDataUnavailable", `no-${kind}`);
    const source = breakdown[`${kind}_pct`];
    if (!record(source) || !Object.keys(source).length) throw failure("HistoricalDataUnavailable", `no-${kind}`);
    const rows: EtfAllocation[] = [];
    for (const [label, sourceWeight] of Object.entries(source)) {
      const weight = percent(sourceWeight);
      if (weight === null || !label.trim()) continue;
      const name = kind === "countries" && /^[A-Z]{2}$/.test(label) ? regionNames.of(label) ?? label : label;
      rows.push({ name, weight });
    }
    if (!rows.length) throw failure("MalformedProviderResponse", `invalid-${kind}`);
    const knownWeight = rows.reduce((sum, row) => sum + row.weight, 0);
    const unclassifiedWeight = percent(breakdown[kind === "sectors" ? "no_sector_pct" : "no_country_pct"]);
    const coverageWeight = kind === "sectors" ? percent(breakdown.sector_coverage_pct) : null;
    const inferred = kind === "sectors" && breakdown.sectors_stated !== true;
    const partial = rows.length !== Object.keys(source).length || incomplete(knownWeight) || (unclassifiedWeight ?? 0) > 0 || (coverageWeight !== null && coverageWeight < 1) || inferred;
    return { ...this.dataset(instrument, fund, weighted(rows), date(fund.row.holdings_as_of), partial), coverage: { knownWeight, unclassifiedWeight, inferred, classificationCoverage: coverageWeight } };
  }
  getEtfSectors(instrument: Instrument) { return this.allocations(instrument, "sectors"); }
  getEtfCountries(instrument: Instrument) { return this.allocations(instrument, "countries"); }
}
