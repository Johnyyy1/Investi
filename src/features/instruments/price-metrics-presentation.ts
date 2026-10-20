import { metricEntry, metricExplanation, metricLessonLink, type MetricId, type MetricLessonLink } from "@/features/learning/metric-glossary";
import type { PriceMetrics } from "./price-metrics";

/**
 * Values of the price-only metrics. Names, explanations and lesson links come from the metric
 * glossary, so the instrument detail and the comparison say the same thing as every other Lab.
 */
export function percent(value: number, digits = 1) {
  const formatted = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(value) * 100);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted} %`;
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

/** `lesson` points to the lesson that explains the metric. */
export type Metric = { id: MetricId; label: string; value: string | null; unit?: string; meaning: string; help: string; lesson?: MetricLessonLink; tone: "positive" | "negative" | "neutral" };

export function metricToneClass(tone: Metric["tone"]) {
  return tone === "positive" ? "text-success-ink" : tone === "negative" ? "text-danger-ink" : "text-foreground";
}

/** The metrics `metricsFor` returns, in order. */
export const priceMetricIds = ["simple-return", "annualised-return", "max-drawdown", "volatility"] as const satisfies readonly MetricId[];

function glossary(id: MetricId) {
  return { id, label: metricEntry(id).name, help: metricExplanation(id, "instrument"), lesson: metricLessonLink(id) ?? undefined };
}

export function metricsFor(metrics: PriceMetrics): Metric[] {
  const periodReturn = metrics.periodReturn;
  const drawdown = metrics.maxDrawdown;
  return [
    {
      ...glossary("simple-return"),
      value: periodReturn === null ? null : percent(periodReturn),
      meaning: periodReturn === null ? "Pro výpočet jsou potřeba aspoň dvě zavírací ceny." : metricEntry("simple-return").summary,
      tone: periodReturn === null || periodReturn === 0 ? "neutral" : periodReturn > 0 ? "positive" : "negative",
    },
    {
      ...glossary("annualised-return"),
      value: metrics.annualisedReturn === null ? null : percent(metrics.annualisedReturn),
      unit: "ročně",
      meaning: metrics.annualisedReturn === null ? "Pro období kratší než jeden rok se výnos nepřepočítává na rok." : "Průměrná roční změna ceny se složeným úročením.",
      tone: metrics.annualisedReturn === null || metrics.annualisedReturn === 0 ? "neutral" : metrics.annualisedReturn > 0 ? "positive" : "negative",
    },
    {
      ...glossary("max-drawdown"),
      value: drawdown === null ? null : percent(drawdown.depth),
      meaning: drawdown === null
        ? "V tomto období cena neklesla pod předchozí nejvyšší zavírací cenu."
        : `${dateLabel(drawdown.peakDate)} → ${dateLabel(drawdown.troughDate)}. ${drawdown.recoveryDate ? `Na vrchol se cena vrátila ${dateLabel(drawdown.recoveryDate)}.` : "Vrchol v tomto období zatím nebyl znovu dosažen."}`,
      tone: drawdown === null ? "neutral" : "negative",
    },
    {
      ...glossary("volatility"),
      value: metrics.annualisedVolatility === null ? null : `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(metrics.annualisedVolatility * 100)} %`,
      unit: "ročně",
      meaning: metrics.annualisedVolatility === null ? "Na výpočet je potřeba aspoň dvacet po sobě jdoucích denních výnosů." : "Typické kolísání ceny během roku, odhadnuté z denních změn.",
      tone: "neutral",
    },
  ];
}
