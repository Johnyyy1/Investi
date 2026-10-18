import type { PriceMetrics } from "./price-metrics";

/**
 * Labels, values and explanations of the price-only metrics. The instrument detail and the
 * comparison both render from here, so a metric keeps one name and one explanation.
 */
export function percent(value: number, digits = 1) {
  const formatted = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(value) * 100);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted} %`;
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

export type Metric = { id: string; label: string; value: string | null; unit?: string; meaning: string; help: string; tone: "positive" | "negative" | "neutral" };

export function metricToneClass(tone: Metric["tone"]) {
  return tone === "positive" ? "text-success-ink" : tone === "negative" ? "text-danger-ink" : "text-foreground";
}

export function metricsFor(metrics: PriceMetrics): Metric[] {
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
