"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { ArrowRight, ChevronDown, Dices, Info } from "lucide-react";
import { FinanceInput } from "@/components/learning/finance-input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import { DEFAULT_SIMULATION_BLOCK_MONTHS, DEFAULT_SIMULATION_PATHS, MIN_SIMULATION_HISTORY_MONTHS } from "@/features/backtesting/monte-carlo";
import { FinancialInputError } from "@/features/finance/returns";
import type { Currency } from "@/features/market-data/contracts";
import { formatBacktestMoney } from "./backtest-model";
import { buildSimulation, defaultSimulationConfig, formatPaths, formatYears, simulationHorizons, type SimulationConfig, type SimulationHorizon, type SimulationView } from "./simulation-model";
import styles from "./backtesting-lab.module.css";

const SimulationFanChart = dynamic(() => import("./simulation-fan-chart").then((module) => module.SimulationFanChart), {
  loading: () => <div role="status" className={styles.chartLoading}>Načítám graf…<div className={styles.skeleton} /></div>,
});

/** Five years of history; a shorter one shows only a narrow slice of what markets can do. */
const SHORT_HISTORY_MONTHS = 60;

type Props = {
  /** Strategy A's month-end values in the shown backtest, starting with the initial amount. */
  values: readonly number[];
  /** What the draws come from, e.g. „Mix 60 / 40 · Leden 2015 – prosinec 2025 · s náklady obchodů“. */
  basis: string;
  /** „Ukázková data“ or „Historická data“, as the backtest is labelled. */
  sourceTag: string;
  currency: Currency;
  amount: number;
};

/**
 * The step after a backtest: future paths drawn from strategy A's past monthly returns. It runs
 * in the browser on the result already shown and touches neither Practice Capital nor the portfolio.
 */
export function BacktestSimulation({ values, basis, sourceTag, currency, amount }: Props) {
  const [config, setConfig] = useState<SimulationConfig>(() => defaultSimulationConfig(String(Math.round(amount))));
  const [result, setResult] = useState<SimulationView>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const money = (value: number) => formatBacktestMoney(value, currency);
  const unit = currency === "CZK" ? "Kč" : currency;
  const historyMonths = values.length - 1;
  const dirty = Boolean(result && (config.years !== result.config.years || config.amount !== result.config.amount || config.contribution !== result.config.contribution));

  async function simulate(next: SimulationConfig) {
    if (running) return;
    setRunning(true); setError(undefined);
    // Paint the running state first; 1 000 paths over 20 years take about 10 ms.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      setResult(buildSimulation(values, next));
      setConfig(next);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (cause) {
      setError(cause instanceof FinancialInputError ? cause.message : "Simulaci se nepodařilo spočítat. Zkontroluj nastavení a zkus to znovu.");
    } finally { setRunning(false); }
  }

  const last = result?.months.at(-1);
  return <section className={styles.simulation} aria-labelledby="simulation-heading" aria-busy={running}>
    <p className={styles.eyebrow}>Další krok · Simulace</p>
    <h2 id="simulation-heading">Co by mohlo nastat dál?</h2>
    <p>Simulace poskládá {formatPaths(DEFAULT_SIMULATION_PATHS)} možných budoucích cest z měsíčních výnosů strategie A v tomto backtestu: {historyMonths} měsíců, {basis}. Uvidíš prostřední cestu i to, jak široký je rozsah kolem ní.</p>
    <p className={styles.simulationFrame}><Info size={16} aria-hidden="true" /><span><strong>Není to předpověď ani doporučení.</strong> Rozsah ukazuje nejistotu. Vychází jen z minulých dat a minulost se nemusí opakovat.</span></p>
    {historyMonths < MIN_SIMULATION_HISTORY_MONTHS ? <p className={styles.notice} data-testid="simulation-unavailable">Simulace potřebuje alespoň {MIN_SIMULATION_HISTORY_MONTHS} měsíců historie, tento backtest má {historyMonths}. Z tak krátkého úseku by rozsah nic neřekl. Zvol delší období a spusť backtest znovu.</p> : <>
    <form className={styles.simulationForm} onSubmit={(event) => { event.preventDefault(); void simulate({ ...config, seed: result?.config.seed ?? config.seed }); }} aria-label="Nastavení simulace">
      <fieldset disabled={running} className={styles.simulationFields}>
        <legend className="sr-only">Nastavení simulace</legend>
        <div><label htmlFor="simulation-years" className={styles.label}>Horizont</label><Select id="simulation-years" value={config.years} onChange={(event) => setConfig({ ...config, years: Number(event.target.value) as SimulationHorizon })}>{simulationHorizons.map((years) => <option key={years} value={years}>{formatYears(years)}</option>)}</Select></div>
        <FinanceInput id="simulation-amount" label="Vklad na začátku" suffix={unit} value={config.amount} onValueChange={(value) => setConfig({ ...config, amount: value })} />
        <FinanceInput id="simulation-contribution" label="Měsíční vklad" suffix={unit} value={config.contribution} onValueChange={(value) => setConfig({ ...config, contribution: value })} hint="Na konci každého měsíce. Bez vkladů nech 0." />
      </fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <Button type="submit" variant={result ? "secondary" : "primary"} loading={running}>{running ? "Počítám cesty…" : result ? "Spustit znovu" : "Spustit simulaci"}<ArrowRight size={16} aria-hidden="true" /></Button>
    </form>
    {historyMonths < SHORT_HISTORY_MONTHS && <p className={styles.notice} data-testid="simulation-short-history">Historie má jen {historyMonths} měsíců. Simulace nevytáhne nic, co se v nich nestalo, takže rozsah spíš podhodnotí. Pro pestřejší vzorek zvol delší období backtestu.</p>}
    {dirty && <p role="status" className={styles.notice}>Nastavení se změnilo. Spusť simulaci znovu. Níže je stále předchozí výsledek.</p>}
    {result && last && <div className={styles.simulationResult} data-testid="simulation-result">
      <h3 ref={heading} tabIndex={-1}>Za {formatYears(result.years)} · start {money(result.amount)}{result.contribution > 0 ? ` + ${money(result.contribution)} měsíčně` : ""}</h3>
      <SimulationFanChart result={result} currency={currency} sourceTag={sourceTag} />
      <dl className={styles.simulationOutcomes}>
        <div><dt>Prostřední cesta (medián)</dt><dd data-testid="simulation-median">{money(last.p50)}</dd><dd>Polovina cest skončila níž, polovina výš.</dd></div>
        <div><dt>Polovina cest (P25–P75)</dt><dd data-testid="simulation-inner">{money(last.p25)} – {money(last.p75)}</dd><dd>Čtvrtina cest skončila pod tímto rozsahem a čtvrtina nad ním.</dd></div>
        <div><dt>90 % cest (P5–P95)</dt><dd data-testid="simulation-outer">{money(last.p5)} – {money(last.p95)}</dd><dd>Mimo zůstalo 5 % nejhorších a 5 % nejlepších cest. I ty se můžou stát.</dd></div>
        <div><dt>Vloženo celkem</dt><dd data-testid="simulation-contributed">{money(last.contributed)}</dd><dd>Počáteční částka a vklady. Nejsou to výnos.</dd></div>
      </dl>
      <div className={styles.simulationRedraw}>
        <Button variant="secondary" onClick={() => void simulate({ ...result.config, seed: result.config.seed + 1 })} disabled={running}><Dices size={16} aria-hidden="true" />Nové losování</Button>
        <p className={styles.hint}>Jiné losování posune okraje jen trochu. Rozsah je vlastnost minulých výnosů, ne náhoda jednoho losování.</p>
      </div>
      <details className={styles.methodology}><summary><Info size={16} aria-hidden="true" />Jak simulace funguje<ChevronDown size={16} aria-hidden="true" /></summary><div>
        <p>Z backtestu vezmeme {historyMonths} měsíčních výnosů strategie A. Každá z {formatPaths(result.paths)} cest se skládá z bloků po {DEFAULT_SIMULATION_BLOCK_MONTHS} po sobě jdoucích měsících historie. Kde blok začne, se losuje; po posledním měsíci historie pokračuje prvním. Bloky drží pohromadě klidná i bouřlivá období (blokový bootstrap).</p>
        <p>Každý měsíc se hodnota cesty vynásobí 1 + vylosovaný výnos a pak se přičte měsíční vklad. Žádné další poplatky, daně ani inflace. Náklady obchodů jsou ve výnosech jen tak, jak je zaplatil zobrazený backtest.</p>
        <p>P5 znamená, že v daném měsíci je 5 % cest níž. Mezi nejbližšími pořadími hodnoty lineárně dopočítáme. Medián (P50) je prostřední hodnota v každém měsíci zvlášť, ne jedna konkrétní cesta.</p>
        <p>Losování je seedované (seed {result.config.seed}): stejné nastavení dá vždy stejný výsledek. Simulace nepočítá „pravděpodobnost zisku“: rozsah popisuje jen to, co dovolí minulé výnosy, ne skutečné šance na trhu.</p>
      </div></details>
    </div>}
    </>}
  </section>;
}
