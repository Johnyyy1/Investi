export type PriceObservation = { date: string; close: number };

const periodLabels: Record<string, string> = {
  "1M": "1 měsíc",
  "3M": "3 měsíce",
  "6M": "6 měsíců",
  YTD: "od začátku roku",
  "1Y": "1 rok",
  "5Y": "5 let",
  Max: "celé období",
};

export function periodReturnLabel(range: string) {
  const period = periodLabels[range] ?? range;
  return range === "YTD" ? `Cenový výnos ${period}` : `Cenový výnos za ${period}`;
}

export type PeriodStatistics = {
  start: PriceObservation;
  end: PriceObservation;
  change: number | null;
  returnPercent: number | null;
  /** Lowest and highest close, with the first date each was reached; closes, not intraday extremes. */
  low: number;
  lowDate: string;
  high: number;
  highDate: string;
  observationCount: number;
};

/** Statistics describe available split-adjusted closing prices, never total return. */
export function periodStatistics(points: readonly PriceObservation[] | null | undefined): PeriodStatistics | null {
  if (!points?.length) return null;
  let previousDate = "";
  let low = points[0];
  let high = points[0];
  for (const point of points) {
    const parsed = new Date(`${point.date}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== point.date || point.date <= previousDate || !Number.isFinite(point.close) || point.close <= 0) return null;
    previousDate = point.date;
    if (point.close < low.close) low = point;
    if (point.close > high.close) high = point;
  }
  const start = points[0];
  const end = points[points.length - 1];
  const change = points.length > 1 ? end.close - start.close : null;
  const returnPercent = points.length > 1 ? (end.close / start.close - 1) * 100 : null;
  return { start, end, change, returnPercent, low: low.close, lowDate: low.date, high: high.close, highDate: high.date, observationCount: points.length };
}
