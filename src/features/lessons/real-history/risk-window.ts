import { historicalPriceReturns } from "@/features/finance/historical-price-returns";
import { dayNumber, MAX_VOLATILITY_GAP_DAYS, priceMetrics, type MaxDrawdown } from "@/features/instruments/price-metrics";
import { adjustmentPolicies, type CalendarDate, type HistoricalPriceRequest, type HistoricalSeries, type InstrumentId } from "@/features/market-data/contracts";
import { PERIODS_PER_YEAR } from "../volatility/model";
import { unavailableMessage, validateSnapshotPoints, type LessonHistoryPoint, type LessonHistorySnapshot } from "./snapshot";

export type RiskHistoryInstrument = { instrumentId: InstrumentId; symbol: string; name: string; assetType: "equity" | "etf" | "index" };

/**
 * One fixed past year of daily closes, so every learner sees the same observations whatever
 * the day of the visit. Like the returns lessons, real history is loaded through
 * MarketDataService at runtime and never copied into the repository.
 */
export type RiskHistoryPlan = {
  instruments: readonly RiskHistoryInstrument[];
  startDate: CalendarDate;
  endDate: CalendarDate;
  /** The first and last close must lie this close to the window's edges. */
  maxEdgeGapDays: number;
  /** Fewer closes than this means the provider returned a holed year. */
  minObservations: number;
  /** What the window shows, under the chart. */
  period: string;
};

export const riskHistoryPlans = {
  fmp: {
    instruments: [
      { instrumentId: "FMP:NASDAQ:AAPL", symbol: "AAPL", name: "Apple Inc.", assetType: "equity" },
      { instrumentId: "FMP:AMEX:SPY", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "etf" },
    ],
    startDate: "2022-01-01",
    endDate: "2022-12-31",
    maxEdgeGapDays: 7,
    minObservations: 240,
    period: "Denní zavírací ceny za rok 2022.",
  },
  deterministic: {
    instruments: [
      { instrumentId: "US-XNAS:NVDA", symbol: "NVDA", name: "NVIDIA Corporation", assetType: "equity" },
      { instrumentId: "US-XCBO:SPX", symbol: "SPX", name: "S&P 500 Index", assetType: "index" },
    ],
    startDate: "2022-01-01",
    endDate: "2022-12-31",
    maxEdgeGapDays: 7,
    minObservations: 240,
    period: "Denní zavírací ceny z ukázkové řady za rok 2022.",
  },
} as const satisfies Record<string, RiskHistoryPlan>;

export function riskHistoryRequest(plan: RiskHistoryPlan, instrument: RiskHistoryInstrument): HistoricalPriceRequest {
  return { instrumentId: instrument.instrumentId, startDate: plan.startDate, endDate: plan.endDate, interval: "daily", timeZone: "UTC", adjustment: adjustmentPolicies["split-adjusted"] };
}

/** Unrounded decimals from the Lab's own priceMetrics, so the lesson and the Lab agree. */
export type RiskMetrics = {
  /** Daily returns that enter the volatility; returns across longer gaps are excluded, as in the Lab. */
  returnCount: number;
  dailyDeviation: number;
  annualisedVolatility: number;
  maxDrawdown: MaxDrawdown;
};

/** Plain, client-safe values only: no provider response objects cross into the lesson. */
export type RiskHistorySnapshot = RiskHistoryInstrument & {
  currency: LessonHistorySnapshot["currency"];
  points: readonly LessonHistoryPoint[];
  period: string;
  provenance: LessonHistorySnapshot["provenance"];
  labHref: string | null;
  metrics: RiskMetrics;
};

export type RiskHistoryEntry =
  | { status: "ok"; snapshot: RiskHistorySnapshot }
  | { status: "unavailable"; instrument: RiskHistoryInstrument; message: string };

export function riskMetrics(points: readonly LessonHistoryPoint[]): RiskMetrics | null {
  const metrics = priceMetrics(points);
  if (!metrics || metrics.annualisedVolatility === null || metrics.maxDrawdown === null) return null;
  const returnCount = points.slice(1).filter((point, index) => dayNumber(point.date) - dayNumber(points[index].date) <= MAX_VOLATILITY_GAP_DAYS).length;
  return { returnCount, dailyDeviation: metrics.annualisedVolatility / Math.sqrt(PERIODS_PER_YEAR.daily), annualisedVolatility: metrics.annualisedVolatility, maxDrawdown: metrics.maxDrawdown };
}

/** Freeze the plan's whole window from normalized history; any gap at the edges or defect makes the instrument unavailable. */
export function freezeRiskHistory(series: HistoricalSeries, plan: RiskHistoryPlan, instrument: RiskHistoryInstrument, labHref: string | null): RiskHistoryEntry {
  const unavailable: RiskHistoryEntry = { status: "unavailable", instrument, message: unavailableMessage };
  if (series.instrumentId !== instrument.instrumentId) return unavailable;
  // Reuses the strict consumer: daily UTC split-adjusted basis, sorted, unique, positive closes, inside the window.
  if (historicalPriceReturns(series, riskHistoryRequest(plan, instrument)).status !== "ok") return unavailable;
  const points = series.points.map((point) => ({ date: point.date, close: point.close }));
  if (points.length < plan.minObservations || validateSnapshotPoints(points)) return unavailable;
  if (dayNumber(points[0].date) - dayNumber(plan.startDate) > plan.maxEdgeGapDays || dayNumber(plan.endDate) - dayNumber(points[points.length - 1].date) > plan.maxEdgeGapDays) return unavailable;
  const metrics = riskMetrics(points);
  if (!metrics) return unavailable;
  const { provider, dataset, dataKind, isDeterministic, completeness, retrievedAt } = series.provenance;
  return {
    status: "ok",
    snapshot: {
      ...instrument, currency: series.currency, points, period: plan.period, labHref, metrics,
      provenance: { provider, dataset, dataKind, isDeterministic, adjustmentMode: "split-adjusted", completeness, retrievedAt },
    },
  };
}
