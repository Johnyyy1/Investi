import type { Currency, HistoricalPricePoint } from "@/features/market-data/contracts";
import type { PriceObservation } from "./period-statistics";
import type { MaxDrawdown } from "./price-metrics";

export type ChartTone = "positive" | "negative" | "neutral";
export type ChartType = "line" | "candles";
export type CandleInterval = "daily" | "weekly" | "monthly";
export type Candle = Pick<HistoricalPricePoint, "open" | "high" | "low" | "close"> & {
  /** The calendar period start; this is the bar's position on the time axis. */
  date: string;
  periodStart: string;
  periodEnd: string;
  /** First and last observations actually inside the period. */
  firstDate: string;
  lastDate: string;
  observationCount: number;
  /** The calendar period reaches outside the loaded window, so the bar covers only part of it. */
  partial: boolean;
};
/** A change against the previous bar's close; null for the first bar, which has no predecessor. */
export type BarChange = { change: number; changePercent: number } | null;

/** Only an explicit `chart=candles` selects candles; anything else is the line default. */
export function parseChartType(value: unknown): ChartType {
  return value === "candles" ? "candles" : "line";
}

export function chartTone(returnPercent: number | null | undefined): ChartTone {
  return returnPercent === null || returnPercent === undefined || returnPercent === 0
    ? "neutral" : returnPercent > 0 ? "positive" : "negative";
}

function validOhlc(point: PriceObservation): point is HistoricalPricePoint {
  const { open, high, low, close } = point as Partial<HistoricalPricePoint>;
  if (typeof open !== "number" || typeof high !== "number" || typeof low !== "number" || typeof close !== "number") return false;
  return [open, high, low, close].every((value) => Number.isFinite(value) && value > 0)
    && low <= Math.min(open, close)
    && high >= Math.max(open, close);
}

/**
 * Candles need genuine OHLC for every observation. Close-only data (or OHLC copied from
 * the close, so every bar is flat) is never turned into candles.
 */
export function hasCandlestickData(points: readonly PriceObservation[]): points is readonly HistoricalPricePoint[] {
  return points.length >= 2 && points.every(validOhlc)
    && points.filter((point) => (point as HistoricalPricePoint).high > (point as HistoricalPricePoint).low).length >= 2;
}

const DAY_MS = 86_400_000;

/**
 * Bar size follows the span actually loaded, so young instruments keep detail:
 * up to ~13 months daily (1M–1R), up to ~5.5 years weekly (5L), longer monthly (Max).
 */
export function candleInterval(points: readonly PriceObservation[]): CandleInterval {
  if (points.length < 2) return "daily";
  const spanDays = (Date.parse(`${points[points.length - 1].date}T00:00:00.000Z`) - Date.parse(`${points[0].date}T00:00:00.000Z`)) / DAY_MS;
  return spanDays <= 400 ? "daily" : spanDays <= 2_010 ? "weekly" : "monthly";
}

/** Weeks run Monday–Sunday and months are calendar months, both in UTC. */
export function candlePeriod(date: string, interval: CandleInterval): { start: string; end: string } {
  if (interval === "daily") return { start: date, end: date };
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (interval === "monthly") {
    return {
      start: new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10),
      end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
    };
  }
  const day = new Date(`${date}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  const start = day.toISOString().slice(0, 10);
  day.setUTCDate(day.getUTCDate() + 6);
  return { start, end: day.toISOString().slice(0, 10) };
}

/**
 * First open, highest high, lowest low and last close per period; nothing is averaged.
 * Empty periods produce no bar. Input must be strictly ascending by date: unordered or
 * duplicated observations return no bars rather than a silently re-ordered series.
 * `window` is the loaded date range, used to flag periods it cuts.
 */
export function aggregateCandles(points: readonly HistoricalPricePoint[], interval: CandleInterval, window?: { startDate: string; endDate: string }): Candle[] {
  const bars: Candle[] = [];
  let previousDate = "";
  for (const point of points) {
    if (point.date <= previousDate) return [];
    previousDate = point.date;
    const period = candlePeriod(point.date, interval);
    const last = bars[bars.length - 1];
    if (last && last.periodStart === period.start) {
      last.high = Math.max(last.high, point.high);
      last.low = Math.min(last.low, point.low);
      last.close = point.close;
      last.lastDate = point.date;
      last.observationCount++;
    } else {
      const partial = interval !== "daily" && window !== undefined && (period.start < window.startDate || period.end > window.endDate);
      bars.push({ date: period.start, periodStart: period.start, periodEnd: period.end, firstDate: point.date, lastDate: point.date, open: point.open, high: point.high, low: point.low, close: point.close, observationCount: 1, partial });
    }
  }
  return bars;
}

export function barChanges(bars: readonly { close: number }[]): BarChange[] {
  return bars.map((bar, index) => {
    if (index === 0) return null;
    const previous = bars[index - 1].close;
    return { change: bar.close - previous, changePercent: (bar.close / previous - 1) * 100 };
  });
}

/**
 * The drawdown is measured on daily closes; on aggregated candles it is shown from the
 * bar containing the peak to the bar containing the trough, so the band and its
 * description always name the same dates.
 */
export function drawdownSpan(drawdown: MaxDrawdown | null, interval: CandleInterval | "line"): { from: string; to: string } | null {
  if (!drawdown) return null;
  if (interval === "line") return { from: drawdown.peakDate, to: drawdown.troughDate };
  return { from: candlePeriod(drawdown.peakDate, interval).start, to: candlePeriod(drawdown.troughDate, interval).start };
}

/**
 * Price-axis precision. Cents are enough from 10 upwards (ticks fall on round values);
 * cheaper instruments keep the data's own decimals, at least 2 and at most 4.
 */
export function axisDecimals(values: readonly number[]): number {
  if (!values.length || Math.max(...values) >= 10) return 2;
  let decimals = 2;
  for (const value of values) {
    const fraction = String(value).split(".")[1];
    if (fraction && fraction.length > decimals) decimals = Math.min(4, fraction.length);
    if (decimals === 4) break;
  }
  return decimals;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
function numberFormat(minimum: number, maximum: number) {
  const key = `${minimum}:${maximum}`;
  let format = numberFormats.get(key);
  if (!format) numberFormats.set(key, format = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: minimum, maximumFractionDigits: maximum }));
  return format;
}

/** Fixed decimals when given (axis labels); otherwise 2–4, so prices show the data's own precision. */
export function formatChartNumber(value: number, decimals?: number) {
  return decimals === undefined ? numberFormat(2, 4).format(value) : numberFormat(decimals, decimals).format(value);
}
export function formatChartPrice(value: number, currency: Currency) {
  return `${formatChartNumber(value)} ${currency}`;
}
/** Signs are explicit so a change never relies on colour alone. */
export function formatSignedChange(value: number, suffix: string, maximumDecimals = 2) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${numberFormat(Math.min(2, maximumDecimals), maximumDecimals).format(Math.abs(value))}${suffix === "%" ? " %" : suffix}`;
}

const dayFormat = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric", timeZone: "UTC" });
export function formatChartDate(date: string) {
  return dayFormat.format(new Date(`${date}T00:00:00.000Z`));
}
/** A bar's label names the observations it holds, never the empty calendar edges. */
export function candleLabel(candle: Pick<Candle, "periodStart" | "firstDate" | "lastDate" | "partial">, interval: CandleInterval) {
  if (interval === "daily") return formatChartDate(candle.firstDate);
  if (interval === "monthly") {
    const month = monthFormat.format(new Date(`${candle.periodStart}T00:00:00.000Z`));
    return candle.partial ? `${month} (${formatChartDate(candle.firstDate)} – ${formatChartDate(candle.lastDate)})` : month;
  }
  return candle.firstDate === candle.lastDate ? `Týden · ${formatChartDate(candle.firstDate)}` : `Týden · ${formatChartDate(candle.firstDate)} – ${formatChartDate(candle.lastDate)}`;
}

export const candleIntervalLabels: Record<CandleInterval, { adjective: string; bars: string }> = {
  daily: { adjective: "denní", bars: "Denní svíčky" },
  weekly: { adjective: "týdenní", bars: "Týdenní svíčky" },
  monthly: { adjective: "měsíční", bars: "Měsíční svíčky" },
};
