import type { RebasedPoint } from "./comparison";
import type { ReturnCorrelation } from "./correlation";
import type { PriceMetrics } from "./price-metrics";
import { dateLabel, metricsFor, type Metric } from "./price-metrics-presentation";

/** One instrument's value of a metric; null when that instrument has no price history to compute it from. */
export type ComparedMetricValue = Pick<Metric, "value" | "meaning" | "tone"> | null;

export type ComparisonMetricRow = Pick<Metric, "id" | "label" | "unit" | "help"> & {
  values: readonly [ComparedMetricValue, ComparedMetricValue];
};

/** Rows in the detail's metric order, labels and explanations, with each side unavailable rather than zero. */
export function comparisonMetricRows(first: PriceMetrics | null, second: PriceMetrics | null): ComparisonMetricRow[] {
  const [firstMetrics, secondMetrics] = [first, second].map((metrics) => metrics ? metricsFor(metrics) : null);
  const template = firstMetrics ?? secondMetrics ?? metricsFor({ startDate: "", endDate: "", observationCount: 0, spanDays: 0, periodReturn: null, annualisedReturn: null, maxDrawdown: null, annualisedVolatility: null });
  return template.map((metric, index) => {
    const value = (side: Metric[] | null): ComparedMetricValue => side ? { value: side[index].value, meaning: side[index].meaning, tone: side[index].tone } : null;
    return { id: metric.id, label: metric.label, unit: metric.unit, help: metric.help, values: [value(firstMetrics), value(secondMetrics)] };
  });
}

/** Presentation rounding only; the domain keeps the coefficient unrounded. */
export function formatCoefficient(coefficient: number) {
  const formatted = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(coefficient));
  return formatted === "0,00" ? formatted : `${coefficient < 0 ? "−" : ""}${formatted}`;
}

/**
 * Conventional reading bands of |r|: below 0.3 weak, below 0.7 moderate, otherwise strong.
 * They describe the past period only; the bands are a reading aid, not a statistical test.
 */
export function correlationReading(coefficient: number): { label: string; meaning: string } {
  const strength = Math.abs(coefficient);
  if (strength < 0.3) return { label: "Slabá nebo žádná korelace", meaning: "Denní výnosy spolu v tomto období téměř nesouvisely. Jeden instrument o směru druhého skoro nic neprozradil." };
  const positive = coefficient > 0;
  if (strength < 0.7) return positive
    ? { label: "Střední kladná korelace", meaning: "Ve dnech, kdy jeden rostl, druhý často rostl také, ale zdaleka ne vždy." }
    : { label: "Střední záporná korelace", meaning: "Ve dnech, kdy jeden rostl, druhý často klesal, ale zdaleka ne vždy." };
  return positive
    ? { label: "Silná kladná korelace", meaning: "Denní výnosy se většinou pohybovaly stejným směrem. Pro rozložení rizika si takové dvojice pomáhají málo." }
    : { label: "Silná záporná korelace", meaning: "Denní výnosy se většinou pohybovaly opačným směrem. Pohyby jednoho tak často tlumily pohyby druhého." };
}

export const CORRELATION_HELP = "Pearsonova korelace denních cenových výnosů za dny, kdy se obchodovaly oba instrumenty. +1 znamená, že se výnosy pohybovaly vždy spolu, −1 vždy opačně a 0, že mezi nimi nebyl lineární vztah. Každý instrument zůstává ve své měně, bez přepočtu do korun. Korelace se v čase mění a neříká nic o tom, jak velké pohyby byly.";

export type CorrelationView =
  | { status: "ok"; value: string; label: string; meaning: string; basis: string }
  | { status: "unavailable"; message: string; basis: string | null };

export function correlationView(correlation: ReturnCorrelation | null, message: string | null): CorrelationView {
  const basis = correlation?.startDate && correlation.endDate
    ? `${correlation.observationCount} společných ${correlation.frequency === "weekly" ? "týdenních" : "denních"} výnosů · ${dateLabel(correlation.startDate)} – ${dateLabel(correlation.endDate)}`
    : null;
  if (!correlation || correlation.status !== "ok") return { status: "unavailable", message: message ?? "Korelaci pro toto období nelze spočítat.", basis };
  return { status: "ok", value: formatCoefficient(correlation.coefficient), ...correlationReading(correlation.coefficient), basis: basis! };
}

export function formatIndexLevel(value: number) {
  return new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

type SeriesName = { symbol: string; name: string };

/** Text equivalent of the rebased chart for its aria-label. */
export function comparisonChartLabel(first: SeriesName, second: SeriesName, points: readonly RebasedPoint[]) {
  if (!points.length) return "";
  const start = points[0];
  const end = points[points.length - 1];
  const describe = (series: SeriesName, value: number, letter: "A" | "B", style: string) => `Řada ${letter}, ${series.name} (${series.symbol}, ${style}), skončila na ${formatIndexLevel(value)}`;
  return `Srovnávací graf: obě řady přepočtené na 100 k ${dateLabel(start.date)}, ${points.length} ${points.length < 5 ? "společné zavírací ceny" : "společných zavíracích cen"} do ${dateLabel(end.date)}. ${describe(first, end.first, "A", "plná čára")}. ${describe(second, end.second, "B", "přerušovaná čára")}. Jen cena, bez dividend.`;
}

/** Truthful source label: any sample series makes the whole comparison sample data. */
export function comparisonDataLabel(provenances: readonly ({ dataKind: string; isDeterministic: boolean } | null)[]) {
  return provenances.some((provenance) => provenance && (provenance.isDeterministic || provenance.dataKind === "synthetic")) ? "Ukázková data" : "Historická data";
}
