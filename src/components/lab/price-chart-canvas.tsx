"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AreaSeries, CandlestickSeries, ColorType, createChart, CrosshairMode, LineStyle, TickMarkType, type IChartApi, type IPriceLine, type ISeriesApi, type LogicalRange, type MouseEventParams, type Time, type UTCTimestamp } from "lightweight-charts";
import { DrawdownBand } from "@/components/lab/drawdown-band";
import { formatChartDate, formatChartNumber, formatChartPrice, formatSignedChange, type BarChange, type ChartType } from "@/features/instruments/price-chart-presentation";
import type { Currency } from "@/features/market-data/contracts";

export type ChartBar = {
  /** Calendar date of the bar's position on the time axis. */
  time: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  /** Full label for the readout, for example a week's first and last observation. */
  label: string;
  /** Short label for the crosshair's time-axis tag. */
  axisLabel: string;
  change: BarChange;
};

type Props = {
  type: ChartType;
  bars: readonly ChartBar[];
  /** Changes when the loaded instrument or range changes; the viewport then fits the new data. */
  datasetKey: string;
  currency: Currency;
  /** Price-axis precision. */
  decimals: number;
  baseline: number | null;
  /** The largest drawdown, as bar dates plus its band label. */
  band: { from: string; to: string; label: string } | null;
  ariaLabel: string;
  tone: string;
};

const timestamp = (date: string) => Date.parse(`${date}T00:00:00.000Z`) / 1000 as UTCTimestamp;
const shortMonth = new Intl.DateTimeFormat("cs-CZ", { month: "short", timeZone: "UTC" });

function tickMark(time: Time, type: TickMarkType) {
  const date = new Date(Number(time) * 1000);
  if (type === TickMarkType.Year) return String(date.getUTCFullYear());
  if (type === TickMarkType.Month) return shortMonth.format(date);
  if (type === TickMarkType.DayOfMonth) return `${date.getUTCDate()}. ${date.getUTCMonth() + 1}.`;
  return null;
}

function alpha(color: string, opacity: number) {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${opacity})`;
}

type Palette = Record<"up" | "down" | "text" | "ink" | "grid" | "surface" | "bandFill" | "bandEdge" | "bandText", string>;

function readPalette(element: HTMLElement): Palette {
  const css = getComputedStyle(element);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return {
    up: token("--color-primary"),
    down: token("--color-danger"),
    text: token("--color-secondary"),
    ink: token("--color-foreground"),
    grid: alpha(token("--color-border"), 0.55),
    surface: token("--color-surface"),
    bandFill: alpha(token("--color-warning"), 0.16),
    bandEdge: alpha(token("--color-warning-border"), 0.9),
    bandText: token("--color-warning-ink"),
  };
}

type ReadoutState = { bars: readonly ChartBar[]; type: ChartType; currency: Currency; decimals: number };

/** Writes a bar into the readout's text nodes directly; hover must not re-render React. */
function writeReadout(root: HTMLElement | null, { bars, type, currency, decimals }: ReadoutState, index: number, hovered: boolean) {
  const bar = bars[index];
  if (!root || !bar) return;
  const set = (field: string, text: string) => {
    const element = root.querySelector(`[data-field="${field}"]`);
    if (element && element.textContent !== text) element.textContent = text;
  };
  set("close", formatChartPrice(bar.close, currency));
  set("change", changeText(bar.change, currency, decimals));
  root.querySelector('[data-field="change"]')?.setAttribute("data-tone", changeTone(bar.change));
  set("date", hovered ? bar.label : `${bar.label} · ${type === "candles" ? "poslední svíčka" : "poslední zavření"}`);
  if (type === "candles" && bar.open !== undefined && bar.high !== undefined && bar.low !== undefined) {
    set("open", formatChartNumber(bar.open));
    set("high", formatChartNumber(bar.high));
    set("low", formatChartNumber(bar.low));
  }
}
function changeText(change: BarChange, currency: Currency, decimals: number) {
  return change ? `${formatSignedChange(change.change, ` ${currency}`, decimals)} (${formatSignedChange(change.changePercent, "%")})` : "—";
}
function changeTone(change: BarChange) {
  return !change || change.change === 0 ? "neutral" : change.change > 0 ? "positive" : "negative";
}

/**
 * TradingView Lightweight Charts™ canvas for one instrument. The chart instance lives for
 * the component's lifetime; range and type changes swap series data instead of rebuilding it.
 * Hover updates the readout through refs, so pointer movement never re-renders React.
 */
export function PriceChartCanvas({ type, bars, datasetKey, currency, decimals, baseline, band, ariaLabel, tone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<{ type: ChartType; api: ISeriesApi<"Area"> | ISeriesApi<"Candlestick"> } | null>(null);
  const bandRef = useRef<DrawdownBand | null>(null);
  const baselineRef = useRef<IPriceLine | null>(null);
  const paletteRef = useRef<Palette | null>(null);
  const stateRef = useRef({ bars, type, currency, decimals, indexByTime: new Map<number, number>(), datasetKey: "", zoomed: false, active: null as number | null });
  const readoutRef = useRef<HTMLDivElement>(null);
  const visibleRangeRef = useRef<HTMLSpanElement>(null);
  const announceRef = useRef<HTMLParagraphElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const keysId = useId();

  const showBar = (index: number, hovered: boolean) => writeReadout(readoutRef.current, stateRef.current, index, hovered);

  // Create the chart once. Colours and font come from the design tokens, because the canvas cannot read CSS variables.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const palette = readPalette(container);
    paletteRef.current = palette;
    const fontFamily = getComputedStyle(container).fontFamily;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const crosshairLine = { color: alpha(palette.ink, 0.45), width: 1 as const, style: LineStyle.Dashed, labelBackgroundColor: palette.ink };
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: palette.text, fontFamily, fontSize: 11, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: palette.grid } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.14, bottom: 0.06 } },
      timeScale: { borderColor: palette.grid, fixLeftEdge: true, fixRightEdge: true, lockVisibleTimeRangeOnResize: true, rightOffset: 0, minBarSpacing: 0.5, tickMarkFormatter: tickMark },
      crosshair: { mode: CrosshairMode.Normal, vertLine: crosshairLine, horzLine: crosshairLine },
      localization: {
        locale: "cs-CZ",
        priceFormatter: (price: number) => formatChartNumber(price, stateRef.current.decimals),
        timeFormatter: (time: Time) => {
          const { bars: current, indexByTime } = stateRef.current;
          return current[indexByTime.get(Number(time)) ?? -1]?.axisLabel ?? formatChartDate(new Date(Number(time) * 1000).toISOString().slice(0, 10));
        },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: { time: true, price: true } },
      kineticScroll: { touch: !reducedMotion, mouse: false },
    });
    chartRef.current = chart;
    bandRef.current = new DrawdownBand({ fill: palette.bandFill, edge: palette.bandEdge, text: palette.bandText, labelBackground: alpha(palette.surface, 0.92), font: `600 11px ${fontFamily}` });

    const onCrosshairMove = (param: MouseEventParams<Time>) => {
      const { bars: current, indexByTime } = stateRef.current;
      const index = param.point && param.time !== undefined ? indexByTime.get(Number(param.time)) : undefined;
      showBar(index ?? current.length - 1, index !== undefined);
    };
    const onRangeChange = (range: LogicalRange | null) => {
      const series = seriesRef.current?.api;
      const info = range && series ? series.barsInLogicalRange(range) : null;
      const isZoomed = info !== null && (info.barsBefore > 0.5 || info.barsAfter > 0.5);
      stateRef.current.zoomed = isZoomed;
      setZoomed(isZoomed);
      if (isZoomed && info?.from !== undefined && info.to !== undefined && visibleRangeRef.current) {
        visibleRangeRef.current.textContent = `${formatChartDate(new Date(Number(info.from) * 1000).toISOString().slice(0, 10))} – ${formatChartDate(new Date(Number(info.to) * 1000).toISOString().slice(0, 10))}`;
      }
    };
    const fit = () => { chart.timeScale().fitContent(); chart.priceScale("right").applyOptions({ autoScale: true }); };
    chart.subscribeCrosshairMove(onCrosshairMove);
    chart.subscribeDblClick(fit);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);
    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.unsubscribeDblClick(fit);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      bandRef.current = null;
      baselineRef.current = null;
    };
  }, []);

  // Feed data. A type switch replaces the series (the two use different bars); a zoomed
  // viewport over the same range is kept by time, a new range fits its whole horizon.
  useEffect(() => {
    const chart = chartRef.current;
    const palette = paletteRef.current;
    if (!chart || !palette) return;
    const state = stateRef.current;
    const keep = state.zoomed && state.datasetKey === datasetKey ? chart.timeScale().getVisibleRange() : null;
    Object.assign(state, { bars, type, currency, decimals, datasetKey, indexByTime: new Map(bars.map((bar, index) => [timestamp(bar.time), index])) });
    const priceFormat = { type: "price" as const, precision: decimals, minMove: 1 / 10 ** decimals };
    let series = seriesRef.current;
    if (series && series.type !== type) {
      chart.removeSeries(series.api);
      baselineRef.current = null;
      series = null;
    }
    if (!series) {
      const api = type === "line"
        ? chart.addSeries(AreaSeries, { lineColor: palette.up, lineWidth: 2, topColor: alpha(palette.up, 0.18), bottomColor: alpha(palette.up, 0.01), crosshairMarkerRadius: 4, crosshairMarkerBorderColor: palette.surface, crosshairMarkerBorderWidth: 2, priceLineColor: alpha(palette.up, 0.6), priceLineStyle: LineStyle.Dotted, priceFormat })
        : chart.addSeries(CandlestickSeries, { upColor: palette.up, downColor: palette.down, borderUpColor: palette.up, borderDownColor: palette.down, wickUpColor: palette.up, wickDownColor: palette.down, priceLineStyle: LineStyle.Dotted, priceFormat });
      if (bandRef.current) api.attachPrimitive(bandRef.current);
      series = seriesRef.current = { type, api };
    } else {
      series.api.applyOptions({ priceFormat });
    }
    if (series.type === "line") {
      (series.api as ISeriesApi<"Area">).setData(bars.map((bar) => ({ time: timestamp(bar.time), value: bar.close })));
    } else {
      (series.api as ISeriesApi<"Candlestick">).setData(bars.map((bar) => ({ time: timestamp(bar.time), open: bar.open!, high: bar.high!, low: bar.low!, close: bar.close })));
    }
    if (baselineRef.current) series.api.removePriceLine(baselineRef.current);
    baselineRef.current = baseline === null ? null : series.api.createPriceLine({ price: baseline, color: alpha(palette.ink, 0.35), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
    bandRef.current?.setSpan(band ? { from: timestamp(band.from), to: timestamp(band.to), label: band.label } : null);
    if (keep) chart.timeScale().setVisibleRange(keep);
    else {
      chart.timeScale().fitContent();
      chart.priceScale("right").applyOptions({ autoScale: true });
    }
    state.active = null;
    showBar(bars.length - 1, false);
  }, [type, bars, datasetKey, currency, decimals, baseline, band]);

  const reset = () => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.timeScale().fitContent();
    chart.priceScale("right").applyOptions({ autoScale: true });
  };

  /** Keyboard access: arrows step the crosshair bar by bar, + and − zoom, 0 resets. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const chart = chartRef.current;
    const series = seriesRef.current?.api;
    const state = stateRef.current;
    if (!chart || !series || !state.bars.length) return;
    const last = state.bars.length - 1;
    const timeScale = chart.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      if (!range) return;
      event.preventDefault();
      const center = state.active ?? (range.from + range.to) / 2;
      const factor = event.key === "-" ? 1.25 : 0.8;
      const half = Math.max(2, (range.to - range.from) * factor / 2);
      timeScale.setVisibleLogicalRange({ from: center - half, to: center + half });
      return;
    }
    if (event.key === "0" || event.key === "Escape") {
      if (event.key === "0") { event.preventDefault(); reset(); }
      chart.clearCrosshairPosition();
      state.active = null;
      showBar(last, false);
      return;
    }
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!step && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? last : Math.min(last, Math.max(0, (state.active ?? last) + step));
    state.active = index;
    if (range && (index < range.from || index > range.to)) {
      const width = range.to - range.from;
      const from = index < range.from ? index - 1 : index - width + 1;
      timeScale.setVisibleLogicalRange({ from, to: from + width });
    }
    const bar = state.bars[index];
    chart.setCrosshairPosition(bar.close, timestamp(bar.time), series);
    showBar(index, true);
    if (announceRef.current) announceRef.current.textContent = `${bar.label}: ${state.type === "candles" && bar.open !== undefined ? `otevření ${formatChartNumber(bar.open)}, maximum ${formatChartNumber(bar.high!)}, minimum ${formatChartNumber(bar.low!)}, ` : ""}zavření ${formatChartPrice(bar.close, state.currency)}${bar.change ? `, změna ${formatSignedChange(bar.change.changePercent, "%")}` : ""}`;
  };
  const onBlur = () => {
    chartRef.current?.clearCrosshairPosition();
    stateRef.current.active = null;
    showBar(stateRef.current.bars.length - 1, false);
  };

  const latest = bars[bars.length - 1];
  const ohlcItem = "flex items-baseline gap-1.5";
  return <div className="min-w-0">
    <div ref={readoutRef} className="flex min-h-14 flex-wrap items-baseline gap-x-3 gap-y-1" data-testid="chart-readout">
      <span data-field="close" className="font-display text-card-title font-bold tabular-nums">{formatChartPrice(latest.close, currency)}</span>
      <span data-field="change" data-tone={changeTone(latest.change)} className="text-small font-semibold tabular-nums data-[tone=negative]:text-danger-ink data-[tone=positive]:text-success-ink">{changeText(latest.change, currency, decimals)}</span>
      <span data-field="date" className="text-microcopy text-secondary">{`${latest.label} · ${type === "candles" ? "poslední svíčka" : "poslední zavření"}`}</span>
      {type === "candles" && latest.open !== undefined ? <dl className="flex basis-full flex-wrap gap-x-4 gap-y-0.5 text-microcopy tabular-nums">
        <div className={ohlcItem}><dt className="text-secondary">Otevření</dt><dd data-field="open" className="font-semibold">{formatChartNumber(latest.open)}</dd></div>
        <div className={ohlcItem}><dt className="text-secondary">Maximum</dt><dd data-field="high" className="font-semibold">{formatChartNumber(latest.high!)}</dd></div>
        <div className={ohlcItem}><dt className="text-secondary">Minimum</dt><dd data-field="low" className="font-semibold">{formatChartNumber(latest.low!)}</dd></div>
      </dl> : null}
    </div>
    <div
      role="group"
      aria-label="Interaktivní cenový graf"
      aria-describedby={keysId}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      className="relative mt-2 rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      <div ref={containerRef} role="img" aria-label={ariaLabel} data-chart-tone={tone} data-chart-type={type} className="h-[18.5rem] w-full min-w-0 touch-pan-y select-none sm:h-[22rem] lg:h-[25rem]" />
    </div>
    <p id={keysId} className="sr-only">Šipkami vlevo a vpravo procházíš jednotlivé {type === "candles" ? "svíčky" : "dny"}, klávesy plus a minus graf přibližují, nula vrací celé období.</p>
    <p ref={announceRef} aria-live="polite" className="sr-only" />
    <div className="mt-1 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-microcopy text-secondary">
      {/* Both stay mounted so the imperatively written visible range is ready the moment zoom starts. */}
      <p hidden={!zoomed} className="flex-wrap items-center gap-x-3 [&:not([hidden])]:flex">Zobrazeno <span ref={visibleRangeRef} className="tabular-nums" /><button type="button" onClick={reset} className="inline-flex min-h-11 items-center font-semibold text-primary-hover underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary">Obnovit rozsah</button></p>
      <p hidden={zoomed} className="max-sm:hidden">Táhnutím posuneš, kolečkem nebo sevřením přiblížíš, dvojklikem vrátíš celé období.</p>
      <p className="ml-auto">Graf: <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">TradingView Lightweight Charts™</a></p>
    </div>
  </div>;
}
