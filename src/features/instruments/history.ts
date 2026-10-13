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

export function historicalDateRange(range: ChartRange, now: Date) {
  const endDate = calendarDate(now);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const start = range === "YTD" ? new Date(Date.UTC(end.getUTCFullYear(), 0, 1))
    : range === "Max" ? new Date(Date.UTC(1900, 0, 1))
    : subtractMonths(end, range === "1M" ? 1 : range === "3M" ? 3 : range === "6M" ? 6 : range === "1Y" ? 12 : 60);
  return { startDate: calendarDate(start), endDate };
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
