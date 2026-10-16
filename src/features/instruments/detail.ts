import "server-only";

import { isMarketDataError } from "@/features/market-data/errors";
import type { HistoricalPricePoint, Instrument, Quote } from "@/features/market-data/contracts";
import type { MarketDataService } from "@/features/market-data/service";
import type { EquityFundamentalsSnapshot } from "@/features/market-data/equity-fundamentals";
import type { EtfAnalyticsSnapshot } from "@/features/market-data/etf-analytics";
import { chartPoints, historicalRequest, type ChartRange } from "./history";
import { priceMetrics, type PriceMetrics } from "./price-metrics";

export type HomeCurrencyReference = { rate: number; referenceDate: string; provider: string };

export type InstrumentDetail = {
  instrument: Instrument | null;
  quote: Quote | null;
  points: HistoricalPricePoint[];
  quoteMessage: string | null;
  historyMessage: string | null;
  metadataMessage: string | null;
  /** The source does not know this identity (as opposed to being unreachable), so the route is a 404. */
  instrumentMissing: boolean;
  startDate: string;
  endDate: string;
  historyPartial: boolean;
  /** Price-only metrics over the loaded split-adjusted closes; null when history is unavailable. */
  metrics: PriceMetrics | null;
  /** CZK reference rate for the quote, or null when unavailable or the quote is already in CZK. */
  homeCurrency: HomeCurrencyReference | null;
  homeCurrencyMessage: string | null;
  fundamentals: EquityFundamentalsSnapshot | null;
  fundamentalsMessage: string | null;
  etfAnalytics: EtfAnalyticsSnapshot | null;
  etfAnalyticsMessage: string | null;
};

const HOME_CURRENCY = "CZK";

function safeMessage(error: unknown, subject: "instrument" | "quote" | "history") {
  if (isMarketDataError(error) && error.code === "RateLimited") return "Tržní data jsou dočasně omezená. Zkus to za chvíli znovu.";
  if (subject === "instrument") return "Tento instrument není z dostupného zdroje tržních dat k dispozici.";
  if (subject === "quote") return "Aktuální tržní cena není dostupná.";
  return "Cenová historie pro toto období není dostupná.";
}

async function loadHomeCurrencyReference(service: MarketDataService, quoteCurrency: Instrument["quoteCurrency"], observedAt: Quote["observedAt"]): Promise<{ reference: HomeCurrencyReference | null; message: string | null }> {
  try {
    const fx = await service.getFxRate(quoteCurrency, HOME_CURRENCY, observedAt);
    if (!Number.isFinite(fx.rate) || fx.rate <= 0) return { reference: null, message: "Přepočet do korun teď není dostupný." };
    return { reference: { rate: fx.rate, referenceDate: fx.referenceDate, provider: fx.provenance.provider }, message: null };
  } catch (error) {
    console.error("[instrument-detail] CZK rate unavailable", { currency: quoteCurrency, observedAt, error: isMarketDataError(error) ? { code: error.code, message: error.message, context: error.context } : error });
    return { reference: null, message: "Přepočet do korun teď není dostupný. Cena v měně instrumentu zůstává k dispozici." };
  }
}

export async function loadInstrumentDetail(service: MarketDataService, instrumentId: string, range: ChartRange, now: Date): Promise<InstrumentDetail> {
  const request = historicalRequest(instrumentId, range, now);
  let instrument: Instrument;
  try { instrument = await service.getInstrumentMetadata(instrumentId); }
  catch (error) { return { instrument: null, quote: null, points: [], metadataMessage: safeMessage(error, "instrument"), instrumentMissing: isMarketDataError(error) && (error.code === "InstrumentNotFound" || error.code === "UnsupportedInstrument"), quoteMessage: null, historyMessage: null, startDate: request.startDate, endDate: request.endDate, historyPartial: false, metrics: null, homeCurrency: null, homeCurrencyMessage: null, fundamentals: null, fundamentalsMessage: null, etfAnalytics: null, etfAnalyticsMessage: null }; }

  const [quoteResult, historyResult, fundamentalsResult, etfResult] = await Promise.allSettled([
    service.getQuote(instrumentId),
    service.getHistoricalPrices(request),
    instrument.assetType === "equity" ? service.getEquityFundamentals(instrumentId) : Promise.resolve(null),
    instrument.assetType === "etf" ? service.getEtfAnalytics(instrumentId) : Promise.resolve(null),
  ]);
  const quote = quoteResult.status === "fulfilled" && quoteResult.value.instrumentId === instrumentId && quoteResult.value.currency === instrument.quoteCurrency ? quoteResult.value : null;
  const series = historyResult.status === "fulfilled" ? historyResult.value : null;
  const points = series && series.instrumentId === instrumentId && series.currency === instrument.quoteCurrency
    ? chartPoints(series, request.startDate, request.endDate) : [];
  const homeCurrency = quote && instrument.quoteCurrency !== HOME_CURRENCY ? await loadHomeCurrencyReference(service, instrument.quoteCurrency, quote.observedAt) : { reference: null, message: null };
  return {
    instrument,
    quote,
    points,
    metadataMessage: null,
    instrumentMissing: false,
    quoteMessage: quote ? null : safeMessage(quoteResult.status === "rejected" ? quoteResult.reason : null, "quote"),
    historyMessage: points.length ? null : safeMessage(historyResult.status === "rejected" ? historyResult.reason : null, "history"),
    startDate: request.startDate,
    endDate: request.endDate,
    historyPartial: series?.provenance.completeness === "partial",
    metrics: points.length ? priceMetrics(points) : null,
    homeCurrency: homeCurrency.reference,
    homeCurrencyMessage: homeCurrency.message,
    fundamentals: fundamentalsResult.status === "fulfilled" ? fundamentalsResult.value : null,
    fundamentalsMessage: instrument.assetType === "equity" && fundamentalsResult.status === "rejected" ? "Metriky společnosti teď nejsou dostupné. Cenová historie a investování zůstávají k dispozici." : null,
    etfAnalytics: etfResult.status === "fulfilled" ? etfResult.value : null,
    etfAnalyticsMessage: instrument.assetType === "etf" && etfResult.status === "rejected" ? "Složení fondu teď není dostupné. Cenová historie a investování zůstávají k dispozici." : null,
  };
}
