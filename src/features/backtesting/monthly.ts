import type { CalendarDate, HistoricalPricePoint } from "@/features/market-data/contracts";
import { BacktestDataError, type CalendarMonth } from "./spec";

/** Weekends, holidays and a short provider lag stay within this many days of the month end. */
export const MONTH_END_TOLERANCE_DAYS = 7;

export type MonthEndClose = { month: CalendarMonth; date: CalendarDate; close: number };

const DAY = 86_400_000;

function monthEndTime(month: CalendarMonth) {
  return Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0);
}

/**
 * The last close inside each requested month, taken from validated, strictly ascending daily
 * points. A month whose last close lies more than the tolerance before its end (data stops
 * mid-month) or that has no close at all is reported as missing, never filled.
 */
export function monthEndCloses(points: readonly HistoricalPricePoint[], months: readonly CalendarMonth[]) {
  const last = new Map<CalendarMonth, HistoricalPricePoint>();
  for (const point of points) last.set(point.date.slice(0, 7), point);
  const closes: MonthEndClose[] = [];
  const missing: CalendarMonth[] = [];
  for (const month of months) {
    const point = last.get(month);
    if (!point || monthEndTime(month) - Date.parse(`${point.date}T00:00:00.000Z`) > MONTH_END_TOLERANCE_DAYS * DAY) missing.push(month);
    else closes.push({ month, date: point.date, close: point.close });
  }
  return { closes, missing };
}

export type AlignedMonthlyCloses = {
  months: readonly CalendarMonth[];
  /** closes[instrument][month], in the order the instruments were given. */
  closes: readonly (readonly number[])[];
};

/**
 * Pairs instruments by calendar month: every instrument must have a month-end close in every
 * requested month. Their closing days may differ inside the month; months are never shifted.
 */
export function alignMonthlyCloses(series: readonly { label: string; points: readonly HistoricalPricePoint[] }[], months: readonly CalendarMonth[]): AlignedMonthlyCloses {
  const closes = series.map(({ label, points }) => {
    const result = monthEndCloses(points, months);
    if (result.missing.length) {
      const shown = result.missing.slice(0, 3).join(", ") + (result.missing.length > 3 ? ` a ${result.missing.length - 3} dalších` : "");
      throw new BacktestDataError(`Historie ${label} je neúplná: chybí měsíční uzávěrka za ${shown}. Data nedoplňujeme, zvol jiné období.`, "incomplete");
    }
    return result.closes.map((close) => close.close);
  });
  return { months: [...months], closes };
}
