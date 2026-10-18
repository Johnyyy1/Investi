import "server-only";

import { isMarketDataError } from "@/features/market-data/errors";
import type { InstrumentId, MarketDataProvenance } from "@/features/market-data/contracts";
import type { MarketDataService } from "@/features/market-data/service";
import { returnCorrelation, MIN_CORRELATION_OBSERVATIONS, type CorrelationFrequency, type ReturnCorrelation } from "./correlation";
import { chartPoints, historicalRequest, type ChartRange } from "./history";

export type InstrumentCorrelation = {
  /** Null when either history could not be loaded; otherwise the domain result, including insufficient data. */
  correlation: ReturnCorrelation | null;
  /** Why no coefficient is shown; null when it was computed. */
  message: string | null;
  /** Requested range; the correlation carries the dates actually paired. */
  startDate: string;
  endDate: string;
  historyPartial: boolean;
  /** Provenance of both histories, so sample data stays labelled as such. */
  provenance: readonly [MarketDataProvenance, MarketDataProvenance] | null;
};

async function loadCloses(service: MarketDataService, instrumentId: InstrumentId, range: ChartRange, now: Date) {
  const request = historicalRequest(instrumentId, range, now);
  const [instrument, series] = await Promise.all([service.getInstrumentMetadata(instrumentId), service.getHistoricalPrices(request)]);
  const points = series.instrumentId === instrumentId && series.currency === instrument.quoteCurrency
    ? chartPoints(series, request.startDate, request.endDate) : [];
  return { request, points, provenance: series.provenance };
}

/** Why no coefficient is shown; null when it was computed. */
export function correlationMessage(correlation: ReturnCorrelation) {
  if (correlation.status === "ok") return null;
  if (correlation.status === "no-variation") return "Cena jednoho z instrumentů se v tomto období nemění, takže korelaci nelze spočítat.";
  const unit = correlation.frequency === "weekly" ? "týdenních" : "denních";
  return `Pro korelaci je potřeba alespoň ${MIN_CORRELATION_OBSERVATIONS} společných ${unit} výnosů. Zkus delší období.`;
}

/** Loads both histories on the server; never computes from closes sent by the client. */
export async function loadInstrumentCorrelation(
  service: MarketDataService,
  firstId: InstrumentId,
  secondId: InstrumentId,
  range: ChartRange,
  now: Date,
  frequency: CorrelationFrequency = "daily",
): Promise<InstrumentCorrelation> {
  const { startDate, endDate } = historicalRequest(firstId, range, now);
  const [first, second] = await Promise.allSettled([loadCloses(service, firstId, range, now), loadCloses(service, secondId, range, now)]);
  if (first.status === "rejected" || second.status === "rejected" || !first.value.points.length || !second.value.points.length) {
    const reason = first.status === "rejected" ? first.reason : second.status === "rejected" ? second.reason : null;
    if (reason) console.error("[instrument-correlation] history unavailable", { firstId, secondId, range, error: isMarketDataError(reason) ? { code: reason.code, message: reason.message, context: reason.context } : reason });
    return {
      correlation: null,
      message: isMarketDataError(reason) && reason.code === "RateLimited"
        ? "Tržní data jsou dočasně omezená. Zkus to za chvíli znovu."
        : "Cenová historie jednoho z instrumentů pro toto období není dostupná.",
      startDate,
      endDate,
      historyPartial: false,
      provenance: null,
    };
  }
  const correlation = returnCorrelation(first.value.points, second.value.points, frequency);
  return {
    correlation,
    message: correlationMessage(correlation),
    startDate,
    endDate,
    historyPartial: first.value.provenance.completeness === "partial" || second.value.provenance.completeness === "partial",
    provenance: [first.value.provenance, second.value.provenance],
  };
}
