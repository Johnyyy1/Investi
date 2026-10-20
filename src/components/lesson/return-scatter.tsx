"use client";

import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { learningChartStyle } from "@/components/learning/learning-chart";

type ReturnPair = { x: number; y: number; label?: string };

const number = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 });
/** Percent value → "+1,5 %"; rounding happens here only. */
export const signedPercent = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${number.format(Math.abs(value))} %`;
const tick = (value: number) => `${value < 0 ? "−" : ""}${number.format(Math.abs(value))} %`;

/**
 * Paired returns as dots: A across, B up, one dot per period. Points in the upper-right and
 * lower-left quadrants are periods that moved together. Values are percent, not decimals.
 */
export function ReturnScatter({ points, xLabel, yLabel, description, dense = false, domain }: {
  points: readonly ReturnPair[]; xLabel: string; yLabel: string; description: string;
  /** Hundreds of daily returns: smaller, translucent dots so clusters stay readable. */
  dense?: boolean;
  /** Symmetric axis bound in percent; derived from the data when omitted. */
  domain?: number;
}) {
  const bound = domain ?? Math.max(1, Math.ceil(Math.max(...points.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)])) * 1.1));
  // Symmetric, evenly spaced ticks around zero; a true minus sign like every other number.
  const ticks = [-bound, -bound / 2, 0, bound / 2, bound];
  return <figure className="min-w-0">
    <div role="img" aria-label={`${description} Vodorovně ${xLabel}, svisle ${yLabel}.`} className="h-64 min-w-0 max-w-full overflow-hidden sm:h-72">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ScatterChart margin={{ top: 12, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 4" />
          <XAxis type="number" dataKey="x" name={xLabel} domain={[-bound, bound]} tick={learningChartStyle.axis} tickLine={false} axisLine={false} ticks={ticks} tickFormatter={tick} />
          <YAxis type="number" dataKey="y" name={yLabel} domain={[-bound, bound]} tick={learningChartStyle.axis} tickLine={false} axisLine={false} width={56} ticks={ticks} tickFormatter={tick} />
          {/* Constant marker area: about 10 px dots, 5 px for dense daily data. */}
          <ZAxis range={dense ? [20, 20] : [80, 80]} />
          <ReferenceLine x={0} stroke="var(--color-border-strong)" />
          <ReferenceLine y={0} stroke="var(--color-border-strong)" />
          <Tooltip cursor={{ strokeDasharray: "3 4" }} contentStyle={learningChartStyle.tooltip} formatter={(value, name) => [signedPercent(Number(value)), name]} labelFormatter={() => ""} />
          <Scatter data={points as ReturnPair[]} fill={learningChartStyle.colors.primary} fillOpacity={dense ? 0.45 : 0.9} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
    <figcaption className="mt-2 text-microcopy text-secondary">{description}</figcaption>
  </figure>;
}
