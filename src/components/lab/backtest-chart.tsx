"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { Info } from "lucide-react";
import { formatCurrency, formatDecimal } from "@/lib/formatters";
import { formatBacktestMonth, formatBacktestMoney as money, type ComparisonPoint } from "./backtest-model";
import styles from "./backtesting-lab.module.css";

export type { ComparisonPoint } from "./backtest-model";
const axis = { fill: "var(--color-muted)", fontSize: 12, fontFamily: "inherit" };
function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return <div className={styles.tooltip}><strong>{formatBacktestMonth(String(label))}</strong>{payload.map((entry) => <p key={String(entry.dataKey)}><span>{entry.name}</span><strong>{formatCurrency(Number(entry.value), "CZK")}</strong></p>)}</div>;
}

export function BacktestChart({ data, strategyLabel = "Tvůj mix", initial, compact = false }: { data: ComparisonPoint[]; strategyLabel?: string; initial?: number; compact?: boolean }) {
  if (!data.length || data.some((point) => !Number.isFinite(point.value) || !Number.isFinite(point.benchmark))) return <figure className={styles.chart}><figcaption>Hodnota v Kč</figcaption><p role="status" className={styles.hint}>Pro toto období nejsou dostupná úplná data. Graf nelze zobrazit.</p></figure>;
  const last = data.at(-1)!;
  const first = data[0];
  const shortPeriod = data.length <= 25;
  const monthStep = Math.max(1, Math.ceil((data.length - 1) / 4));
  const yearStep = Math.max(1, Math.ceil((Number(last.label.slice(0, 4)) - Number(first.label.slice(0, 4))) / (compact ? 3 : 5)));
  const ticks = data.filter((point, index) => index === 0 || index === data.length - 1 || (shortPeriod ? index % monthStep === 0 : point.label.endsWith("-01") && (Number(point.label.slice(0, 4)) - Number(first.label.slice(0, 4))) % yearStep === 0)).map((point) => point.label);
  return <figure className={`${styles.chart} ${compact ? styles.compactChart : ""}`}>
    <figcaption><h3>{compact ? "Hodnota v Kč" : "Hodnota v korunách, měsíc po měsíci"}</h3>{!compact && <span className={styles.sampleTag}>Ukázková data</span>}</figcaption>
    <ul className={styles.chartLegend} aria-label="Řady grafu"><li><span className={styles.strategySwatch} aria-hidden="true" /><span>A · {strategyLabel}</span></li><li><span className={styles.benchmarkSwatch} aria-hidden="true" /><span>B · Akciový vzorek</span></li>{initial !== undefined && <li><span className={styles.initialSwatch} aria-hidden="true" /><span>Vloženo {money(initial)}</span></li>}</ul>
    <div className={styles.chartCanvas}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} accessibilityLayer margin={{ top: 12, right: 12, bottom: 6, left: 0 }}>
          <CartesianGrid stroke="var(--color-divider)" vertical={false} />
          <XAxis dataKey="label" ticks={ticks} tick={axis} minTickGap={24} tickFormatter={(value: string) => shortPeriod ? `${Number(value.slice(5, 7))}/${value.slice(2, 4)}` : value.slice(0, 4)} tickLine={false} axisLine={false} />
          <YAxis width={56} tick={axis} tickFormatter={(value: number) => formatDecimal(value, { notation: "compact", maximumFractionDigits: 1 })} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip content={ChartTooltip} isAnimationActive={false} />
          {initial !== undefined && <ReferenceLine y={initial} stroke="var(--color-viz-other)" strokeDasharray="3 4" />}
          <Line type="linear" dataKey="value" name={`A · ${strategyLabel}`} stroke="var(--color-primary)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line type="linear" dataKey="benchmark" name="B · Akciový vzorek" stroke="var(--color-secondary)" strokeDasharray="6 4" strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    {!compact && <>
      <dl className={styles.chartEndpoints}><div><dt>A · {strategyLabel}</dt><dd>{money(last.value)}</dd></div><div><dt>B · Akciový vzorek</dt><dd>{money(last.benchmark)}</dd></div></dl>
      <p className={styles.chartNote}><Info size={15} aria-hidden="true" />Vymyšlená měsíční řada. Nic z grafu nepředpovídá budoucí výnosy.</p>
      <p className={styles.chartSource}>Kč je zobrazovací jednotka · bez FX, dalších vkladů, poplatků a daní · přímé spojnice měsíčních pozorování</p>
    </>}
    <details className={styles.dataTable}><summary>Zobrazit tabulku dat</summary><div tabIndex={0} role="region" aria-label={`Tabulka měsíčních hodnot · ${strategyLabel}`}><table><caption>Měsíční hodnoty v Kč včetně počáteční investice</caption><thead><tr><th scope="col">Měsíc</th><th scope="col">A · Strategie</th><th scope="col">B · Akciový vzorek</th></tr></thead><tbody>{data.map((point) => <tr key={point.label}><th scope="row">{point.label}</th><td>{money(point.value)}</td><td>{money(point.benchmark)}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
