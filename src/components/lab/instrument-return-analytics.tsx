import { CircleHelp } from "lucide-react";
import type { PriceMetrics } from "@/features/instruments/price-metrics";
import type { Currency } from "@/features/market-data/contracts";

function percent(value: number, digits = 1) {
  const formatted = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(value) * 100);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted} %`;
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

type Metric = { id: string; label: string; value: string | null; unit?: string; meaning: string; help: string; tone: "positive" | "negative" | "neutral" };

function toneClass(tone: Metric["tone"]) {
  return tone === "positive" ? "text-success-ink" : tone === "negative" ? "text-danger-ink" : "text-foreground";
}

function metricsFor(metrics: PriceMetrics): Metric[] {
  const periodReturn = metrics.periodReturn;
  const drawdown = metrics.maxDrawdown;
  return [
    {
      id: "simple-return",
      label: "Jednoduchý výnos",
      value: periodReturn === null ? null : percent(periodReturn),
      meaning: periodReturn === null ? "Pro výpočet jsou potřeba aspoň dvě zavírací ceny." : "Změna ceny mezi první a poslední zavírací cenou období.",
      help: "Výnos = konečná cena ÷ počáteční cena − 1. Dividendy se nezahrnují, proto jde o cenový výnos.",
      tone: periodReturn === null || periodReturn === 0 ? "neutral" : periodReturn > 0 ? "positive" : "negative",
    },
    {
      id: "annualised-return",
      label: "Roční výnos",
      value: metrics.annualisedReturn === null ? null : percent(metrics.annualisedReturn),
      unit: "ročně",
      meaning: metrics.annualisedReturn === null ? "Pro období kratší než jeden rok se výnos nepřepočítává na rok." : "Průměrná roční změna ceny se složeným úročením.",
      help: "Roční výnos je geometrický průměr: (1 + výnos období)^(365,25 ÷ počet dní) − 1. Stejný výnos každý rok by vedl ke stejnému výsledku; skutečné roky byly nerovné.",
      tone: metrics.annualisedReturn === null || metrics.annualisedReturn === 0 ? "neutral" : metrics.annualisedReturn > 0 ? "positive" : "negative",
    },
    {
      id: "max-drawdown",
      label: "Největší propad",
      value: drawdown === null ? null : percent(drawdown.depth),
      meaning: drawdown === null
        ? "V tomto období cena neklesla pod předchozí nejvyšší zavírací cenu."
        : `${dateLabel(drawdown.peakDate)} → ${dateLabel(drawdown.troughDate)}. ${drawdown.recoveryDate ? `Na vrchol se cena vrátila ${dateLabel(drawdown.recoveryDate)}.` : "Vrchol v tomto období zatím nebyl znovu dosažen."}`,
      help: "Největší propad (max. drawdown) měří, o kolik cena klesla od nejvyšší předchozí zavírací ceny k nejnižší následné. Ukazuje, jak hluboký pokles investor v tomto období zažil.",
      tone: drawdown === null ? "neutral" : "negative",
    },
    {
      id: "volatility",
      label: "Volatilita",
      value: metrics.annualisedVolatility === null ? null : `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(metrics.annualisedVolatility * 100)} %`,
      unit: "ročně",
      meaning: metrics.annualisedVolatility === null ? "Na výpočet je potřeba aspoň dvacet po sobě jdoucích denních výnosů." : "Typické kolísání ceny během roku, odhadnuté z denních změn.",
      help: "Směrodatná odchylka denních jednoduchých výnosů, vynásobená √252. Vyšší hodnota znamená větší kolísání ceny; neříká nic o tom, kterým směrem cena půjde.",
      tone: "neutral",
    },
  ];
}

export function InstrumentReturnAnalytics({ metrics, currency }: { metrics: PriceMetrics | null; currency: Currency }) {
  return <section aria-labelledby="return-analytics-heading" className="rounded-panel border border-border bg-surface p-5 shadow-elevation-1 sm:p-6">
    <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
      <div className="min-w-0"><h2 id="return-analytics-heading" className="text-section-title font-bold">Co říkají čísla</h2><p className="mt-1 text-small text-secondary">{metrics ? `${dateLabel(metrics.startDate)} – ${dateLabel(metrics.endDate)}` : "Období bez dostatku dat"} · z denních zavíracích cen v {currency} · bez dividend</p></div>
      <p className="text-microcopy text-secondary">Přepočítá se, když v grafu změníš období.</p>
    </div>
    {metrics ? <dl className="mt-6 grid gap-x-6 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
      {metricsFor(metrics).map((metric) => <div key={metric.id} className="min-w-0 border-t border-border pt-4">
        <dt className="text-small font-semibold text-secondary">{metric.label}</dt>
        <dd className="mt-2 flex flex-wrap items-baseline gap-x-2">{metric.value === null ? <span className="text-card-title font-bold text-secondary">Nedostupné</span> : <span className={`text-[clamp(1.75rem,3vw,2.25rem)] leading-none font-bold tabular-nums ${toneClass(metric.tone)}`}>{metric.value}</span>}{metric.unit && metric.value !== null ? <span className="text-small text-secondary">{metric.unit}</span> : null}</dd>
        <p className="mt-3 text-small leading-relaxed text-foreground">{metric.meaning}</p>
        <details className="mt-3 text-small">
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold text-primary-hover focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"><CircleHelp aria-hidden="true" className="size-4" />Co to znamená?</summary>
          <p className="mt-1 max-w-[30rem] text-microcopy leading-relaxed text-secondary">{metric.help}</p>
        </details>
      </div>)}
    </dl> : <p role="status" className="mt-6 text-small text-secondary">Výnosové ukazatele nejsou pro toto období dostupné. Chybí dostatek zavíracích cen.</p>}
  </section>;
}
