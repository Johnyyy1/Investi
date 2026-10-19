import { describe, expect, it } from "vitest";
import { aggregateCandles, barChanges, candleInterval, candleLabel, candlePeriod, chartTone, drawdownSpan, formatChartPrice, formatSignedChange, hasCandlestickData, parseChartType, axisDecimals } from "./price-chart-presentation";

const candles = [
  { date: "2026-01-05", open: 100, high: 104, low: 99, close: 103 },
  { date: "2026-01-06", open: 103, high: 105, low: 98, close: 99 },
];
const isoDay = (start: string, offset: number) => new Date(Date.parse(`${start}T00:00:00.000Z`) + offset * 86_400_000).toISOString().slice(0, 10);
const span = (first: string, last: string) => [{ date: first, close: 1 }, { date: last, close: 1 }];

describe("instrument chart presentation", () => {
  it("chooses semantic tones from the selected period return", () => {
    expect(chartTone(3.2)).toBe("positive");
    expect(chartTone(-0.1)).toBe("negative");
    expect(chartTone(0)).toBe("neutral");
    expect(chartTone(null)).toBe("neutral");
  });

  it("reads the chart type from the URL and defaults anything else to the line", () => {
    expect(parseChartType("candles")).toBe("candles");
    expect(parseChartType("line")).toBe("line");
    expect(parseChartType(["candles"])).toBe("line");
    expect(parseChartType(undefined)).toBe("line");
    expect(parseChartType("CANDLES")).toBe("line");
  });

  it("only enables candles for valid OHLC, without inventing missing values", () => {
    expect(hasCandlestickData(candles)).toBe(true);
    expect(hasCandlestickData(candles.map(({ date, close }) => ({ date, close })))).toBe(false);
    expect(hasCandlestickData([candles[0]])).toBe(false);
    expect(hasCandlestickData([{ ...candles[0], low: 104 }, candles[1]])).toBe(false);
    expect(hasCandlestickData([{ ...candles[0], high: 102 }, candles[1]])).toBe(false);
    expect(hasCandlestickData([{ ...candles[0], open: 0, low: 0 }, candles[1]])).toBe(false);
    expect(hasCandlestickData([{ ...candles[0], open: Number.NaN }, candles[1]])).toBe(false);
    // OHLC copied from the close is close-only data in disguise.
    expect(hasCandlestickData(candles.map((point) => ({ ...point, open: point.close, high: point.close, low: point.close })))).toBe(false);
  });

  it("keeps a doji (open equal to close) as a valid candle", () => {
    expect(hasCandlestickData([{ date: "2026-01-05", open: 100, high: 101, low: 99, close: 100 }, candles[1]])).toBe(true);
  });

  it("chooses daily bars up to a year, weekly up to five years and monthly beyond, from the span actually loaded", () => {
    expect(candleInterval([])).toBe("daily");
    expect(candleInterval([{ date: "2026-01-05", close: 1 }])).toBe("daily");
    expect(candleInterval(span("2025-12-05", "2026-01-05"))).toBe("daily");
    expect(candleInterval(span("2025-01-02", "2026-01-16"))).toBe("daily");
    expect(candleInterval(span("2021-01-04", "2026-01-05"))).toBe("weekly");
    expect(candleInterval(span("1993-01-29", "2026-10-16"))).toBe("monthly");
    // A young instrument on the 5L or Max range keeps daily detail instead of a handful of bars.
    expect(candleInterval(span("2025-06-02", "2026-01-05"))).toBe("daily");
  });

  it("aligns weeks to UTC Monday–Sunday and months to calendar months", () => {
    expect(candlePeriod("2026-01-04", "weekly")).toEqual({ start: "2025-12-29", end: "2026-01-04" });
    expect(candlePeriod("2026-01-05", "weekly")).toEqual({ start: "2026-01-05", end: "2026-01-11" });
    expect(candlePeriod("2024-02-29", "monthly")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(candlePeriod("2025-12-31", "monthly")).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(candlePeriod("2026-01-05", "daily")).toEqual({ start: "2026-01-05", end: "2026-01-05" });
  });

  it("aggregates weeks with the first open, the extrema and the last close, never averages", () => {
    const bars = aggregateCandles([
      { date: "2025-12-29", open: 10, high: 12, low: 9, close: 11 },
      { date: "2025-12-31", open: 11, high: 15, low: 10, close: 14 },
      { date: "2026-01-02", open: 14, high: 14, low: 7, close: 8 },
      { date: "2026-01-05", open: 8, high: 9, low: 6, close: 7 },
    ], "weekly");
    expect(bars).toEqual([
      { date: "2025-12-29", periodStart: "2025-12-29", periodEnd: "2026-01-04", firstDate: "2025-12-29", lastDate: "2026-01-02", open: 10, high: 15, low: 7, close: 8, observationCount: 3, partial: false },
      { date: "2026-01-05", periodStart: "2026-01-05", periodEnd: "2026-01-11", firstDate: "2026-01-05", lastDate: "2026-01-05", open: 8, high: 9, low: 6, close: 7, observationCount: 1, partial: false },
    ]);
    for (const bar of bars) {
      expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close));
      expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
    }
  });

  it("aggregates calendar months without synthetic empty bars or forward fills", () => {
    const bars = aggregateCandles([
      { date: "2025-01-02", open: 10, high: 12, low: 9, close: 11 },
      { date: "2025-01-31", open: 11, high: 15, low: 8, close: 14 },
      { date: "2025-03-03", open: 20, high: 21, low: 19, close: 20 },
      { date: "2026-01-05", open: 30, high: 32, low: 29, close: 31 },
    ], "monthly");
    expect(bars.map(({ periodStart }) => periodStart)).toEqual(["2025-01-01", "2025-03-01", "2026-01-01"]);
    expect(bars[0]).toMatchObject({ open: 10, high: 15, low: 8, close: 14, periodEnd: "2025-01-31", firstDate: "2025-01-02", lastDate: "2025-01-31" });
    expect(bars[1]).toMatchObject({ open: 20, high: 21, low: 19, close: 20, periodEnd: "2025-03-31" });
    expect(bars[2]).toMatchObject({ open: 30, high: 32, low: 29, close: 31 });
  });

  it("keeps daily bars one-to-one with the observations", () => {
    expect(aggregateCandles(candles, "daily")).toEqual(candles.map((point) => ({ ...point, periodStart: point.date, periodEnd: point.date, firstDate: point.date, lastDate: point.date, observationCount: 1, partial: false })));
  });

  it("flags the periods the loaded window cuts as partial", () => {
    const daily = Array.from({ length: 30 }, (_, index) => ({ ...candles[index % 2], date: isoDay("2025-12-10", index) }));
    const weekly = aggregateCandles(daily, "weekly", { startDate: "2025-12-10", endDate: "2026-01-08" });
    expect(weekly[0]).toMatchObject({ periodStart: "2025-12-08", firstDate: "2025-12-10", partial: true });
    expect(weekly.slice(1, -1).every((bar) => !bar.partial)).toBe(true);
    expect(weekly.at(-1)).toMatchObject({ periodStart: "2026-01-05", lastDate: "2026-01-08", partial: true });
    // Max starts in 1900, so its first month is complete; the current month is still running.
    const monthly = aggregateCandles(daily, "monthly", { startDate: "1900-01-01", endDate: "2026-01-08" });
    expect(monthly.map((bar) => bar.partial)).toEqual([false, true]);
  });

  it("refuses unordered or duplicated observations instead of silently reordering them", () => {
    expect(aggregateCandles([candles[1], candles[0]], "daily")).toEqual([]);
    expect(aggregateCandles([candles[0], candles[0]], "weekly")).toEqual([]);
  });

  it("covers the full long-range horizon without a recent-tail slice", () => {
    const long = Array.from({ length: 240 }, (_, index) => ({ ...candles[index % 2], date: new Date(Date.UTC(2000, index, 3)).toISOString().slice(0, 10) }));
    const max = aggregateCandles(long, candleInterval(long));
    expect(max).toHaveLength(240);
    expect(max[0].periodStart).toBe("2000-01-01");
    expect(max.at(-1)?.periodEnd).toBe("2019-12-31");
  });

  it("measures each bar's change against the previous close, with none for the first bar", () => {
    const changes = barChanges([{ close: 100 }, { close: 110 }, { close: 99 }]);
    expect(changes[0]).toBeNull();
    expect(changes[1]).toEqual({ change: 10, changePercent: expect.closeTo(10, 10) });
    expect(changes[2]?.change).toBeCloseTo(-11, 10);
    expect(changes[2]?.changePercent).toBeCloseTo(-10, 10);
  });

  it("maps the daily-close drawdown onto the bars that contain its peak and trough", () => {
    const drawdown = { depth: -0.2, peakDate: "2025-12-31", troughDate: "2026-02-04", recoveryDate: null };
    expect(drawdownSpan(drawdown, "line")).toEqual({ from: "2025-12-31", to: "2026-02-04" });
    expect(drawdownSpan(drawdown, "daily")).toEqual({ from: "2025-12-31", to: "2026-02-04" });
    expect(drawdownSpan(drawdown, "weekly")).toEqual({ from: "2025-12-29", to: "2026-02-02" });
    expect(drawdownSpan(drawdown, "monthly")).toEqual({ from: "2025-12-01", to: "2026-02-01" });
    expect(drawdownSpan(null, "weekly")).toBeNull();
  });

  it("keeps cents on the price axis from 10 upwards and the data's precision below", () => {
    expect(axisDecimals([117.789, 120.1234])).toBe(2);
    expect(axisDecimals([9.5, 10.25])).toBe(2);
    expect(axisDecimals([1.3333, 0.25, 0.1])).toBe(4);
    expect(axisDecimals([0.125, 0.5])).toBe(3);
    expect(axisDecimals([0.5, 0.25])).toBe(2);
    expect(axisDecimals([])).toBe(2);
  });

  it("formats prices and changes in Czech with an explicit sign", () => {
    const nbsp = / /g;
    expect(formatChartPrice(1234.5, "USD").replace(nbsp, " ")).toBe("1 234,50 USD");
    expect(formatChartPrice(117.789, "EUR")).toBe("117,789 EUR");
    expect(formatChartPrice(92.66, "USD")).toBe("92,66 USD");
    expect(formatChartPrice(120.8595, "EUR")).toBe("120,8595 EUR");
    expect(formatSignedChange(-0.0012, " USD", 4)).toBe("−0,0012 USD");
    expect(formatSignedChange(21.67, " USD", 4)).toBe("+21,67 USD");
    expect(formatSignedChange(1.2912, "%")).toBe("+1,29 %");
    expect(formatSignedChange(-9.99, " USD")).toBe("−9,99 USD");
    expect(formatSignedChange(0, "%")).toBe("0,00 %");
    expect(formatSignedChange(-33.71, "%", 1)).toBe("−33,7 %");
  });

  it("labels bars by the observations they hold", () => {
    expect(candleLabel({ periodStart: "2026-01-05", firstDate: "2026-01-05", lastDate: "2026-01-05", partial: false }, "daily")).toBe("5. 1. 2026");
    expect(candleLabel({ periodStart: "2026-01-05", firstDate: "2026-01-06", lastDate: "2026-01-09", partial: false }, "weekly")).toBe("Týden · 6. 1. 2026 – 9. 1. 2026");
    expect(candleLabel({ periodStart: "2025-10-01", firstDate: "2025-10-01", lastDate: "2025-10-31", partial: false }, "monthly")).toBe("říjen 2025");
    expect(candleLabel({ periodStart: "2026-01-01", firstDate: "2026-01-02", lastDate: "2026-01-08", partial: true }, "monthly")).toBe("leden 2026 (2. 1. 2026 – 8. 1. 2026)");
  });
});
