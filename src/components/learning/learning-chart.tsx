"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type LearningChartPoint = { label: string; value: number };
export const learningChartStyle = {
  margin: { top: 16, right: 16, left: 0, bottom: 8 },
  axis: { fill: "var(--color-secondary)", fontSize: 13 },
  tooltip: { background: "var(--color-surface)", color: "var(--color-foreground)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-control)", boxShadow: "var(--shadow-elevation-1)", fontSize: 14 },
  colors: { primary: "var(--color-viz-equity)", positive: "var(--color-success-ink)", negative: "var(--color-danger-ink)" },
};
export function LearningChart({ data, title, description, valueLabel = "Hodnota", sentiment = "primary", formatValue = String, yDomain, dots = true }: {
  data: LearningChartPoint[]; title: string; description: string; valueLabel?: string;
  yDomain?: [number, number];
  /** Off for long daily series, where a dot per observation hides the line. */
  dots?: boolean;
  sentiment?: keyof typeof learningChartStyle.colors; formatValue?: (value: number) => string;
}) {
  if (!data.length) return <figure className="rounded-surface border border-border bg-surface p-6"><figcaption className="text-card-title font-semibold">{title}</figcaption><p className="mt-4 text-small text-secondary" role="status">Zatím nejsou k dispozici žádná data.</p></figure>;
  if (data.some((point) => !Number.isFinite(point.value))) return <p role="status" className="text-small text-danger-ink">Tento graf potřebuje konečné číselné hodnoty.</p>;
  return <figure className="min-w-0 rounded-surface border border-border bg-surface p-6">
    <figcaption><h3 className="text-card-title font-semibold">{title}</h3><p className="mt-1 text-small text-secondary">{description}</p></figcaption>
    <div className="mt-4 h-64 min-w-0 max-w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart accessibilityLayer data={data} margin={learningChartStyle.margin}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="label" tick={learningChartStyle.axis} tickLine={false} axisLine={false} />
          <YAxis domain={yDomain} tick={learningChartStyle.axis} tickLine={false} axisLine={false} width={64} tickFormatter={formatValue} />
          <Tooltip contentStyle={learningChartStyle.tooltip} formatter={(value) => [formatValue(Number(value)), valueLabel]} />
          <Line name={valueLabel} type="linear" dataKey="value" stroke={learningChartStyle.colors[sentiment]} strokeWidth={2} dot={dots ? { r: 4 } : false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <details className="mt-3 text-small"><summary className="cursor-pointer text-primary">Zobrazit tabulku dat</summary>
      <table className="mt-3 w-full text-left"><caption className="sr-only">Data grafu {title}</caption><thead><tr><th scope="col" className="py-2 font-semibold">Období</th><th scope="col" className="py-2 text-right font-semibold">{valueLabel}</th></tr></thead><tbody>{data.map((point, index) => <tr key={index} className="border-t border-border"><th scope="row" className="py-2 font-normal">{point.label}</th><td className="py-2 text-right tabular-nums">{formatValue(point.value)}</td></tr>)}</tbody></table>
    </details>
  </figure>;
}
