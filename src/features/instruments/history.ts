import { adjustmentPolicies, type CalendarDate, type HistoricalPricePoint, type HistoricalSeries } from "@/features/market-data/contracts";

export const chartRanges = ["1M", "3M", "6M", "YTD", "1Y", "5Y", "Max"] as const;
export type ChartRange = (typeof chartRanges)[number];

export function parseChartRange(value: unknown): ChartRange {
  return typeof value === "string" && chartRanges.includes(value as ChartRange) ? value as ChartRange : "5Y";
}

function calendarDate(date: Date): CalendarDate { return date.toISOString().slice(0, 10); }

function subtractMonths(end: Date, months: number) {
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months, 1));
  start.setUTCDate(Math.min(end.getUTCDate(), new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()));
  return start;
}

const rangeMonths: Record<Exclude<ChartRange, "YTD" | "Max">, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "5Y": 60 };

/** Calendar start of a range ending on `end` (UTC midnight). YTD starts on 1 January of `year`, which defaults to the end's year. */
function rangeStart(range: ChartRange, end: Date, year = end.getUTCFullYear()): CalendarDate {
  return calendarDate(range === "YTD" ? new Date(Date.UTC(year, 0, 1))
    : range === "Max" ? new Date(Date.UTC(1900, 0, 1))
    : subtractMonths(end, rangeMonths[range]));
}

export function historicalDateRange(range: ChartRange, now: Date) {
  const endDate = calendarDate(now);
  return { startDate: rangeStart(range, new Date(`${endDate}T00:00:00.000Z`)), endDate };
}

/** Longest market closure (weekend plus holidays) the latest observation may be behind the reference date. */
const MAX_CLOSURE_DAYS = 7;

/**
 * The window a range selects from an already loaded, ascending daily history. Month and
 * year ranges count back calendar months from the latest observation on or before
 * `referenceDate`, so weekends and market holidays do not shift the window. A history
 * that stopped more than a closure ago is not stretched: the window then ends on the
 * reference date, and a short range may hold no observations. YTD always starts on
 * 1 January of the reference year; Max reaches back to the provider's earliest data.
 */
export function timeframeWindow(history: readonly { date: CalendarDate }[], range: ChartRange, referenceDate: Date) {
  const reference = calendarDate(referenceDate);
  let endIndex = history.length - 1;
  while (endIndex >= 0 && history[endIndex].date > reference) endIndex--;
  const latest = endIndex >= 0 ? history[endIndex].date : null;
  const referenceDay = new Date(`${reference}T00:00:00.000Z`);
  const endDate = latest && referenceDay.getTime() - Date.parse(`${latest}T00:00:00.000Z`) <= MAX_CLOSURE_DAYS * 86_400_000 ? latest : reference;
  return { startDate: rangeStart(range, new Date(`${endDate}T00:00:00.000Z`), referenceDay.getUTCFullYear()), endDate };
}

/**
 * The observations inside a range's window, sliced from the loaded history without
 * copying or changing a single point. A range longer than the history keeps what exists.
 */
export function filterHistoryByTimeframe<T extends { date: CalendarDate }>(history: readonly T[], range: ChartRange, referenceDate: Date): T[] {
  const { startDate, endDate } = timeframeWindow(history, range, referenceDate);
  const start = history.findIndex((point) => point.date >= startDate);
  if (start === -1) return [];
  let end = history.length;
  while (end > start && history[end - 1].date > endDate) end--;
  return history.slice(start, end);
}

export function historicalRequest(instrumentId: string, range: ChartRange, now: Date) {
  return { instrumentId, ...historicalDateRange(range, now), interval: "daily" as const, timeZone: "UTC" as const, adjustment: adjustmentPolicies["split-adjusted"] };
}

/** Defend the chart against provider drift; never fill dates or manufacture closes. */
export function chartPoints(series: HistoricalSeries, startDate: CalendarDate, endDate: CalendarDate): HistoricalPricePoint[] {
  if (series.interval !== "daily" || series.timeZone !== "UTC" || series.adjustment.mode !== "split-adjusted") return [];
  if (series.points.length < 1) return [];
  let previous = "";
  for (const point of series.points) {
    if (point.date <= previous || point.date < startDate || point.date > endDate || !Number.isFinite(point.close) || point.close <= 0) return [];
    previous = point.date;
  }
  return [...series.points];
}
