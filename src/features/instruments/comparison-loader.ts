import "server-only";

import { isMarketDataError } from "@/features/market-data/errors";
import type { HistoricalPricePoint, Instrument, InstrumentId, MarketDataProvenance } from "@/features/market-data/contracts";
import type { MarketDataService } from "@/features/market-data/service";
import { comparePriceHistories, type PriceComparison } from "./comparison";
import { correlationMessage } from "./correlation-loader";
import { chartPoints, historicalRequest, type ChartRange } from "./history";

export type ComparedInstrument = {
  instrumentId: InstrumentId;
  /** Null when the metadata could not be loaded; `message` then says why. */
  instrument: Instrument | null;
  message: string | null;
  /** False when the price history for the range is unavailable; `historyMessage` then says why. */
  historyAvailable: boolean;
  historyMessage: string | null;
  historyPartial: boolean;
  provenance: MarketDataProvenance | null;
};

export type InstrumentComparison = {
  range: ChartRange;
  /** Requested range; `comparison.commonPeriod` carries the dates actually compared. */
  startDate: string;
  endDate: string;
  instruments: readonly [ComparedInstrument, ComparedInstrument];
  /** One of the identities is unknown to the source, so the route is a 404. */
  instrumentMissing: boolean;
  /** Null unless both histories loaded. */
  comparison: PriceComparison | null;
  /** Why no correlation coefficient is shown; null when it was computed. */
  correlationMessage: string | null;
};

type LoadedSide = { side: ComparedInstrument; points: HistoricalPricePoint[]; missing: boolean };

function rateLimited(error: unknown) {
  return isMarketDataError(error) && error.code === "RateLimited";
}

async function loadSide(service: MarketDataService, instrumentId: InstrumentId, range: ChartRange, now: Date): Promise<LoadedSide> {
  const request = historicalRequest(instrumentId, range, now);
  const empty = { instrumentId, historyAvailable: false, historyMessage: null, historyPartial: false, provenance: null };
  let instrument: Instrument;
  try { instrument = await service.getInstrumentMetadata(instrumentId); }
  catch (error) {
    const missing = isMarketDataError(error) && (error.code === "InstrumentNotFound" || error.code === "UnsupportedInstrument");
    return { side: { ...empty, instrument: null, message: rateLimited(error) ? "Tržní data jsou dočasně omezená. Zkus to za chvíli znovu." : "Tento instrument není z dostupného zdroje tržních dat k dispozici." }, points: [], missing };
  }
  try {
    const series = await service.getHistoricalPrices(request);
    const points = series.instrumentId === instrumentId && series.currency === instrument.quoteCurrency
      ? chartPoints(series, request.startDate, request.endDate) : [];
    return {
      side: { ...empty, instrument, message: null, historyAvailable: points.length > 0, historyMessage: points.length ? null : "Cenová historie pro toto období není dostupná.", historyPartial: points.length > 0 && series.provenance.completeness === "partial", provenance: series.provenance },
      points,
      missing: false,
    };
  } catch (error) {
    console.error("[instrument-comparison] history unavailable", { instrumentId, range, error: isMarketDataError(error) ? { code: error.code, message: error.message, context: error.context } : error });
    return { side: { ...empty, instrument, message: null, historyMessage: rateLimited(error) ? "Tržní data jsou dočasně omezená. Zkus to za chvíli znovu." : "Cenová historie pro toto období není dostupná." }, points: [], missing: false };
  }
}

/** Loads both instruments on the server; never compares closes sent by the client. */
export async function loadInstrumentComparison(
  service: MarketDataService,
  firstId: InstrumentId,
  secondId: InstrumentId,
  range: ChartRange,
  now: Date,
): Promise<InstrumentComparison> {
  const { startDate, endDate } = historicalRequest(firstId, range, now);
  const [first, second] = await Promise.all([loadSide(service, firstId, range, now), loadSide(service, secondId, range, now)]);
  const base = { range, startDate, endDate, instruments: [first.side, second.side] as const, instrumentMissing: first.missing || second.missing };
  if (!first.points.length || !second.points.length) {
    return { ...base, comparison: null, correlationMessage: "Cenová historie jednoho z instrumentů pro toto období není dostupná." };
  }
  const comparison = comparePriceHistories(first.points, second.points, { startDate, endDate, isMax: range === "Max" });
  return { ...base, comparison, correlationMessage: correlationMessage(comparison.correlation) };
}
