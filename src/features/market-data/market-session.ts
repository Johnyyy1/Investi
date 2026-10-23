import "server-only";

import type {
  CalendarDate,
  Instrument,
  MarketCalendarId,
  QuoteUsability,
  UtcTimestamp,
} from "./contracts";

export const US_EQUITIES_CALENDAR: MarketCalendarId = "us-equities";
export const US_EQUITIES_TIME_ZONE = "America/New_York";
export const US_EQUITIES_EXCHANGE_MICS = ["XNAS", "XNYS", "XASE"] as const;

const US_EQUITIES_MIC_SET = new Set<string>(US_EQUITIES_EXCHANGE_MICS);
const OPEN_MINUTE = 9 * 60 + 30;
const CLOSE_MINUTE = 16 * 60;

interface LocalDateTime {
  date: CalendarDate;
  year: number;
  month: number;
  day: number;
  weekday: number;
  minuteOfDay: number;
}

export interface QuoteUsabilityPolicy {
  freshForMilliseconds: number;
  unavailableAfterMilliseconds: number;
}

export interface MarketSessionSnapshot {
  calendar: MarketCalendarId | null;
  state: "open" | "closed" | "unknown";
  localDate: CalendarDate | null;
  latestCompletedSessionDate: CalendarDate | null;
}

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: US_EQUITIES_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function calendarDate(year: number, month: number, day: number): CalendarDate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function dateParts(date: CalendarDate) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function utcCalendarDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const { year, month, day } = dateParts(date);
  const shifted = utcCalendarDate(year, month, day + days);
  return calendarDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function weekday(year: number, month: number, day: number) {
  return utcCalendarDate(year, month, day).getUTCDay();
}

function nthWeekday(year: number, month: number, targetWeekday: number, occurrence: number) {
  const firstWeekday = weekday(year, month, 1);
  return 1 + ((targetWeekday - firstWeekday + 7) % 7) + (occurrence - 1) * 7;
}

function lastWeekday(year: number, month: number, targetWeekday: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return lastDay - ((weekday(year, month, lastDay) - targetWeekday + 7) % 7);
}

function observedFixedHoliday(year: number, month: number, day: number, saturdayObserved = true): CalendarDate {
  const date = calendarDate(year, month, day);
  const dayOfWeek = weekday(year, month, day);
  if (dayOfWeek === 6 && saturdayObserved) return addCalendarDays(date, -1);
  if (dayOfWeek === 0) return addCalendarDays(date, 1);
  return date;
}

// Meeus/Jones/Butcher Gregorian Easter algorithm; Good Friday is two days earlier.
function easterSunday(year: number): CalendarDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return calendarDate(year, month, day);
}

/** Recurring full-day U.S. cash-equity holidays. Ad-hoc closures and early closes are intentionally excluded. */
export function usEquitiesHolidays(year: number): ReadonlySet<CalendarDate> {
  const holidays = new Set<CalendarDate>();
  // Unlike other Saturday fixed holidays, a Saturday New Year's Day is not observed on Friday by U.S. exchanges.
  holidays.add(observedFixedHoliday(year, 1, 1, false));
  holidays.add(calendarDate(year, 1, nthWeekday(year, 1, 1, 3)));
  holidays.add(calendarDate(year, 2, nthWeekday(year, 2, 1, 3)));
  holidays.add(addCalendarDays(easterSunday(year), -2));
  holidays.add(calendarDate(year, 5, lastWeekday(year, 5, 1)));
  if (year >= 2022) holidays.add(observedFixedHoliday(year, 6, 19));
  holidays.add(observedFixedHoliday(year, 7, 4));
  holidays.add(calendarDate(year, 9, nthWeekday(year, 9, 1, 1)));
  holidays.add(calendarDate(year, 11, nthWeekday(year, 11, 4, 4)));
  holidays.add(observedFixedHoliday(year, 12, 25));
  return holidays;
}

export function isUsEquitiesTradingDay(date: CalendarDate) {
  const { year, month, day } = dateParts(date);
  const dayOfWeek = weekday(year, month, day);
  return dayOfWeek !== 0 && dayOfWeek !== 6 && !usEquitiesHolidays(year).has(date);
}

function localDateTime(instant: Date): LocalDateTime {
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    date: calendarDate(year, month, day),
    year,
    month,
    day,
    weekday: weekday(year, month, day),
    minuteOfDay: hour * 60 + minute,
  };
}

function previousTradingDay(startDate: CalendarDate) {
  let candidate = addCalendarDays(startDate, -1);
  for (let index = 0; index < 10; index += 1) {
    if (isUsEquitiesTradingDay(candidate)) return candidate;
    candidate = addCalendarDays(candidate, -1);
  }
  throw new RangeError("A previous U.S. equities session could not be resolved.");
}

export function marketCalendarForInstrument(instrument: Instrument): MarketCalendarId | null {
  if ((instrument.assetType === "equity" || instrument.assetType === "etf") && instrument.exchangeMic && US_EQUITIES_MIC_SET.has(instrument.exchangeMic)) {
    return US_EQUITIES_CALENDAR;
  }
  return null;
}

/** The next regular U.S. session open (09:30 New York) strictly after `now`. */
export function nextUsEquitiesSessionOpen(now: Date): Date {
  const local = localDateTime(now);
  let date = isUsEquitiesTradingDay(local.date) && local.minuteOfDay < OPEN_MINUTE ? local.date : addCalendarDays(local.date, 1);
  for (let index = 0; index < 10 && !isUsEquitiesTradingDay(date); index += 1) date = addCalendarDays(date, 1);
  const { year, month, day } = dateParts(date);
  // 09:30 New York is 13:30 UTC under EDT and 14:30 UTC under EST.
  for (const utcHour of [13, 14]) {
    const candidate = new Date(Date.UTC(year, month - 1, day, utcHour, 30));
    const candidateLocal = localDateTime(candidate);
    if (candidateLocal.date === date && candidateLocal.minuteOfDay === OPEN_MINUTE) return candidate;
  }
  throw new RangeError("The next U.S. equities session open could not be resolved.");
}

export function getMarketSessionSnapshot(instrument: Instrument, now: Date): MarketSessionSnapshot {
  const calendar = marketCalendarForInstrument(instrument);
  if (!calendar) return { calendar: null, state: "unknown", localDate: null, latestCompletedSessionDate: null };
  const local = localDateTime(now);
  const tradingDay = isUsEquitiesTradingDay(local.date);
  const open = tradingDay && local.minuteOfDay >= OPEN_MINUTE && local.minuteOfDay < CLOSE_MINUTE;
  const latestCompletedSessionDate = tradingDay && local.minuteOfDay >= CLOSE_MINUTE
    ? local.date
    : previousTradingDay(local.date);
  return {
    calendar,
    state: open ? "open" : "closed",
    localDate: local.date,
    latestCompletedSessionDate,
  };
}

export function evaluateQuoteUsability(
  instrument: Instrument,
  observedAt: UtcTimestamp,
  now: Date,
  policy: QuoteUsabilityPolicy,
): QuoteUsability {
  const observed = new Date(observedAt);
  const ageMilliseconds = now.getTime() - observed.getTime();
  if (!Number.isFinite(ageMilliseconds) || ageMilliseconds < 0) throw new RangeError("The quote observation time is invalid.");

  const session = getMarketSessionSnapshot(instrument, now);
  if (!session.calendar) {
    if (ageMilliseconds <= policy.freshForMilliseconds) {
      return { status: "fresh", ageMilliseconds, marketState: "unknown", marketCalendar: null, usableForValuation: true, usableForExecution: true };
    }
    if (ageMilliseconds <= policy.unavailableAfterMilliseconds) {
      return { status: "stale", ageMilliseconds, marketState: "unknown", marketCalendar: null, usableForValuation: true, usableForExecution: false };
    }
    return { status: "unavailable", ageMilliseconds, marketState: "unknown", marketCalendar: null, usableForValuation: false, usableForExecution: false };
  }

  if (session.state === "open") {
    const fresh = ageMilliseconds <= policy.freshForMilliseconds;
    return {
      status: fresh ? "fresh" : "stale",
      ageMilliseconds,
      marketState: "open",
      marketCalendar: session.calendar,
      usableForValuation: fresh,
      usableForExecution: fresh,
    };
  }

  const observedLocal = localDateTime(observed);
  const nearRegularClose = observedLocal.minuteOfDay >= CLOSE_MINUTE - Math.ceil(policy.freshForMilliseconds / 60_000);
  const completedSessionReference = observedLocal.date === session.latestCompletedSessionDate && nearRegularClose;
  return {
    status: completedSessionReference ? "closed-market-reference" : "stale",
    ageMilliseconds,
    marketState: "closed",
    marketCalendar: session.calendar,
    usableForValuation: completedSessionReference,
    usableForExecution: false,
  };
}
