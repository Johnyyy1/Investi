import { CircleHelp } from "lucide-react";
import type { PriceMetrics } from "@/features/instruments/price-metrics";
import { dateLabel, metricsFor, metricToneClass } from "@/features/instruments/price-metrics-presentation";
import type { Currency } from "@/features/market-data/contracts";

export function InstrumentReturnAnalytics({ metrics, currency }: { metrics: PriceMetrics | null; currency: Currency }) {
  return <section aria-labelledby="return-analytics-heading" className="rounded-panel border border-border bg-surface p-5 shadow-elevation-1 sm:p-6">
    <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
      <div className="min-w-0"><h2 id="return-analytics-heading" className="text-section-title font-bold">Co říkají čísla</h2><p className="mt-1 text-small text-secondary">{metrics ? `${dateLabel(metrics.startDate)} – ${dateLabel(metrics.endDate)}` : "Období bez dostatku dat"} · z denních zavíracích cen v {currency} · bez dividend</p></div>
      <p className="text-microcopy text-secondary">Přepočítá se, když v grafu změníš období.</p>
    </div>
    {metrics ? <dl className="mt-6 grid gap-x-6 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
      {metricsFor(metrics).map((metric) => <div key={metric.id} className="min-w-0 border-t border-border pt-4">
        <dt className="text-small font-semibold text-secondary">{metric.label}</dt>
        <dd className="mt-2 flex flex-wrap items-baseline gap-x-2">{metric.value === null ? <span className="text-card-title font-bold text-secondary">Nedostupné</span> : <span className={`text-[clamp(1.75rem,3vw,2.25rem)] leading-none font-bold tabular-nums ${metricToneClass(metric.tone)}`}>{metric.value}</span>}{metric.unit && metric.value !== null ? <span className="text-small text-secondary">{metric.unit}</span> : null}</dd>
        <p className="mt-3 text-small leading-relaxed text-foreground">{metric.meaning}</p>
        <details className="mt-3 text-small">
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold text-primary-hover focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"><CircleHelp aria-hidden="true" className="size-4" />Co to znamená?</summary>
          <p className="mt-1 max-w-[30rem] text-microcopy leading-relaxed text-secondary">{metric.help}</p>
        </details>
      </div>)}
    </dl> : <p role="status" className="mt-6 text-small text-secondary">Výnosové ukazatele nejsou pro toto období dostupné. Chybí dostatek zavíracích cen.</p>}
  </section>;
}
