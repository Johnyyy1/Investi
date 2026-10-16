import "server-only";

import { perfCount } from "@/lib/perf";
import type {
  CorporateActionSeries,
  FxRate,
  HistoricalSeries,
  Instrument,
  InstrumentSearchResult,
} from "./contracts";
import type { ProviderQuote } from "./provider";
import type { EquityFundamentalsSnapshot } from "./equity-fundamentals";
import type { EtfDataset, EtfInfo, EtfHoldings, EtfAllocation } from "./etf-analytics";

export type CachedEtfDataset = EtfDataset<EtfInfo | EtfHoldings | readonly EtfAllocation[]>;

const MINUTE = 60 * 1_000;
const HOUR = 60 * MINUTE;

/** Defaults chosen for interactive Portfolio Lab traffic; shared entries use the same lifetimes. */
export const defaultMarketDataCacheTtls = {
  searchMilliseconds: 5 * MINUTE,
  instrumentMilliseconds: 24 * HOUR,
  quoteMilliseconds: 30 * 1_000,
  historyMilliseconds: 24 * HOUR,
  fxMilliseconds: 5 * MINUTE,
  corporateActionsMilliseconds: HOUR,
  /** Financial reports and TTM ratios update far less often than quotes. */
  equityFundamentalsMilliseconds: 6 * HOUR,
  /** ETF composition and fund metadata update independently of intraday quotes. */
  etfInfoMilliseconds: 24 * HOUR,
  etfHoldingsMilliseconds: 12 * HOUR,
  etfSectorsMilliseconds: 24 * HOUR,
  etfCountriesMilliseconds: 24 * HOUR,
} as const;

export interface MarketDataCacheTtls {
  searchMilliseconds: number;
  instrumentMilliseconds: number;
  quoteMilliseconds: number;
  historyMilliseconds: number;
  fxMilliseconds: number;
  corporateActionsMilliseconds: number;
  equityFundamentalsMilliseconds: number;
  etfInfoMilliseconds: number;
  etfHoldingsMilliseconds: number;
  etfSectorsMilliseconds: number;
  etfCountriesMilliseconds: number;
}

/**
 * Upper bound on entries per cache family in one process. Search keys come from user input and
 * history keys roll daily, so without a bound a long-running instance would grow without limit.
 */
export const defaultMarketDataCacheMaxEntries = {
  search: 500,
  instrument: 1_000,
  quote: 1_000,
  /** History series are the largest values (up to decades of daily points). */
  history: 200,
  fx: 500,
  "corporate-actions": 200,
  "equity-fundamentals": 500,
  "etf-info": 300,
  "etf-holdings": 300,
  "etf-sectors": 300,
  "etf-countries": 300,
} as const;

export type MarketDataCacheFamily = keyof typeof defaultMarketDataCacheMaxEntries;
type EtfCacheKind = "info" | "holdings" | "sectors" | "countries";

/** Families written to the shared store. Search stays process-local: its keys are free user input. */
export const sharedMarketDataCacheFamilies: ReadonlySet<MarketDataCacheFamily> = new Set([
  "instrument",
  "quote",
  "history",
  "fx",
  "corporate-actions",
  "equity-fundamentals",
  "etf-info",
  "etf-holdings",
  "etf-sectors",
  "etf-countries",
]);

export interface SharedMarketDataCacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Cross-instance store for normalized market data (for example a Postgres table). It holds only
 * values the service already validated; keys already carry the provider id and request shape.
 * Implementations must never return an entry whose expiresAt is at or before `now`.
 */
export interface SharedMarketDataCacheStore {
  get(family: MarketDataCacheFamily, key: string, now: number): Promise<SharedMarketDataCacheEntry | undefined>;
  set(family: MarketDataCacheFamily, key: string, value: unknown, expiresAt: number, now: number): Promise<void>;
}

export interface InMemoryMarketDataCacheOptions {
  clock?: () => number;
  ttls?: Partial<MarketDataCacheTtls>;
  maxEntries?: Partial<Record<MarketDataCacheFamily, number>>;
  /** Expired entries are swept on writes at most this often; reads already drop their own expired key. */
  sweepIntervalMilliseconds?: number;
}

export interface TieredMarketDataCacheOptions extends InMemoryMarketDataCacheOptions {
  shared?: SharedMarketDataCacheStore;
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

/** Process-local TTL map with LRU eviction. Map insertion order doubles as recency order. */
export class TtlStore<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private lastSweep: number;

  constructor(
    private readonly ttlMilliseconds: number,
    private readonly clock: () => number,
    private readonly maxEntries = Number.POSITIVE_INFINITY,
    private readonly sweepIntervalMilliseconds = 5 * MINUTE,
  ) {
    this.lastSweep = clock();
  }

  get size() {
    return this.entries.size;
  }

  get(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.clock()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** `expiresAt` lets a shared-store hit keep its remaining lifetime; it never exceeds this store's TTL. */
  set(key: string, value: T, expiresAt?: number) {
    const now = this.clock();
    this.entries.delete(key);
    const expiry = Math.min(expiresAt ?? Number.POSITIVE_INFINITY, now + this.ttlMilliseconds);
    if (expiry <= now) return;
    this.entries.set(key, { value, expiresAt: expiry });
    if (now - this.lastSweep >= this.sweepIntervalMilliseconds) this.sweep(now);
    while (this.entries.size > this.maxEntries) {
      const leastRecent = this.entries.keys().next().value as string;
      this.entries.delete(leastRecent);
    }
  }

  sweep(now = this.clock()) {
    for (const [key, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(key);
    this.lastSweep = now;
  }
}

/** Internal extension point. Callers depend on MarketDataService, not a cache implementation. */
export interface MarketDataCache {
  getSearch(key: string): Promise<readonly InstrumentSearchResult[] | undefined>;
  setSearch(key: string, value: readonly InstrumentSearchResult[]): Promise<void>;
  getInstrument(key: string): Promise<Instrument | undefined>;
  setInstrument(key: string, value: Instrument): Promise<void>;
  getQuote(key: string): Promise<ProviderQuote | undefined>;
  setQuote(key: string, value: ProviderQuote): Promise<void>;
  getHistory(key: string): Promise<HistoricalSeries | undefined>;
  setHistory(key: string, value: HistoricalSeries): Promise<void>;
  getFx(key: string): Promise<FxRate | undefined>;
  setFx(key: string, value: FxRate): Promise<void>;
  getCorporateActions(key: string): Promise<CorporateActionSeries | undefined>;
  setCorporateActions(key: string, value: CorporateActionSeries): Promise<void>;
  getEquityFundamentals(key: string): Promise<EquityFundamentalsSnapshot | undefined>;
  setEquityFundamentals(key: string, value: EquityFundamentalsSnapshot): Promise<void>;
  getEtfDataset(key: string, ttlKind: "info" | "holdings" | "sectors" | "countries"): Promise<CachedEtfDataset | undefined>;
  setEtfDataset(key: string, value: CachedEtfDataset, ttlKind: "info" | "holdings" | "sectors" | "countries"): Promise<void>;
}

export class NoopMarketDataCache implements MarketDataCache {
  async getSearch(key: string) { void key; return undefined; }
  async setSearch(key: string, value: readonly InstrumentSearchResult[]) { void key; void value; }
  async getInstrument(key: string) { void key; return undefined; }
  async setInstrument(key: string, value: Instrument) { void key; void value; }
  async getQuote(key: string) { void key; return undefined; }
  async setQuote(key: string, value: ProviderQuote) { void key; void value; }
  async getHistory(key: string) { void key; return undefined; }
  async setHistory(key: string, value: HistoricalSeries) { void key; void value; }
  async getFx(key: string) { void key; return undefined; }
  async setFx(key: string, value: FxRate) { void key; void value; }
  async getCorporateActions(key: string) { void key; return undefined; }
  async setCorporateActions(key: string, value: CorporateActionSeries) { void key; void value; }
  async getEquityFundamentals(key: string) { void key; return undefined; }
  async setEquityFundamentals(key: string, value: EquityFundamentalsSnapshot) { void key; void value; }
  async getEtfDataset(key: string, ttlKind: "info" | "holdings" | "sectors" | "countries") { void key; void ttlKind; return undefined; }
  async setEtfDataset(key: string, value: CachedEtfDataset, ttlKind: "info" | "holdings" | "sectors" | "countries") { void key; void value; void ttlKind; }
}

const ttlByFamily = (ttls: MarketDataCacheTtls): Record<MarketDataCacheFamily, number> => ({
  search: ttls.searchMilliseconds,
  instrument: ttls.instrumentMilliseconds,
  quote: ttls.quoteMilliseconds,
  history: ttls.historyMilliseconds,
  fx: ttls.fxMilliseconds,
  "corporate-actions": ttls.corporateActionsMilliseconds,
  "equity-fundamentals": ttls.equityFundamentalsMilliseconds,
  "etf-info": ttls.etfInfoMilliseconds,
  "etf-holdings": ttls.etfHoldingsMilliseconds,
  "etf-sectors": ttls.etfSectorsMilliseconds,
  "etf-countries": ttls.etfCountriesMilliseconds,
});

/**
 * Normalized-data cache with a bounded process-local layer and an optional shared layer.
 * A local miss falls through to the shared store; a shared hit is copied locally with its remaining
 * lifetime only. Shared-store failures degrade to a miss and never fail the market-data request.
 * MarketDataService coalesces in-flight loads and recalculates quote usability on every read.
 */
export class TieredMarketDataCache implements MarketDataCache {
  private readonly clock: () => number;
  private readonly ttls: Record<MarketDataCacheFamily, number>;
  private readonly local: { [F in MarketDataCacheFamily]: TtlStore<unknown> };
  private readonly shared?: SharedMarketDataCacheStore;

  constructor(options: TieredMarketDataCacheOptions = {}) {
    this.clock = options.clock ?? Date.now;
    const ttls = { ...defaultMarketDataCacheTtls, ...options.ttls };
    for (const [kind, ttl] of Object.entries(ttls)) {
      if (!Number.isFinite(ttl) || ttl <= 0) throw new RangeError(`${kind} must be a positive finite cache TTL.`);
    }
    const maxEntries = { ...defaultMarketDataCacheMaxEntries, ...options.maxEntries };
    for (const [family, limit] of Object.entries(maxEntries)) {
      if (!Number.isSafeInteger(limit) || limit <= 0) throw new RangeError(`${family} must have a positive integer entry limit.`);
    }
    const sweepInterval = options.sweepIntervalMilliseconds ?? 5 * MINUTE;
    if (!Number.isFinite(sweepInterval) || sweepInterval <= 0) throw new RangeError("The cache sweep interval must be a positive finite duration.");
    this.ttls = ttlByFamily(ttls);
    this.local = Object.fromEntries((Object.keys(this.ttls) as MarketDataCacheFamily[]).map((family) => [
      family,
      new TtlStore<unknown>(this.ttls[family], this.clock, maxEntries[family], sweepInterval),
    ])) as TieredMarketDataCache["local"];
    this.shared = options.shared;
  }

  /** Number of process-local entries per family; exposed for tests and diagnostics. */
  localSize(family: MarketDataCacheFamily) {
    return this.local[family].size;
  }

  async getSearch(key: string) { return this.read<readonly InstrumentSearchResult[]>("search", key); }
  async setSearch(key: string, value: readonly InstrumentSearchResult[]) { await this.write("search", key, value); }
  async getInstrument(key: string) { return this.read<Instrument>("instrument", key); }
  async setInstrument(key: string, value: Instrument) { await this.write("instrument", key, value); }
  async getQuote(key: string) { return this.read<ProviderQuote>("quote", key); }
  async setQuote(key: string, value: ProviderQuote) { await this.write("quote", key, value); }
  async getHistory(key: string) { return this.read<HistoricalSeries>("history", key); }
  async setHistory(key: string, value: HistoricalSeries) { await this.write("history", key, value); }
  async getFx(key: string) { return this.read<FxRate>("fx", key); }
  async setFx(key: string, value: FxRate) { await this.write("fx", key, value); }
  async getCorporateActions(key: string) { return this.read<CorporateActionSeries>("corporate-actions", key); }
  async setCorporateActions(key: string, value: CorporateActionSeries) { await this.write("corporate-actions", key, value); }
  async getEquityFundamentals(key: string) { return this.read<EquityFundamentalsSnapshot>("equity-fundamentals", key); }
  async setEquityFundamentals(key: string, value: EquityFundamentalsSnapshot) { await this.write("equity-fundamentals", key, value); }
  async getEtfDataset(key: string, ttlKind: EtfCacheKind) { return this.read<CachedEtfDataset>(`etf-${ttlKind}`, key); }
  async setEtfDataset(key: string, value: CachedEtfDataset, ttlKind: EtfCacheKind) { await this.write(`etf-${ttlKind}`, key, value); }

  private async read<T>(family: MarketDataCacheFamily, key: string): Promise<T | undefined> {
    const local = this.local[family].get(key);
    if (local !== undefined) return local as T;
    if (!this.shared || !sharedMarketDataCacheFamilies.has(family)) return undefined;
    const now = this.clock();
    let entry: SharedMarketDataCacheEntry | undefined;
    try {
      entry = await this.shared.get(family, key, now);
    } catch {
      sharedFailure("read", family);
      return undefined;
    }
    if (!entry || !(entry.expiresAt > now) || entry.value === undefined || entry.value === null) return undefined;
    perfCount(`market.cache.shared-hit.${family}`);
    this.local[family].set(key, entry.value, entry.expiresAt);
    return entry.value as T;
  }

  private async write(family: MarketDataCacheFamily, key: string, value: unknown) {
    const now = this.clock();
    const expiresAt = now + this.ttls[family];
    this.local[family].set(key, value, expiresAt);
    if (!this.shared || !sharedMarketDataCacheFamilies.has(family)) return;
    try {
      await this.shared.set(family, key, value, expiresAt, now);
    } catch {
      sharedFailure("write", family);
    }
  }
}

/** Logs only the operation and family: never keys, values or raw database errors. */
function sharedFailure(operation: "read" | "write", family: MarketDataCacheFamily) {
  perfCount(`market.cache.shared-error.${family}`);
  console.warn(`[market-data] shared cache ${operation} failed; falling back to the provider`, { family });
}

/** Process-local cache only: bounded, lazily expiring, neither distributed nor persistent. */
export class InMemoryMarketDataCache extends TieredMarketDataCache {
  constructor(options: InMemoryMarketDataCacheOptions = {}) {
    super({ ...options, shared: undefined });
  }
}
