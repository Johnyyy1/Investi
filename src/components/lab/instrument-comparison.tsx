import { AppLink as Link } from "@/components/shell/app-link";
import { ChevronRight, CircleHelp } from "lucide-react";
import { ComparePicker } from "@/components/lab/compare-picker";
import { InstrumentComparisonChart, SeriesSwatch } from "@/components/lab/instrument-comparison-chart";
import { Feedback } from "@/components/ui/feedback";
import type { ComparedInstrument, InstrumentComparison } from "@/features/instruments/comparison-loader";
import { comparisonDataLabel, comparisonMetricRows, correlationView, CORRELATION_HELP, formatIndexLevel, type ComparedMetricValue } from "@/features/instruments/comparison-presentation";
import { chartRanges, type ChartRange } from "@/features/instruments/history";
import { dateLabel, metricToneClass } from "@/features/instruments/price-metrics-presentation";
import { instrumentCompareHref, instrumentDetailHref } from "@/features/instruments/routes";

const periodOptionLabels: Record<ChartRange, string> = { "1M": "1M", "3M": "3M", "6M": "6M", YTD: "Letos", "1Y": "1R", "5Y": "5L", Max: "Max" };
const letters = ["A", "B"] as const;
const seriesKeys = ["first", "second"] as const;

function symbolOf(side: ComparedInstrument) { return side.instrument?.symbol ?? side.instrumentId; }
function nameOf(side: ComparedInstrument) { return side.instrument?.name ?? "Nedostupný instrument"; }

function MetricValue({ value, unit }: { value: ComparedMetricValue; unit?: string }) {
  if (value === null || value.value === null) return <span className="font-bold text-secondary">Nedostupné</span>;
  return <span className="inline-flex flex-wrap items-baseline gap-x-1.5"><span className={`text-card-title font-bold tabular-nums ${metricToneClass(value.tone)}`}>{value.value}</span>{unit ? <span className="text-microcopy text-secondary">{unit}</span> : null}</span>;
}

function MetricMeaning({ value }: { value: ComparedMetricValue }) {
  return <p className="mt-1 text-microcopy leading-relaxed text-secondary">{value === null ? "Chybí cenová historie tohoto instrumentu." : value.meaning}</p>;
}

function MetricHelp({ help }: { help: string }) {
  return <details className="mt-1 text-small">
    <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold text-primary-hover focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"><CircleHelp aria-hidden="true" className="size-4" />Co to znamená?</summary>
    <p className="mt-1 max-w-[30rem] text-microcopy leading-relaxed text-secondary">{help}</p>
  </details>;
}

export function InstrumentComparisonView({ data, sample }: { data: InstrumentComparison; sample: boolean }) {
  const { comparison, instruments, range } = data;
  const [first, second] = instruments;
  const rows = comparisonMetricRows(comparison?.metrics[0] ?? null, comparison?.metrics[1] ?? null);
  const correlation = correlationView(comparison?.correlation ?? null, data.correlationMessage);
  const period = comparison?.commonPeriod ?? null;
  const points = comparison?.points ?? [];
  const end = points.at(-1);
  const differentExchanges = first.instrument?.exchangeMic && second.instrument?.exchangeMic && first.instrument.exchangeMic !== second.instrument.exchangeMic;
  const dataLabel = comparisonDataLabel([first.provenance, second.provenance]);

  return <>
    <header className="mt-3 pb-6 sm:mt-5 sm:pb-7">
      <div className="flex flex-wrap items-center gap-3"><p className="text-microcopy font-bold uppercase tracking-[0.12em] text-primary-hover">Srovnání instrumentů</p><span className="rounded-control border border-border bg-surface-muted px-2.5 py-1 text-microcopy font-semibold text-secondary">{dataLabel}</span></div>
      <h1 className="mt-2 min-w-0 wrap-anywhere text-page-title font-bold tracking-[-0.025em]">{symbolOf(first)} a {symbolOf(second)}</h1>
      <ul aria-label="Srovnávané instrumenty" className="mt-4 grid gap-3 text-small sm:grid-cols-2">
        {instruments.map((side, index) => <li key={letters[index]} className="flex min-w-0 items-start gap-3">
          <span className="mt-1.5"><SeriesSwatch series={seriesKeys[index]} /></span>
          <span className="min-w-0"><span className="font-bold">{letters[index]} · {side.instrument ? <Link href={instrumentDetailHref(side.instrumentId)} className="wrap-anywhere text-primary-hover underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary">{nameOf(side)}</Link> : nameOf(side)}</span>
            <span className="block wrap-anywhere text-secondary">{side.instrument ? `${side.instrument.symbol}${side.instrument.exchangeMic ? ` · burza ${side.instrument.exchangeMic}` : ""} · v ${side.instrument.quoteCurrency}` : side.message}</span></span>
        </li>)}
      </ul>
    </header>

    <nav aria-label="Období srovnání" className="flex min-w-0 max-w-full flex-wrap gap-1 text-small">
      {chartRanges.map((option) => <Link key={option} href={instrumentCompareHref(first.instrumentId, second.instrumentId, option)} aria-current={range === option ? "page" : undefined} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-2.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${range === option ? "bg-surface text-foreground shadow-elevation-1" : "text-secondary hover:bg-surface hover:text-foreground"}`}>{periodOptionLabels[option]}</Link>)}
    </nav>

    {period && comparison?.shorterThanRange ? <Feedback state="warning" role="status" className="mt-5">Obě řady mají společná data jen od {dateLabel(period.startDate)} do {dateLabel(period.endDate)}, takže srovnání je kratší než zvolené období. Všechna čísla níže platí jen pro tyto společné dny.</Feedback> : null}

    <section aria-labelledby="comparison-chart-heading" className="mt-6 rounded-panel border border-border bg-surface p-5 shadow-elevation-1 sm:p-6">
      <h2 id="comparison-chart-heading" className="wrap-anywhere text-section-title font-bold">Vývoj ceny, přepočtený na 100</h2>
      <p className="mt-1 text-small text-secondary">{period ? `Dny, kdy se obchodovaly oba · ${dateLabel(period.startDate)} – ${dateLabel(period.endDate)} · ` : ""}každý ve své měně · jen cena, bez dividend</p>
      {points.length > 1 && end ? <>
        <dl className="mt-5 grid gap-x-8 gap-y-3 border-y border-border py-4 text-small sm:grid-cols-2">
          {instruments.map((side, index) => <div key={letters[index]} className="flex min-w-0 items-center gap-3"><dt className="flex min-w-0 items-center gap-3 wrap-anywhere text-secondary"><SeriesSwatch series={seriesKeys[index]} />{letters[index]} · {symbolOf(side)} {index === 0 ? "plná čára" : "přerušovaná čára"}</dt><dd className="ml-auto font-bold tabular-nums">{formatIndexLevel(index === 0 ? end.first : end.second)}</dd></div>)}
        </dl>
        <div className="mt-5"><InstrumentComparisonChart first={{ symbol: symbolOf(first), name: nameOf(first) }} second={{ symbol: symbolOf(second), name: nameOf(second) }} points={points} /></div>
        <p className="mt-4 text-small leading-relaxed text-secondary">100 je cena na začátku společného období. Hodnota 120 znamená, že cena byla o 20 % výš než na začátku, 90 o 10 % níž. Přepočet umožní srovnat instrumenty s různou cenou i měnou.</p>
        {first.historyPartial || second.historyPartial ? <p className="mt-2 text-microcopy text-secondary">Pouze dostupná pozorování; chybějící dny nejsou doplněny.</p> : null}
        <details className="mt-3 text-small"><summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary-hover focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary">Zobrazit data grafu</summary>
          <div className="relative max-h-72 overflow-auto" tabIndex={0} role="region" aria-label="Data srovnávacího grafu"><table className="w-full table-fixed text-left tabular-nums"><caption className="sr-only">Ceny přepočtené na 100 ke společnému počátku</caption><thead><tr><th scope="col" className="py-2">Datum</th><th scope="col" className="px-2 py-2 text-right wrap-anywhere">A · {symbolOf(first)}</th><th scope="col" className="py-2 text-right wrap-anywhere">B · {symbolOf(second)}</th></tr></thead>
            <tbody>{points.map((point) => <tr key={point.date} className="border-t border-border"><th scope="row" className="py-2 font-normal">{dateLabel(point.date)}</th><td className="px-2 py-2 text-right">{formatIndexLevel(point.first)}</td><td className="py-2 text-right">{formatIndexLevel(point.second)}</td></tr>)}</tbody></table></div>
        </details>
      </> : <p role="status" className="mt-5 flex min-h-40 items-center justify-center px-4 text-center text-small text-secondary">{!first.historyAvailable || !second.historyAvailable
        ? `Graf nelze zobrazit. ${[first, second].filter((side) => !side.historyAvailable).map((side) => `${symbolOf(side)}: ${side.message ?? side.historyMessage ?? "cenová historie není dostupná."}`).join(" ")}`
        : "Instrumenty nemají v tomto období dost společných obchodních dní. Zkus delší období."}</p>}
    </section>

    <section aria-labelledby="comparison-metrics-heading" className="mt-6">
      <h2 id="comparison-metrics-heading" className="wrap-anywhere text-section-title font-bold">Co říkají čísla</h2>
      <p className="mt-1 text-small text-secondary">{period ? `${dateLabel(period.startDate)} – ${dateLabel(period.endDate)} · ` : ""}ze společných denních zavíracích cen · každý ve své měně · bez dividend</p>
      <table className="mt-5 hidden w-full table-fixed border-collapse text-left text-small md:table">
        <caption className="sr-only">Ukazatele A a B za společné období</caption>
        <thead><tr className="border-b border-border-strong"><th scope="col" className="w-[30%] py-3 pr-4 font-semibold text-secondary">Ukazatel</th>{instruments.map((side, index) => <th key={letters[index]} scope="col" className="py-3 pr-4 font-semibold"><span className="flex min-w-0 items-center gap-2"><SeriesSwatch series={seriesKeys[index]} /><span className="wrap-anywhere">{letters[index]} · {symbolOf(side)}</span></span></th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border align-top">
          <th scope="row" className="py-4 pr-4 font-semibold">{row.label}<MetricHelp help={row.help} /></th>
          {row.values.map((value, index) => <td key={letters[index]} className="py-4 pr-4"><MetricValue value={value} unit={row.unit} /><MetricMeaning value={value} /></td>)}
        </tr>)}</tbody>
      </table>
      <ul className="mt-5 grid gap-6 md:hidden">
        {rows.map((row) => <li key={row.id} className="border-t border-border pt-4">
          <h3 className="wrap-anywhere text-small font-semibold">{row.label}</h3>
          <dl className="mt-3 grid gap-4">{row.values.map((value, index) => <div key={letters[index]} className="min-w-0">
            <dt className="flex items-center gap-2 text-microcopy font-semibold text-secondary"><SeriesSwatch series={seriesKeys[index]} />{letters[index]} · {symbolOf(instruments[index])}</dt>
            <dd className="mt-1"><MetricValue value={value} unit={row.unit} /><MetricMeaning value={value} /></dd>
          </div>)}</dl>
          <MetricHelp help={row.help} />
        </li>)}
      </ul>
    </section>

    <section aria-labelledby="comparison-correlation-heading" className="mt-8 grid gap-6 border-t border-border pt-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <h2 id="comparison-correlation-heading" className="wrap-anywhere text-section-title font-bold">Korelace A ↔ B</h2>
        {correlation.status === "ok" ? <>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-[clamp(1.75rem,3vw,2.25rem)] leading-none font-bold tabular-nums">{correlation.value}</span><span className="text-card-title font-bold">{correlation.label}</span></p>
          <p className="mt-3 text-small leading-relaxed">{correlation.meaning}</p>
        </> : <p role="status" className="mt-3 text-small leading-relaxed text-secondary"><span className="font-bold text-foreground">Nedostupné.</span> {correlation.message}</p>}
        {correlation.basis ? <p className="mt-2 text-microcopy text-secondary">{correlation.basis}</p> : null}
        {differentExchanges ? <p className="mt-2 text-microcopy text-secondary">Burzy {first.instrument!.exchangeMic} a {second.instrument!.exchangeMic} zavírají v různý čas, takže denní korelace může vyjít nižší, než je skutečná souvislost.</p> : null}
        <MetricHelp help={CORRELATION_HELP} />
      </div>
      <div className="min-w-0 self-start rounded-panel bg-surface-muted p-5">
        <h3 className="text-card-title font-bold">Férové srovnání</h3>
        <p className="mt-2 text-small leading-relaxed">Obě řady začínají ve stejný den a ukazují jen cenu. Dividendy chybí, takže u instrumentu, který je vyplácí, je skutečný výsledek investora vyšší. Minulý vývoj nepředpovídá ten budoucí.</p>
        <Link href="/learn/returns/comparing-investments" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-control font-semibold text-primary-hover focus-visible:outline-2 focus-visible:outline-primary">Lekce: Cenový a celkový výnos <ChevronRight aria-hidden="true" className="size-4" /></Link>
      </div>
    </section>

    <section aria-labelledby="comparison-change-heading" className="mt-8 border-t border-border pt-7">
      <h2 id="comparison-change-heading" className="wrap-anywhere text-card-title font-bold">Porovnat {symbolOf(first)} s něčím jiným</h2>
      <div className="mt-4 max-w-xl"><ComparePicker id="compare-change-search" label="Vyměnit instrument B" first={first.instrumentId} range={range} sample={sample} /></div>
    </section>
  </>;
}
