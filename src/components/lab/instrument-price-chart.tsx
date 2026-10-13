"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartRanges, type ChartRange } from "@/features/instruments/history";
import { periodStatistics, type PriceObservation } from "@/features/instruments/period-statistics";
import type { PriceMetrics } from "@/features/instruments/price-metrics";
import { aggregateCandles, candleInterval, chartTone, hasCandlestickData, viewportPoints, type Candle, type CandleInterval } from "@/features/instruments/price-chart-presentation";
import { instrumentDetailHref } from "@/features/instruments/routes";
import type { Currency, HistoricalPricePoint } from "@/features/market-data/contracts";

/** Presentation labels for the Pen period selector; the values stay the same as the loaded range. */
const periodOptionLabels: Record<ChartRange, string> = { "1M": "1M", "3M": "3M", "6M": "6M", YTD: "Letos", "1Y": "1R", "5Y": "5L", Max: "Max" };

function price(value: number, currency: Currency) {
  return `${new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)} ${currency}`;
}
function dateLabel(value: string, year = true) {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}
function signed(value: number, suffix: string, maximumDigits = 2) {
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: maximumDigits }).format(value)}${suffix === "%" ? " %" : suffix}`;
}

function candleLabel(candle: Candle, interval: CandleInterval) {
  return interval === "daily" ? dateLabel(candle.periodStart)
    : interval === "weekly" ? `${dateLabel(candle.periodStart)} – ${dateLabel(candle.periodEnd)}`
    : interval === "monthly" ? new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${candle.periodStart}T00:00:00.000Z`))
    : `${dateLabel(candle.periodStart)} – ${dateLabel(candle.periodEnd)}`;
}

function CandlePlot({ points, currency, range, interval }: { points: readonly HistoricalPricePoint[]; currency: Currency; range: ChartRange; interval: CandleInterval }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const shown = aggregateCandles(points, interval);
  const low = Math.min(...shown.map((point) => point.low));
  const high = Math.max(...shown.map((point) => point.high));
  const padding = Math.max((high - low) * 0.08, high * 0.005);
  const bottom = low - padding;
  const top = high + padding;
  const plotLeft = 54;
  const plotRight = width - 8;
  const plotTop = 12;
  const plotBottom = 254;
  const y = (value: number) => plotTop + (top - value) / (top - bottom) * (plotBottom - plotTop);
  const step = (plotRight - plotLeft) / shown.length;
  const bodyWidth = Math.max(2, Math.min(14, step * 0.58));
  const intervalLabel = { daily: "denní", weekly: "týdenní", monthly: "měsíční", quarterly: "čtvrtletní" }[interval];
  return <div ref={container} className="mt-5 min-w-0" data-testid="candlestick-chart">
    <p className="text-microcopy text-secondary">{intervalLabel[0].toUpperCase() + intervalLabel.slice(1)} svíčky · {shown.length} sloupců od {dateLabel(points[0].date)} do {dateLabel(points.at(-1)!.date)}. Zelená znamená zavření na nebo nad otevřením, červená pod ním.</p>
    <svg role="img" aria-label={`${range}, ${intervalLabel}, svíčkový graf cen očištěných o splity v ${currency}. ${shown.length} svíček pokrývá pozorování od ${dateLabel(points[0].date)} do ${dateLabel(points.at(-1)!.date)}. Každá svíčka ukazuje otevření, maximum, minimum a zavření.`} viewBox={`0 0 ${width} 286`} className="mt-2 block h-[286px] w-full overflow-visible" preserveAspectRatio="none">
      {[low, (low + high) / 2, high].map((value, index) => <g key={index}><line x1={plotLeft} x2={plotRight} y1={y(value)} y2={y(value)} stroke="var(--color-border)" strokeDasharray="3 4" /><text x={plotLeft - 7} y={y(value) + 4} textAnchor="end" fill="var(--color-secondary)" fontSize="11">{new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value)}</text></g>)}
      {shown.map((point, index) => {
        const x = plotLeft + (index + .5) * step;
        const up = point.close >= point.open;
        const color = up ? "var(--color-success-ink)" : "var(--color-danger-ink)";
        const bodyTop = y(Math.max(point.open, point.close));
        const bodyHeight = Math.max(2, Math.abs(y(point.open) - y(point.close)));
        return <g key={point.date} data-direction={up ? "up" : "down"}><title>{`${candleLabel(point, interval)}: otevření ${price(point.open, currency)}, maximum ${price(point.high, currency)}, minimum ${price(point.low, currency)}, zavření ${price(point.close, currency)}. ${point.observationCount} pozorování. ${up ? "Rostoucí" : "Klesající"} svíčka.`}</title><line x1={x} x2={x} y1={y(point.high)} y2={y(point.low)} stroke={color} strokeWidth="1.5" /><rect x={x - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} rx="1" fill={color} /></g>;
      })}
      <text x={plotLeft} y="280" fill="var(--color-secondary)" fontSize="11">{dateLabel(points[0].date, false)}</text>
      <text x={plotRight} y="280" textAnchor="end" fill="var(--color-secondary)" fontSize="11">{dateLabel(points.at(-1)!.date, false)}</text>
    </svg>
  </div>;
}

export function InstrumentPriceChart({ instrumentId, range, points, currency, message, partial, metrics }: { instrumentId: string; range: ChartRange; points: PriceObservation[]; currency: Currency; message: string | null; partial: boolean; metrics: PriceMetrics | null }) {
  const [chartType, setChartType] = useState<"line" | "candles">("line");
  const [zoom, setZoom] = useState<{ key: string; start: number; end: number } | null>(null);
  const zoomKey = `${instrumentId}:${range}:${points.length}:${points[0]?.date}:${points.at(-1)?.date}`;
  const lastIndex = points.length - 1;
  const start = zoom?.key === zoomKey ? Math.min(zoom.start, Math.max(0, lastIndex - 1)) : 0;
  const end = zoom?.key === zoomKey ? Math.min(zoom.end, lastIndex) : lastIndex;
  const zoomActive = points.length > 1 && (start > 0 || end < lastIndex);
  const visiblePoints = viewportPoints(points, start, end);
  const visiblePeriod = periodStatistics(visiblePoints);
  const period = periodStatistics(points);
  const candlePoints: readonly HistoricalPricePoint[] | null = hasCandlestickData(points) ? points : null;
  const canShowCandles = candlePoints !== null;
  const showingCandles = canShowCandles && chartType === "candles";
  const interval = candleInterval(range, points);
  const candleExtremes = candlePoints ? { low: Math.min(...candlePoints.map((point) => point.low)), high: Math.max(...candlePoints.map((point) => point.high)) } : null;
  const tone = chartTone(period?.returnPercent);
  const lineColor = tone === "positive" ? "var(--color-success-ink)" : tone === "negative" ? "var(--color-danger-ink)" : "var(--color-primary-hover)";
  const areaColor = tone === "positive" ? "var(--color-success-soft)" : tone === "negative" ? "var(--color-danger-soft)" : "var(--color-primary-soft)";
  const padding = visiblePeriod ? Math.max((visiblePeriod.high - visiblePeriod.low) * 0.12, visiblePeriod.high * 0.015) : 0;
  const axisDomain: [number, number] = visiblePeriod ? [Math.max(0, visiblePeriod.low - padding), visiblePeriod.high + padding] : [0, 1];
  const drawdownBand = metrics?.maxDrawdown ?? null;
  return <section aria-labelledby="price-history-heading" className="min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="price-history-heading" className="text-section-title font-bold">Jak se cena vyvíjela</h2><p className="mt-1 text-small text-secondary">{period ? `${showingCandles ? "Denní svíčky" : "Denní zavírací ceny"} ${dateLabel(period.start.date)} – ${dateLabel(period.end.date)} · v ${currency} · jen cena, bez dividend` : `Denní zavírací ceny · ${currency} · jen cena, bez dividend`}</p></div>
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-2"><div role="group" aria-label="Typ grafu" className="flex max-w-full flex-wrap rounded-control border border-border p-0.5 text-small"><button type="button" aria-pressed={!showingCandles} onClick={() => setChartType("line")} className={`min-h-11 rounded-control px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${!showingCandles ? "bg-surface-muted text-foreground" : "text-secondary hover:text-foreground"}`}>Křivka</button><button type="button" aria-pressed={showingCandles} disabled={!canShowCandles} onClick={() => setChartType("candles")} className={`min-h-11 rounded-control px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${showingCandles ? "bg-surface-muted text-foreground" : "text-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"}`}>Svíčky</button></div>
      <nav aria-label="Období vývoje ceny" className="flex min-w-0 max-w-full flex-wrap gap-1 text-small">
        {chartRanges.map((option) => <Link key={option} href={`${instrumentDetailHref(instrumentId)}?range=${option}`} aria-current={range === option ? "page" : undefined} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-2.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${range === option ? "bg-surface text-foreground shadow-elevation-1" : "text-secondary hover:bg-surface hover:text-foreground"}`}>{periodOptionLabels[option]}</Link>)}
      </nav></div>
    </div>
    {period ? <>
      <div className="mt-6 grid gap-x-8 gap-y-3 border-y border-border py-4 text-small sm:grid-cols-2">
        <p><span className="text-secondary">Začátek · {dateLabel(period.start.date)}</span><strong className="ml-2 inline-block font-bold tabular-nums">{price(period.start.close, currency)}</strong></p>
        <p className="sm:text-right"><span className="text-secondary">Konec · {dateLabel(period.end.date)}</span><strong className="ml-2 inline-block font-bold tabular-nums">{price(period.end.close, currency)}</strong></p>
      </div>
      {showingCandles ? <CandlePlot points={visiblePoints as readonly HistoricalPricePoint[]} currency={currency} range={range} interval={interval} /> : <div role="img" data-chart-tone={tone} aria-label={`${range}, denní graf závěrečných cen očištěných o splity v ${currency}. Zobrazený rozsah ${visiblePoints.length} z ${period.observationCount} pozorování od ${dateLabel(visiblePoints[0].date)} do ${dateLabel(visiblePoints.at(-1)!.date)}. První cena období ${price(period.start.close, currency)}; poslední ${price(period.end.close, currency)}. Minimum období ${price(period.low, currency)}; maximum období ${price(period.high, currency)}.`} className="mt-5 h-60 min-w-0 max-w-full overflow-hidden sm:h-72 lg:h-80">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}><AreaChart data={visiblePoints} accessibilityLayer margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" />
          <XAxis dataKey="date" tickFormatter={(value: string) => dateLabel(value, false)} minTickGap={48} interval="preserveStartEnd" tickLine={false} axisLine={false} tick={{ fill: "var(--color-secondary)", fontSize: 11 }} />
          <YAxis domain={axisDomain} width={66} tickCount={5} tickLine={false} axisLine={false} tick={{ fill: "var(--color-secondary)", fontSize: 11 }} tickFormatter={(value: number) => new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value)} />
          <Tooltip labelFormatter={(value) => dateLabel(String(value))} formatter={(value) => [price(Number(value), currency), "Zavření"]} contentStyle={{ border: "1px solid var(--color-border)", borderRadius: "0.75rem", background: "var(--color-surface)", color: "var(--color-foreground)" }} />
          {drawdownBand && !zoomActive ? <ReferenceArea x1={drawdownBand.peakDate} x2={drawdownBand.troughDate} fill="var(--color-butter-tint)" fillOpacity={0.7} stroke="none" ifOverflow="extendDomain" /> : null}
          <ReferenceLine y={visiblePeriod!.start.close} stroke="var(--color-control-outline)" strokeDasharray="4 4" ifOverflow="extendDomain" />
          <Area type="linear" dataKey="close" stroke={lineColor} strokeWidth={2.5} fill={areaColor} fillOpacity={0.65} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <ReferenceDot x={visiblePeriod!.end.date} y={visiblePeriod!.end.close} r={4} fill={lineColor} stroke="var(--color-surface)" strokeWidth={2} ifOverflow="visible" />
        </AreaChart></ResponsiveContainer>
      </div>}
      <p className="mt-4 flex gap-2 text-small leading-relaxed text-secondary"><span aria-hidden="true" className="mt-1.5 inline-block size-2.5 shrink-0 rounded-sm bg-butter" /><span>Graf ukazuje jen minulou cenu. Dividendy v něm nejsou, a výsledky v korunách se proto mohou lišit.{drawdownBand && !zoomActive ? ` Žlutý pruh označuje největší propad období (${dateLabel(drawdownBand.peakDate)} – ${dateLabel(drawdownBand.troughDate)}).` : ""}</span></p>
      {points.length > 2 ? <div className="mt-3 text-small">
        {zoomActive ? <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-secondary"><span>Zobrazený rozsah {dateLabel(visiblePoints[0].date)} – {dateLabel(visiblePoints.at(-1)!.date)} v rámci {range}</span><button type="button" onClick={() => setZoom(null)} className="min-h-11 font-semibold text-primary-hover underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary">Obnovit rozsah</button></div> : null}
        <details className="max-w-xl"><summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary-hover focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary">Přiblížit graf</summary>
          <p className="mb-2 text-microcopy text-secondary">Posunutím počátečního a koncového táhla prozkoumej vybrané datumy. Statistiky období {range} níže zůstávají stejné.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1 text-secondary">Začátek rozsahu · {dateLabel(points[start].date)}<input type="range" aria-label="Začátek rozsahu" aria-valuetext={dateLabel(points[start].date)} min={0} max={lastIndex - 1} value={start} onChange={(event) => setZoom({ key: zoomKey, start: Math.min(Number(event.target.value), end - 1), end })} className="h-11 w-full accent-primary" /></label>
            <label className="grid min-w-0 gap-1 text-secondary">Konec rozsahu · {dateLabel(points[end].date)}<input type="range" aria-label="Konec rozsahu" aria-valuetext={dateLabel(points[end].date)} min={1} max={lastIndex} value={end} onChange={(event) => setZoom({ key: zoomKey, start, end: Math.max(Number(event.target.value), start + 1) })} className="h-11 w-full accent-primary" /></label>
          </div>
        </details>
      </div> : null}
      <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-x-5 gap-y-4 border-t border-border pt-5 text-small">
        <div><dt className="text-secondary">Cenový výnos za zobrazené období</dt><dd className={`mt-1 font-bold tabular-nums ${period.returnPercent !== null && period.returnPercent > 0 ? "text-success-ink" : period.returnPercent !== null && period.returnPercent < 0 ? "text-danger-ink" : ""}`}>{period.returnPercent === null ? "Nedostupné" : signed(period.returnPercent, "%")}</dd></div>
        <div><dt className="text-secondary">Změna ceny</dt><dd className="mt-1 font-bold tabular-nums">{period.change === null ? "Nedostupné" : signed(period.change, ` ${currency}`, 4)}</dd></div>
        <div><dt className="text-secondary">Minimum období</dt><dd className="mt-1 font-bold tabular-nums">{price(showingCandles ? candleExtremes!.low : period.low, currency)}</dd></div>
        <div><dt className="text-secondary">Maximum období</dt><dd className="mt-1 font-bold tabular-nums">{price(showingCandles ? candleExtremes!.high : period.high, currency)}</dd></div>
      </dl>
      {period.observationCount === 1 || partial ? <p className="mt-4 text-microcopy text-secondary">{period.observationCount === 1 ? "Je dostupná jen jedna závěrečná cena; výnos za období nelze vypočítat." : "Pouze dostupná pozorování; chybějící dny nejsou doplněny."}</p> : null}
      <details className="mt-3 text-small"><summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary-hover">Zobrazit cenová data</summary><div className="relative max-h-72 overflow-auto" tabIndex={0} aria-label=" Denní cenová data"><table className="w-full text-left tabular-nums"><caption className="sr-only">Každodenní očištěné ceny v {currency}</caption><thead><tr><th scope="col" className="py-2">Datum</th>{showingCandles ? <><th scope="col" className="px-2 py-2 text-right">Otevření</th><th scope="col" className="px-2 py-2 text-right">Maximum</th><th scope="col" className="px-2 py-2 text-right">Minimum</th></> : null}<th scope="col" className="py-2 text-right">Zavření</th></tr></thead><tbody>{points.map((point) => <tr key={point.date} className="border-t border-border"><th scope="row" className="py-2 font-normal">{dateLabel(point.date)}</th>{showingCandles ? <><td className="px-2 py-2 text-right">{price((point as HistoricalPricePoint).open, currency)}</td><td className="px-2 py-2 text-right">{price((point as HistoricalPricePoint).high, currency)}</td><td className="px-2 py-2 text-right">{price((point as HistoricalPricePoint).low, currency)}</td></> : null}<td className="py-2 text-right">{price(point.close, currency)}</td></tr>)}</tbody></table></div></details>
    </> : <div role="status" className="flex min-h-52 items-center justify-center px-4 text-center text-small text-secondary">{message ?? "Vývoj ceny pro toto období není dostupný."}</div>}
  </section>;
}
