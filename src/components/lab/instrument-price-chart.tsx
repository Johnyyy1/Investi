"use client";

import { AppLink as Link } from "@/components/shell/app-link";
import { useId, useMemo, useState } from "react";
import { PriceChartCanvas, type ChartBar } from "@/components/lab/price-chart-canvas";
import { chartRanges, type ChartRange } from "@/features/instruments/history";
import { periodStatistics, type PriceObservation } from "@/features/instruments/period-statistics";
import type { PriceMetrics } from "@/features/instruments/price-metrics";
import { aggregateCandles, barChanges, candleInterval, candleIntervalLabels, candleLabel, chartTone, drawdownSpan, formatChartDate, formatChartPrice, formatSignedChange, hasCandlestickData, axisDecimals, type CandleInterval, type ChartType } from "@/features/instruments/price-chart-presentation";
import { instrumentDetailHref } from "@/features/instruments/routes";
import type { Currency, HistoricalPricePoint } from "@/features/market-data/contracts";

/** Presentation labels for the Pen period selector; the values stay the same as the loaded range. */
const periodOptionLabels: Record<ChartRange, string> = { "1M": "1M", "3M": "3M", "6M": "6M", YTD: "Letos", "1Y": "1R", "5Y": "5L", Max: "Max" };
const monthLabel = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric", timeZone: "UTC" });

function axisLabel(date: string, interval: CandleInterval) {
  if (interval === "daily") return formatChartDate(date);
  if (interval === "weekly") return `týden od ${formatChartDate(date)}`;
  return monthLabel.format(new Date(`${date}T00:00:00.000Z`));
}

function chartHref(instrumentId: string, range: ChartRange, type: ChartType) {
  return `${instrumentDetailHref(instrumentId)}?range=${range}${type === "candles" ? "&chart=candles" : ""}`;
}

export function InstrumentPriceChart({ instrumentId, range, points, currency, message, partial, metrics, initialChartType = "line", historyWindow }: {
  instrumentId: string;
  range: ChartRange;
  points: PriceObservation[];
  currency: Currency;
  message: string | null;
  partial: boolean;
  metrics: PriceMetrics | null;
  initialChartType?: ChartType;
  /** The requested date window; aggregated bars it cuts are labelled as partial. */
  historyWindow?: { startDate: string; endDate: string };
}) {
  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const [tableOpen, setTableOpen] = useState(false);
  const candleHelpId = useId();
  const period = periodStatistics(points);
  const canShowCandles = hasCandlestickData(points);
  const showingCandles = canShowCandles && chartType === "candles";
  const interval = candleInterval(points);
  const intervalCopy = candleIntervalLabels[interval];
  const tone = chartTone(period?.returnPercent);
  const largestDrop = metrics?.maxDrawdown ?? null;
  const startDate = historyWindow?.startDate;
  const endDate = historyWindow?.endDate;

  const candles = useMemo(() => canShowCandles ? aggregateCandles(points as readonly HistoricalPricePoint[], interval, startDate && endDate ? { startDate, endDate } : undefined) : [], [points, interval, canShowCandles, startDate, endDate]);
  const decimals = useMemo(() => axisDecimals(points.flatMap((point) => {
    const { open, high, low } = point as Partial<HistoricalPricePoint>;
    return [open, high, low, point.close].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  })), [points]);
  const bars = useMemo<ChartBar[]>(() => {
    if (showingCandles) {
      const changes = barChanges(candles);
      return candles.map((candle, index) => ({ time: candle.periodStart, open: candle.open, high: candle.high, low: candle.low, close: candle.close, label: candleLabel(candle, interval), axisLabel: axisLabel(candle.periodStart, interval), change: changes[index] }));
    }
    const changes = barChanges(points);
    return points.map((point, index) => ({ time: point.date, close: point.close, label: formatChartDate(point.date), axisLabel: formatChartDate(point.date), change: changes[index] }));
  }, [showingCandles, candles, points, interval]);
  const band = useMemo(() => {
    const span = drawdownSpan(largestDrop, showingCandles ? interval : "line");
    return span && largestDrop ? { ...span, label: `Největší propad ${formatSignedChange(largestDrop.depth * 100, "%", 1)}` } : null;
  }, [largestDrop, showingCandles, interval]);

  const selectType = (type: ChartType) => {
    setChartType(type);
    // Keep the choice in the URL without a server round trip; range links carry it too.
    const url = new URL(window.location.href);
    if (type === "candles") url.searchParams.set("chart", "candles");
    else url.searchParams.delete("chart");
    window.history.replaceState(null, "", url);
  };

  const first = points[0];
  const last = points.at(-1);
  const extremes = showingCandles && candles.length ? { low: Math.min(...candles.map((bar) => bar.low)), high: Math.max(...candles.map((bar) => bar.high)) } : period ? { low: period.low, high: period.high } : null;
  const ariaLabel = !period || !first || !last ? ""
    : showingCandles
      ? `${range}, ${intervalCopy.adjective}, svíčkový graf cen očištěných o splity v ${currency}. ${candles.length} svíček pokrývá pozorování od ${formatChartDate(first.date)} do ${formatChartDate(last.date)}. Každá svíčka ukazuje otevření, maximum, minimum a zavření.`
      : `${range}, denní graf závěrečných cen očištěných o splity v ${currency}. ${period.observationCount} pozorování od ${formatChartDate(first.date)} do ${formatChartDate(last.date)}. První cena období ${formatChartPrice(period.start.close, currency)}; poslední ${formatChartPrice(period.end.close, currency)}. Minimum období ${formatChartPrice(period.low, currency)}; maximum období ${formatChartPrice(period.high, currency)}.`;
  const datasetKey = `${instrumentId}:${range}:${points.length}:${first?.date}:${last?.date}`;
  const toggleClass = (active: boolean) => `min-h-11 rounded-control px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? "bg-surface text-foreground shadow-elevation-1" : "text-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"}`;

  return <section aria-labelledby="price-history-heading" className="min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h2 id="price-history-heading" className="text-section-title font-bold">Jak se cena vyvíjela</h2>
        <p className="mt-1 text-small text-secondary">{period ? `${showingCandles ? intervalCopy.bars : "Denní zavírací ceny"} · ${formatChartDate(period.start.date)} – ${formatChartDate(period.end.date)} · v ${currency} · jen cena, bez dividend` : `Denní zavírací ceny · ${currency} · jen cena, bez dividend`}</p>
      </div>
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2">
        <div role="group" aria-label="Typ grafu" className="flex max-w-full flex-wrap rounded-control bg-surface-muted p-0.5 text-small">
          <button type="button" aria-pressed={!showingCandles} onClick={() => selectType("line")} className={toggleClass(!showingCandles)}>Křivka</button>
          <button type="button" aria-pressed={showingCandles} disabled={!canShowCandles} aria-describedby={!canShowCandles && period ? candleHelpId : undefined} onClick={() => selectType("candles")} className={toggleClass(showingCandles)}>Svíčky</button>
        </div>
        <nav aria-label="Období vývoje ceny" className="flex min-w-0 max-w-full flex-wrap gap-0.5 text-small">
          {chartRanges.map((option) => <Link key={option} href={chartHref(instrumentId, option, showingCandles ? "candles" : "line")} aria-current={range === option ? "page" : undefined} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-2.5 font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${range === option ? "bg-surface text-foreground shadow-elevation-1" : "text-secondary hover:bg-surface hover:text-foreground"}`}>{periodOptionLabels[option]}</Link>)}
        </nav>
      </div>
    </div>
    {period && first && last ? <>
      {!canShowCandles ? <p id={candleHelpId} className="mt-2 text-microcopy text-secondary">Svíčky nejsou k dispozici: zdroj pro toto období nemá úplné ceny otevření, maxima a minima. Ukazujeme proto jen zavírací ceny.</p> : null}
      <div className="mt-5"><PriceChartCanvas type={showingCandles ? "candles" : "line"} bars={bars} datasetKey={datasetKey} currency={currency} decimals={decimals} baseline={points.length > 1 ? period.start.close : null} band={band} ariaLabel={ariaLabel} tone={tone} /></div>
      <p className="mt-3 flex gap-2 text-small leading-relaxed text-secondary">
        <span aria-hidden="true" className="mt-1.5 inline-block size-2.5 shrink-0 rounded-sm bg-warning" />
        <span>
          Graf ukazuje jen cenu očištěnou o splity. Dividendy v něm nejsou, takže celkový výnos držitele mohl být vyšší.
          {largestDrop ? ` Žlutý pruh označuje největší propad období podle zavíracích cen: z vrcholu ${formatChartDate(largestDrop.peakDate)} na dno ${formatChartDate(largestDrop.troughDate)}, ${formatSignedChange(largestDrop.depth * 100, "%", 1)}. ${largestDrop.recoveryDate ? `Na vrchol se cena vrátila ${formatChartDate(largestDrop.recoveryDate)}.` : "Do konce období se na vrchol nevrátila."}${showingCandles && interval !== "daily" ? ` Ve svíčkách pruh pokrývá ${interval === "weekly" ? "týdny" : "měsíce"}, které tyto dny obsahují.` : ""}` : ""}
        </span>
      </p>
      <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-x-5 gap-y-4 border-t border-border pt-5 text-small">
        <div><dt className="text-secondary">Začátek · {formatChartDate(period.start.date)}</dt><dd className="mt-1 font-bold tabular-nums">{formatChartPrice(period.start.close, currency)}</dd></div>
        <div><dt className="text-secondary">Konec · {formatChartDate(period.end.date)}</dt><dd className="mt-1 font-bold tabular-nums">{formatChartPrice(period.end.close, currency)}</dd></div>
        <div><dt className="text-secondary">Cenový výnos za zobrazené období</dt><dd className={`mt-1 font-bold tabular-nums ${tone === "positive" ? "text-success-ink" : tone === "negative" ? "text-danger-ink" : ""}`}>{period.returnPercent === null ? "Nedostupné" : formatSignedChange(period.returnPercent, "%")}</dd></div>
        <div><dt className="text-secondary">Změna ceny</dt><dd className="mt-1 font-bold tabular-nums">{period.change === null ? "Nedostupné" : formatSignedChange(period.change, ` ${currency}`, decimals)}</dd></div>
        <div><dt className="text-secondary">Minimum období</dt><dd className="mt-1 font-bold tabular-nums">{formatChartPrice(extremes!.low, currency)}</dd></div>
        <div><dt className="text-secondary">Maximum období</dt><dd className="mt-1 font-bold tabular-nums">{formatChartPrice(extremes!.high, currency)}</dd></div>
      </dl>
      {showingCandles ? <p className="mt-3 text-microcopy text-secondary">Minimum a maximum ve svíčkách počítáme z denních minim a maxim, ne jen ze zavíracích cen.</p> : null}
      {period.observationCount === 1 || partial ? <p className="mt-3 text-microcopy text-secondary">{period.observationCount === 1 ? "Je dostupná jen jedna závěrečná cena; výnos za období nelze vypočítat." : "Pouze dostupná pozorování; chybějící dny nejsou doplněny."}</p> : null}
      <details className="mt-3 text-small" onToggle={(event) => setTableOpen(event.currentTarget.open)}>
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary-hover focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary">Zobrazit cenová data</summary>
        {/* Rendered on demand: Max can hold thousands of rows. */}
        {tableOpen ? <div className="relative max-h-72 overflow-auto" tabIndex={0} aria-label={showingCandles ? `${intervalCopy.bars} jako tabulka` : "Denní cenová data"}>
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">{showingCandles ? `${intervalCopy.bars} cen očištěných o splity v ${currency}` : `Denní zavírací ceny očištěné o splity v ${currency}`}</caption>
            <thead><tr><th scope="col" className="py-2">{showingCandles && interval !== "daily" ? "Období" : "Datum"}</th>{showingCandles ? <><th scope="col" className="px-2 py-2 text-right">Otevření</th><th scope="col" className="px-2 py-2 text-right">Maximum</th><th scope="col" className="px-2 py-2 text-right">Minimum</th></> : null}<th scope="col" className="py-2 text-right">Zavření</th></tr></thead>
            <tbody>{showingCandles
              ? candles.map((candle) => <tr key={candle.periodStart} className="border-t border-border"><th scope="row" className="py-2 font-normal">{candleLabel(candle, interval)}</th><td className="px-2 py-2 text-right">{formatChartPrice(candle.open, currency)}</td><td className="px-2 py-2 text-right">{formatChartPrice(candle.high, currency)}</td><td className="px-2 py-2 text-right">{formatChartPrice(candle.low, currency)}</td><td className="py-2 text-right">{formatChartPrice(candle.close, currency)}</td></tr>)
              : points.map((point) => <tr key={point.date} className="border-t border-border"><th scope="row" className="py-2 font-normal">{formatChartDate(point.date)}</th><td className="py-2 text-right">{formatChartPrice(point.close, currency)}</td></tr>)}</tbody>
          </table>
        </div> : null}
      </details>
    </> : <div role="status" className="flex min-h-52 items-center justify-center px-4 text-center text-small text-secondary">{message ?? "Vývoj ceny pro toto období není dostupný."}</div>}
  </section>;
}
