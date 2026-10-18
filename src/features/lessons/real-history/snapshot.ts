import { historicalPriceReturns } from "@/features/finance/historical-price-returns";
import { cumulativeReturn, simpleReturn } from "@/features/finance/returns";
import { adjustmentPolicies, type CalendarDate, type Currency, type DataCompleteness, type DataKind, type HistoricalPriceRequest, type HistoricalSeries, type InstrumentId, type UtcTimestamp } from "@/features/market-data/contracts";
import { parseNumericAnswer } from "../question-evaluation";

export type LessonHistoryInstrument = { instrumentId: InstrumentId; symbol: string; name: string; assetType: "equity" | "etf" };

/**
 * A fixed past window and fixed anchor dates, so every learner sees the same observations
 * whatever the day of the visit. Real history is never copied into the repository: the
 * provider's terms do not allow redistributing it, so it is loaded through MarketDataService.
 */
export type LessonHistoryPlan = {
  instruments: readonly LessonHistoryInstrument[];
  startDate: CalendarDate;
  endDate: CalendarDate;
  /** Each anchor takes the last available close on or before it, never a filled one. */
  anchors: readonly CalendarDate[];
  maxLookbackDays: number;
  /** How the anchors were chosen, shown under the table. */
  sampling: string;
};

export const lessonHistoryPlans = {
  fmp: {
    instruments: [
      { instrumentId: "FMP:NASDAQ:AAPL", symbol: "AAPL", name: "Apple Inc.", assetType: "equity" },
      { instrumentId: "FMP:AMEX:SPY", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "etf" },
    ],
    startDate: "2023-12-15",
    endDate: "2024-12-31",
    anchors: ["2023-12-31", "2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31"],
    maxLookbackDays: 7,
    sampling: "Závěrečná cena posledního obchodního dne každého čtvrtletí roku 2024 a konce roku 2023.",
  },
  deterministic: {
    instruments: [
      { instrumentId: "US-XNAS:AAPL", symbol: "AAPL", name: "Apple Inc.", assetType: "equity" },
      { instrumentId: "IE-XETR:VWCE", symbol: "VWCE", name: "Vanguard FTSE All-World UCITS ETF", assetType: "etf" },
    ],
    startDate: "2026-01-01",
    endDate: "2026-01-16",
    anchors: ["2026-01-05", "2026-01-07", "2026-01-09", "2026-01-13", "2026-01-16"],
    maxLookbackDays: 7,
    sampling: "Vybrané denní závěrečné ceny z ukázkové řady.",
  },
} as const satisfies Record<string, LessonHistoryPlan>;

export function lessonHistoryRequest(plan: LessonHistoryPlan, instrument: LessonHistoryInstrument): HistoricalPriceRequest {
  return { instrumentId: instrument.instrumentId, startDate: plan.startDate, endDate: plan.endDate, interval: "daily", timeZone: "UTC", adjustment: adjustmentPolicies["split-adjusted"] };
}

export type LessonHistoryPoint = { date: CalendarDate; close: number };

/** Plain, client-safe values only: no provider response objects cross into the lesson. */
export type LessonHistorySnapshot = LessonHistoryInstrument & {
  currency: Currency;
  points: readonly LessonHistoryPoint[];
  sampling: string;
  provenance: {
    provider: string;
    dataset: string;
    dataKind: DataKind;
    isDeterministic: boolean;
    adjustmentMode: "split-adjusted";
    completeness: DataCompleteness;
    retrievedAt: UtcTimestamp;
  };
  labHref: string | null;
};

export type LessonHistoryEntry =
  | { status: "ok"; snapshot: LessonHistorySnapshot }
  | { status: "unavailable"; instrument: LessonHistoryInstrument; message: string };

export type SnapshotValidationError = "too-few-points" | "invalid-date" | "unsorted-date" | "duplicate-date" | "invalid-close";

const DAY = 86_400_000;
const calendarTime = (date: CalendarDate) => {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00.000Z`) : NaN;
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time : NaN;
};

/** A frozen snapshot is strictly ascending, has no repeated date and only positive finite closes. */
export function validateSnapshotPoints(points: readonly LessonHistoryPoint[]): SnapshotValidationError | null {
  if (points.length < 2) return "too-few-points";
  for (const [index, point] of points.entries()) {
    if (!Number.isFinite(calendarTime(point.date))) return "invalid-date";
    if (!Number.isFinite(point.close) || point.close <= 0) return "invalid-close";
    if (index === 0) continue;
    if (point.date === points[index - 1].date) return "duplicate-date";
    if (point.date < points[index - 1].date) return "unsorted-date";
  }
  return null;
}

export const unavailableMessage = "Historická data teď nejsou dostupná. Nic nedoplňujeme nulou ani ukázkovými čísly.";

/** Freeze the plan's anchor closes from normalized history; any gap or defect makes the instrument unavailable. */
export function freezeLessonHistory(series: HistoricalSeries, plan: LessonHistoryPlan, instrument: LessonHistoryInstrument, labHref: string | null): LessonHistoryEntry {
  const unavailable: LessonHistoryEntry = { status: "unavailable", instrument, message: unavailableMessage };
  if (series.instrumentId !== instrument.instrumentId) return unavailable;
  // Reuses the strict consumer: daily UTC split-adjusted basis, sorted, unique, positive closes, inside the window.
  if (historicalPriceReturns(series, lessonHistoryRequest(plan, instrument)).status !== "ok") return unavailable;
  const points: LessonHistoryPoint[] = [];
  for (const anchor of plan.anchors) {
    const anchorTime = calendarTime(anchor);
    const point = series.points.findLast((candidate) => candidate.date <= anchor);
    if (!point || anchorTime - calendarTime(point.date) > plan.maxLookbackDays * DAY) return unavailable;
    points.push({ date: point.date, close: point.close });
  }
  if (validateSnapshotPoints(points)) return unavailable;
  const { provider, dataset, dataKind, isDeterministic, completeness, retrievedAt } = series.provenance;
  return {
    status: "ok",
    snapshot: {
      ...instrument, currency: series.currency, points, sampling: plan.sampling, labHref,
      provenance: { provider, dataset, dataKind, isDeterministic, adjustmentMode: "split-adjusted", completeness, retrievedAt },
    },
  };
}

/** Only provider-reported, non-deterministic history may be called historical; everything else is sample data. */
export function isRealHistory(snapshot: LessonHistorySnapshot) {
  return snapshot.provenance.dataKind === "historical" && !snapshot.provenance.isDeterministic;
}

export type SnapshotPeriod = { startDate: CalendarDate; endDate: CalendarDate; startClose: number; endClose: number; returnValue: number };

/** Unrounded decimal returns; rounding belongs to the display only. */
export function snapshotReturns(points: readonly LessonHistoryPoint[]) {
  const periods: SnapshotPeriod[] = points.slice(1).map((point, index) => ({
    startDate: points[index].date, endDate: point.date, startClose: points[index].close, endClose: point.close,
    returnValue: simpleReturn(points[index].close, point.close),
  }));
  const returns = periods.map((period) => period.returnValue);
  return {
    periods,
    compounded: cumulativeReturn(returns),
    direct: simpleReturn(points[0].close, points[points.length - 1].close),
    arithmeticSum: returns.reduce((sum, value) => sum + value, 0),
  };
}

/** Percentage-point tolerance shared with the authored numeric questions. */
export const PERCENT_TOLERANCE = 0.05;

/** Checks a percentage answer against an unrounded decimal return; blanks and non-numbers stay unanswered. */
export function checkPercentAnswer(input: string, expectedDecimal: number, tolerance = PERCENT_TOLERANCE): boolean | undefined {
  const value = parseNumericAnswer(input);
  if (!Number.isFinite(value)) return undefined;
  return Math.abs(value - expectedDecimal * 100) <= tolerance;
}
