"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, usePlotArea, useYAxisScale, type TooltipContentProps } from "recharts";
import type { Currency } from "@/features/market-data/contracts";
import { formatDecimal } from "@/lib/formatters";
import { formatBacktestMoney } from "./backtest-model";
import { fanRows, formatPaths, formatSimulationMonth, simulationSummary, yearlyRows, type FanRow, type SimulationView } from "./simulation-model";
import styles from "./backtesting-lab.module.css";

const axis = { fill: "var(--color-muted)", fontSize: 12, fontFamily: "inherit" };
const LABEL_GAP = 15;
const levels = [["p95", "P95"], ["p75", "P75"], ["p50", "Medián"], ["p25", "P25"], ["p5", "P5"]] as const;

/** Names the band edges and the median at the horizon, pushed apart so they never overlap. */
function EndLabels({ last }: { last: FanRow }) {
  const scale = useYAxisScale(), plot = usePlotArea();
  if (!scale || !plot) return null;
  const placed = levels.map(([key, label]) => ({ key, label, y: scale(last[key]) ?? 0 }));
  for (let index = 1; index < placed.length; index += 1) placed[index].y = Math.max(placed[index].y, placed[index - 1].y + LABEL_GAP);
  const overflow = placed.at(-1)!.y - (plot.y + plot.height);
  if (overflow > 0) placed.forEach((item) => { item.y -= overflow; });
  return <g aria-hidden="true">{placed.map((item) => <text key={item.key} x={plot.x + plot.width + 6} y={item.y} dy="0.32em" fontSize={12} fontWeight={item.key === "p50" ? 700 : 500} fill={item.key === "p50" ? "var(--color-primary)" : "var(--color-secondary)"}>{item.label}</text>)}</g>;
}

function FanTooltip({ active, payload, currency }: TooltipContentProps & { currency: Currency }) {
  const row = payload?.[0]?.payload as FanRow | undefined;
  if (!active || !row) return null;
  const money = (value: number) => formatBacktestMoney(value, currency);
  return <div className={styles.tooltip}><strong>{formatSimulationMonth(row.month)}</strong>
    <p><span>95 % cest pod</span><strong>{money(row.p95)}</strong></p>
    <p><span>75 % cest pod</span><strong>{money(row.p75)}</strong></p>
    <p><span>Medián</span><strong>{money(row.p50)}</strong></p>
    <p><span>25 % cest pod</span><strong>{money(row.p25)}</strong></p>
    <p><span>5 % cest pod</span><strong>{money(row.p5)}</strong></p>
    <p><span>Vloženo celkem</span><strong>{money(row.contributed)}</strong></p>
  </div>;
}

export function SimulationFanChart({ result, currency, sourceTag }: { result: SimulationView; currency: Currency; sourceTag: string }) {
  const money = (value: number) => formatBacktestMoney(value, currency);
  const unit = currency === "CZK" ? "Kč" : currency;
  const data = fanRows(result);
  const horizon = data.length - 1;
  const step = result.years === 1 ? 3 : result.years <= 5 ? 12 : result.years <= 10 ? 24 : 60;
  const ticks = [...data.filter((row) => row.month % step === 0).map((row) => row.month), ...(horizon % step === 0 ? [] : [horizon])];
  return <figure className={styles.chart} data-testid="simulation-chart">
    <figcaption><h3>Možné cesty hodnoty v {unit}</h3><span className={styles.sampleTag}>Simulace · {sourceTag}</span></figcaption>
    <ul className={styles.chartLegend} aria-label="Části grafu">
      <li><span className={styles.strategySwatch} aria-hidden="true" /><span>Medián · prostřední cesta</span></li>
      <li><span className={styles.innerBandSwatch} aria-hidden="true" /><span>Polovina cest · P25–P75</span></li>
      <li><span className={styles.outerBandSwatch} aria-hidden="true" /><span>90 % cest · P5–P95</span></li>
      <li><span className={styles.initialSwatch} aria-hidden="true" /><span>Vloženo celkem</span></li>
    </ul>
    <div className={styles.chartCanvas} role="img" aria-label={simulationSummary(result, currency)}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={{ top: 12, right: 64, bottom: 6, left: 0 }}>
          <CartesianGrid stroke="var(--color-divider)" vertical={false} />
          <XAxis dataKey="month" type="number" domain={[0, horizon]} ticks={ticks} tick={axis} tickFormatter={(month: number) => month === 0 ? "Dnes" : month % 12 === 0 ? `${month / 12} r.` : `${month} m.`} tickLine={false} axisLine={false} />
          <YAxis width={56} tick={axis} tickFormatter={(value: number) => formatDecimal(value, { notation: "compact", maximumFractionDigits: 1 })} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip content={(props) => <FanTooltip {...props} currency={currency} />} isAnimationActive={false} />
          <Area type="linear" dataKey="outer" name="90 % cest" stroke="none" fill="var(--color-primary)" fillOpacity={0.14} isAnimationActive={false} activeDot={false} />
          <Area type="linear" dataKey="inner" name="Polovina cest" stroke="none" fill="var(--color-primary)" fillOpacity={0.3} isAnimationActive={false} activeDot={false} />
          <Line type="linear" dataKey="contributed" name="Vloženo celkem" stroke="var(--color-viz-other)" strokeDasharray="3 4" strokeWidth={1.75} dot={false} isAnimationActive={false} />
          <Line type="linear" dataKey="p50" name="Medián" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <EndLabels last={data[horizon]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <details className={styles.dataTable}><summary>Zobrazit tabulku dat</summary><div tabIndex={0} role="region" aria-label="Tabulka simulace po letech"><table><caption>Percentily hodnoty v {unit} na konci každého roku, z {formatPaths(result.paths)} cest</caption><thead><tr><th scope="col">Kdy</th><th scope="col">Medián</th><th scope="col">Polovina cest (P25–P75)</th><th scope="col">90 % cest (P5–P95)</th><th scope="col">Vloženo</th></tr></thead><tbody>{yearlyRows(result).map((row) => <tr key={row.month}><th scope="row">{formatSimulationMonth(row.month)}</th><td>{money(row.p50)}</td><td>{money(row.p25)} – {money(row.p75)}</td><td>{money(row.p5)} – {money(row.p95)}</td><td>{money(row.contributed)}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
