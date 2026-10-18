"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RebasedPoint } from "@/features/instruments/comparison";
import { comparisonChartLabel, formatIndexLevel } from "@/features/instruments/comparison-presentation";
import { dateLabel } from "@/features/instruments/price-metrics-presentation";
import { dayNumber } from "@/features/instruments/price-metrics";

type Series = { symbol: string; name: string };

const axis = { fill: "var(--color-secondary)", fontSize: 11 };
const SERIES_STYLE = {
  first: { stroke: "var(--color-primary)", strokeWidth: 2.5, strokeDasharray: undefined },
  second: { stroke: "var(--color-secondary)", strokeWidth: 2, strokeDasharray: "6 4" },
} as const;

function tickLabel(value: string, long: boolean) {
  return new Intl.DateTimeFormat("cs-CZ", long ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

/** Line samples for the legend, so the series differ by stroke style as well as colour. */
export function SeriesSwatch({ series }: { series: "first" | "second" }) {
  const style = SERIES_STYLE[series];
  return <svg aria-hidden="true" width="28" height="10" viewBox="0 0 28 10" className="shrink-0"><line x1="1" x2="27" y1="5" y2="5" stroke={style.stroke} strokeWidth={style.strokeWidth} strokeDasharray={style.strokeDasharray} strokeLinecap="round" /></svg>;
}

export function InstrumentComparisonChart({ first, second, points }: { first: Series; second: Series; points: readonly RebasedPoint[] }) {
  const long = dayNumber(points[points.length - 1].date) - dayNumber(points[0].date) > 200;
  const values = points.flatMap((point) => [point.first, point.second]);
  const low = Math.min(100, ...values);
  const high = Math.max(100, ...values);
  const padding = Math.max((high - low) * 0.1, 1);
  return <div role="img" aria-label={comparisonChartLabel(first, second, points)} className="h-64 min-w-0 max-w-full overflow-hidden sm:h-72 lg:h-80">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points as RebasedPoint[]} accessibilityLayer margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" />
        <XAxis dataKey="date" tickFormatter={(value: string) => tickLabel(value, long)} minTickGap={48} interval="preserveStartEnd" tickLine={false} axisLine={false} tick={axis} />
        <YAxis domain={[low - padding, high + padding]} width={48} tickCount={5} tickLine={false} axisLine={false} tick={axis} tickFormatter={(value: number) => new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(value)} />
        <Tooltip labelFormatter={(value) => dateLabel(String(value))} formatter={(value, name) => [formatIndexLevel(Number(value)), name]} contentStyle={{ border: "1px solid var(--color-border)", borderRadius: "0.75rem", background: "var(--color-surface)", color: "var(--color-foreground)" }} />
        <ReferenceLine y={100} stroke="var(--color-border-strong)" strokeDasharray="4 4" ifOverflow="extendDomain" />
        <Line type="linear" dataKey="first" name={`A · ${first.symbol}`} {...SERIES_STYLE.first} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        <Line type="linear" dataKey="second" name={`B · ${second.symbol}`} {...SERIES_STYLE.second} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
