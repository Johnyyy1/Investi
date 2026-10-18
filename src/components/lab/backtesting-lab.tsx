"use client";

import { AppLink as Link } from "@/components/shell/app-link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, FlaskConical, Info, RotateCcw, SlidersHorizontal } from "lucide-react";
import { FinanceInput } from "@/components/learning/finance-input";
import { AnswerOption } from "@/components/learning/answer-option";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import { runHistoryBacktestAction } from "@/features/backtesting/actions";
import type { BacktestHistoryView, HistoryBacktestResult } from "@/features/backtesting/catalog";
import type { RebalanceRule } from "@/features/backtesting/spec";
import { FinancialInputError } from "@/features/finance/returns";
import { formatPercentage } from "@/lib/formatters";
import { backtestPeriods, backtestStrategies, backtestYears, buildBacktestResult, formatBacktestMoney, type BacktestPrediction, type BacktestResult } from "./backtest-model";
import { historySourceCopy, rebalanceOptions, sampleSourceCopy, type BacktestSourceCopy, type BacktestSourceKind } from "./backtest-source";
import styles from "./backtesting-lab.module.css";

const BacktestChart = dynamic(() => import("./backtest-chart").then((module) => module.BacktestChart), {
  loading: () => <div role="status" className={styles.chartLoading}>Načítám graf…<div className={styles.skeleton} /></div>,
});

function Badge({ children }: { children: React.ReactNode }) {
  return <span className={styles.badge}>{children}</span>;
}

const isHistory = (result: BacktestResult): result is HistoryBacktestResult & Pick<BacktestResult, "prediction"> => result.source.kind === "history";
const sourceOf = (result: BacktestResult): BacktestSourceKind => isHistory(result) ? "history" : "sample";
const money = (result: BacktestResult, value: number) => formatBacktestMoney(value, result.currency);

function DataNotes({ copy }: { copy: BacktestSourceCopy }) {
  return <dl className={styles.dataRows}>{copy.notes.map((note) => <div key={note.term}><dt>{note.term}</dt><dd>{note.detail}</dd></div>)}</dl>;
}

function DataCard({ copy }: { copy: BacktestSourceCopy }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (details.current) details.current.open = window.matchMedia("(min-width: 1024px)").matches; }, []);
  return <details ref={details} className={styles.dataCard}><summary>Data pokusu <FlaskConical size={16} aria-hidden="true" /><ChevronDown size={16} aria-hidden="true" /></summary><p className={styles.hint}>{copy === sampleSourceCopy ? "Ukázková data · žádné historické tržní ceny." : `${copy.label} · jen cena, bez dividend.`}</p><DataNotes copy={copy} /></details>;
}

function Metrics({ result }: { result: BacktestResult }) {
  const rows = [
    { label: "Konečná hodnota", detail: "Poslední bod grafu po zvoleném období.", value: money(result, result.metrics.finalValue), benchmark: money(result, result.benchmark.finalValue) },
    { label: "CAGR", detail: "Stálé roční tempo od začátku do konce. Ne výnos každého roku.", value: formatPercentage(result.metrics.cagr), benchmark: formatPercentage(result.benchmark.cagr) },
    { label: "Největší propad", detail: "Největší pokles od předchozího maxima, měřený na konci měsíce (max. drawdown).", value: formatPercentage(result.metrics.maxDrawdown), benchmark: formatPercentage(result.benchmark.maxDrawdown) },
    { label: "Volatilita", detail: "Anualizované kolísání měsíčních výnosů. Ne každý typ rizika.", value: formatPercentage(result.metrics.volatility), benchmark: formatPercentage(result.benchmark.volatility) },
  ];
  return <section className={styles.metrics} aria-labelledby="journey-heading">
    <h2 id="journey-heading">Jak se ta cesta cítila</h2>
    <p>Konečná hodnota je jen poslední bod grafu. Porovnej i kolísání a propady.</p>
    <dl className={styles.metricRows}>{rows.map((row) => <div key={row.label} className={styles.metricRow}>
      <dt><strong>{row.label}</strong><span>{row.detail}</span></dt>
      <dd><span className={styles.metricSeries}><Badge>A</Badge> {result.strategy.name}</span><strong data-testid={`metric-${row.label.toLowerCase().replaceAll(" ", "-")}`}>{row.value}</strong></dd>
      <dd><span className={styles.metricSeries}><Badge>B</Badge> {result.benchmarkName}</span><strong>{row.benchmark}</strong></dd>
    </div>)}</dl>
  </section>;
}

function explanation(result: BacktestResult) {
  if (isHistory(result)) {
    const symbol = result.source.symbol;
    if (result.strategy.id === "trend-sma") return `Filtr držel ${symbol} ${result.monthsInvested} z ${result.months} měsíců a ${result.switches}× přepnul mezi ${symbol} a hotovostí. Rozhoduje vždy podle uzávěrky předchozího měsíce, takže na rychlý obrat trhu reaguje se zpožděním. Benchmark drží ${symbol} celou dobu.`;
    const rule = result.config.rebalance === "none" ? `Mix se nerebalancoval, takže podíl ${symbol} se posouval s cenou.` : `Mix se ${result.rebalances}× vrátil k vahám 60 / 40.`;
    return `Mix drží část peněz v hotovosti bez úroku. V propadech proto ztrácí méně, v růstu méně získá. ${rule} Benchmark drží ${symbol} celou dobu.`;
  }
  if (result.strategy.id === "stocks") return "Vybraná strategie používá stejný akciový vzorek jako benchmark. Obě křivky proto mají totožné výnosy i propady.";
  if (result.strategy.id === "bonds") return "Dluhopisový a akciový vzorek mají různé měsíční výnosy. Ty se postupně násobí, takže rozhoduje celá cesta, ne jen poslední měsíc.";
  return "Mix kombinuje akcie, dluhopisy a hotovost. Každý měsíc používá váhy 60 / 30 / 10, zatímco benchmark zůstává celý v akciovém vzorku. Rozdílné měsíční výnosy se postupně násobí.";
}

function PredictionResult({ result, copy }: { result: BacktestResult; copy: BacktestSourceCopy }) {
  const equal = result.metrics.finalValue === result.benchmark.finalValue;
  const higher = result.metrics.finalValue > result.benchmark.finalValue ? "A" : "B";
  const smaller = result.metrics.maxDrawdown === result.benchmark.maxDrawdown ? "Stejný u obou" : result.metrics.maxDrawdown < result.benchmark.maxDrawdown ? "A · Zvolená strategie" : `B · ${result.benchmarkName}`;
  const prediction = result.prediction === "strategy" ? "A" : result.prediction === "benchmark" ? "B" : undefined;
  return <section className={styles.reflection} aria-labelledby="prediction-result-heading">
    <h2 id="prediction-result-heading">{equal ? "Obě cesty skončily stejně." : `V tomhle období skončil výš ${higher}.`}</h2>
    <p>{prediction ? `Tvůj tip byl ${prediction}. ` : result.prediction === "unknown" ? "Tvůj tip byl „Nevím“. " : "Tentokrát bez tipu předem. "}Tip se nehodnotí. {copy.scope}</p>
    <div className={styles.reflectionBody}>
      <dl className={styles.outcomes}>
        <div><dt>Na konci výš</dt><dd>{equal ? "Stejné hodnoty" : `${higher} · o ${money(result, Math.abs(result.metrics.finalValue - result.benchmark.finalValue))}`}</dd></div>
        <div><dt>Menší propad cestou</dt><dd>{smaller}</dd></div>
        <div><dt>Vloženo na začátku</dt><dd>{money(result, result.amount)} do každé cesty. Žádné další vklady.</dd></div>
      </dl>
      <div className={styles.explanation}>
        <h3>Proč se výsledky liší</h3>
        <p>{explanation(result)}</p>
        <p>Vyšší konečná hodnota sama o sobě neříká, jak náročná byla cesta. Zkus stejné rozložení v jiném období. Z těchto výsledků nelze předpovídat budoucnost.</p>
      </div>
    </div>
  </section>;
}

type SourceOptions = {
  strategies: readonly { id: string; name: string; description: string }[];
  periods: readonly { id: string; name: string; start: number; end: number }[];
  years: readonly number[];
  benchmarkName: string;
  benchmarkDescription: string;
};

const sampleOptions: SourceOptions = {
  strategies: backtestStrategies,
  periods: backtestPeriods,
  years: backtestYears,
  benchmarkName: "Akciový vzorek",
  benchmarkDescription: "100 % akcií jako srovnávací benchmark. Stejná počáteční částka i období.",
};

function historyOptions(history: BacktestHistoryView): SourceOptions {
  return {
    strategies: history.strategies,
    periods: history.periods,
    years: Array.from({ length: history.lastYear - history.firstYear + 1 }, (_, index) => history.firstYear + index),
    benchmarkName: history.benchmarkName,
    benchmarkDescription: `100 % v ${history.symbol} po celé období, bez zásahů. Stejná počáteční částka i období.`,
  };
}

export function BacktestingLab({ history = null }: { history?: BacktestHistoryView | null }) {
  const [source, setSource] = useState<BacktestSourceKind>("sample");
  const [strategy, setStrategy] = useState("mixed");
  const [rebalance, setRebalance] = useState<RebalanceRule>("annual");
  const [start, setStart] = useState(2015), [end, setEnd] = useState(2025);
  const [amount, setAmount] = useState("100000");
  const [prediction, setPrediction] = useState<BacktestPrediction>();
  const [result, setResult] = useState<BacktestResult>();
  const [editing, setEditing] = useState(true);
  const [running, setRunning] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string>();
  const [comparison, setComparison] = useState<{ results: BacktestResult[]; names: string[] }>();
  const [answer, setAnswer] = useState<string>(), [checked, setChecked] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const configuration = useRef<HTMLFormElement>(null);
  const comparisonHeading = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const options = source === "history" && history ? historyOptions(history) : sampleOptions;
  const selected = options.strategies.find((item) => item.id === strategy) ?? options.strategies[0];
  const selectedKind = source === "history" ? history?.strategies.find((item) => item.id === selected.id)?.kind : undefined;
  const copy = source === "history" && history ? historySourceCopy(history) : sampleSourceCopy;
  const resultCopy = result ? copyFor(result) : copy;
  const currency = source === "history" && history ? history.currency : "CZK";
  const dirty = Boolean(result && (source !== sourceOf(result) || selected.id !== result.config.strategy || start !== result.config.start || end !== result.config.end || amount !== result.config.amount || (isHistory(result) && selectedKind === "fixed-weights" && rebalance !== result.config.rebalance)));
  const periodId = options.periods.find((period) => period.start === start && period.end === end)?.id ?? "custom";

  function copyFor(item: BacktestResult) {
    return isHistory(item) && history ? historySourceCopy(history, { start: item.config.start, end: item.config.end }, item.source) : sampleSourceCopy;
  }

  function chooseSource(next: BacktestSourceKind) {
    const nextOptions = next === "history" && history ? historyOptions(history) : sampleOptions;
    setSource(next);
    setStrategy(nextOptions.strategies[0].id);
    setStart(nextOptions.years[0]); setEnd(nextOptions.years.at(-1)!);
    setAmount(next === "history" ? "10000" : "100000");
    setError(undefined);
  }

  async function calculate(periods: readonly { start: number; end: number }[], config: { strategy: string; amount: string; rebalance: RebalanceRule }, kind: BacktestSourceKind): Promise<BacktestResult[]> {
    if (kind === "sample") return periods.map((period) => buildBacktestResult({ strategy: config.strategy, start: period.start, end: period.end, amount: config.amount }));
    const response = await runHistoryBacktestAction({ ...config, periods });
    if (!response.ok) throw new FinancialInputError(response.message);
    return response.results;
  }

  async function run() {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true); setError(undefined);
    // Yield to paint the actual running state; no artificial network delay.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      const [next] = await calculate([{ start, end }], { strategy: selected.id, amount, rebalance }, source);
      setResult({ ...next, prediction });
      setEditing(false); setComparison(undefined); setAnswer(undefined); setChecked(false);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (cause) {
      setError(cause instanceof FinancialInputError ? cause.message : "Backtest se nepodařilo spočítat. Zkontroluj nastavení a zkus to znovu.");
    } finally { inFlight.current = false; setRunning(false); }
  }
  function edit() {
    setEditing(true);
    requestAnimationFrame(() => configuration.current?.querySelector<HTMLSelectElement>("#strategy")?.focus());
  }
  async function compare() {
    if (!result || comparing) return;
    const kind = sourceOf(result);
    const presets = kind === "history" && history ? history.periods : backtestPeriods;
    setComparing(true);
    try {
      const results = await calculate(presets, { strategy: result.config.strategy, amount: result.config.amount, rebalance: isHistory(result) ? result.config.rebalance : "annual" }, kind);
      setComparison({ results: results.map((item) => ({ ...item, prediction: result.prediction })), names: presets.map((period) => period.name) });
      requestAnimationFrame(() => comparisonHeading.current?.focus());
    } catch (cause) {
      setError(cause instanceof FinancialInputError ? cause.message : "Srovnání období se nepodařilo spočítat. Zkus spustit backtest znovu."); setEditing(true);
    } finally { setComparing(false); }
  }

  return <main className={styles.page} data-backtesting-lab data-state={result ? "result" : "setup"} data-editing={editing} data-comparing={Boolean(comparison)} data-source={source}>
    <Link href="/lab" className={styles.textLink}><ArrowLeft size={16} aria-hidden="true" /> Lab</Link>
    <header className={styles.header}>
      <p className={styles.eyebrow}>Backtesting Lab · {result ? "Výsledek pokusu" : "Stroj času"}</p>
      <h1>Co by se stalo, kdyby…</h1>
      <p>Porovnej dvě cesty stejným obdobím. Uvidíš, kde skončily i jak kolísaly. Pak totéž zkusíš v jiném období.</p>
      <div className={styles.groundRules}><span data-testid="backtest-source-label"><FlaskConical size={16} aria-hidden="true" /> {resultCopy.label}</span><span>Cvičný kapitál ani portfolio se nemění.</span></div>
    </header>
    {result && <div className={styles.resultHead}>
      <div><h2 ref={heading} tabIndex={-1}>{result.strategy.name}</h2><p>{result.period} · {result.months} měsíců · Start {money(result, result.amount)}</p></div>
      <Button variant="secondary" onClick={() => editing ? setEditing(false) : edit()} aria-expanded={editing} aria-controls="backtest-configuration"><SlidersHorizontal size={16} aria-hidden="true" />{editing ? "Zavřít nastavení" : "Změnit nastavení"}</Button>
    </div>}
    {dirty && <p role="status" className={styles.notice}>Vstupy se změnily. Spusť backtest znovu a aktualizuj výsledek. Níže je stále výsledek předchozího nastavení.</p>}
    <div className={styles.setupLayout} hidden={!editing}>
      <form id="backtest-configuration" ref={configuration} onSubmit={(event) => { event.preventDefault(); void run(); }} className={styles.setup} aria-label="Nastavení backtestu" aria-busy={running}>
        <fieldset disabled={running} className={styles.formFields}>
          <legend className="sr-only">Nastavení pokusu</legend>
          {history && <section className={styles.formSection} aria-labelledby="source-heading">
            <h2 id="source-heading" className={styles.step}>1 · Data</h2>
            <fieldset className={styles.periods}><legend className="sr-only">Zdroj dat</legend>
              <label className={styles.period}><input type="radio" name="source" checked={source === "sample"} onChange={() => chooseSource("sample")} /><span><strong>Ukázkový vzorek</strong><small>Vymyšlené výnosy akcií, dluhopisů a hotovosti</small></span></label>
              <label className={styles.period}><input type="radio" name="source" checked={source === "history"} onChange={() => chooseSource("history")} /><span><strong>{history.sample ? `Ukázková řada ${history.symbol}` : `Cenová historie ${history.symbol}`}</strong><small>{history.sample ? "Ukázková data" : `Historická data · ${history.sourceName}`} · {history.firstYear}–{history.lastYear}</small></span></label>
            </fieldset>
          </section>}
          <section className={styles.formSection} aria-labelledby="approaches-heading">
            <h2 id="approaches-heading" className={styles.step}>{history ? 2 : 1} · Dvě cesty</h2>
            <label htmlFor="strategy" className={styles.label}>Zvolená strategie</label>
            <Select id="strategy" value={selected.id} onChange={(event) => setStrategy(event.target.value)}>{options.strategies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            {selectedKind === "fixed-weights" && <div className={styles.rebalance}><label htmlFor="rebalance" className={styles.label}>Rebalancování</label><Select id="rebalance" value={rebalance} onChange={(event) => setRebalance(event.target.value as RebalanceRule)}>{rebalanceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>}
            <div className={styles.approaches}>
              <div><h3><Badge>A</Badge>{selected.name}</h3><p>{selected.description}</p></div>
              <div><h3><Badge>B</Badge>{options.benchmarkName}</h3><p>{options.benchmarkDescription}</p></div>
            </div>
          </section>
          <section className={styles.formSection} aria-labelledby="period-heading">
            <h2 id="period-heading" className={styles.step}>{history ? 3 : 2} · Období</h2>
            <p className={styles.hint}>{copy.periodHint}</p>
            <fieldset className={styles.periods}><legend className="sr-only">Připravená období</legend>{options.periods.map((period) => <label key={period.id} className={styles.period}>
              <input type="radio" name="period" checked={periodId === period.id} onChange={() => { setStart(period.start); setEnd(period.end); }} />
              <span><strong>{period.name}</strong><small>{period.start === period.end ? `1–12/${period.start}` : `${period.start}–${period.end}`} · {(period.end - period.start + 1) * 12} měsíců</small></span>
            </label>)}</fieldset>
            <div className={styles.dates}><div><label htmlFor="start-year" className={styles.label}>Od ledna</label><Select id="start-year" value={start} onChange={(event) => setStart(Number(event.target.value))}>{options.years.map((year) => <option key={year}>{year}</option>)}</Select></div><div><label htmlFor="end-year" className={styles.label}>Do prosince</label><Select id="end-year" value={end} onChange={(event) => setEnd(Number(event.target.value))}>{options.years.map((year) => <option key={year}>{year}</option>)}</Select></div></div>
          </section>
          <section className={styles.formSection} aria-labelledby="amount-heading">
            <h2 id="amount-heading" className={styles.step}>{history ? 4 : 3} · Počáteční částka</h2>
            <div className={styles.amountRow}><FinanceInput id="backtest-amount" label="Počáteční částka" suffix={currency === "CZK" ? "Kč" : currency} value={amount} onValueChange={setAmount} /><p className={styles.hint}>{copy.amountHint}</p></div>
          </section>
          <section className={styles.formSection} aria-labelledby="prediction-heading">
            <h2 id="prediction-heading" className={styles.step}>{history ? 5 : 4} · Tvůj tip předem</h2>
            <h3 className={styles.predictionQuestion}>Která cesta skončí výš?</h3>
            <p className={styles.hint}>Tip je dobrovolný. Nic se nehodnotí, jen uvidíš, co tě překvapilo.</p>
            <fieldset className={styles.predictions}><legend className="sr-only">Tvůj tip předem</legend>{([
              ["strategy", "A", "Zvolená strategie"], ["benchmark", "B", options.benchmarkName], ["unknown", "?", "Nevím"],
            ] as const).map(([value, letter, label]) => <label key={value} className={styles.prediction}><Badge>{letter}</Badge><span>{label}</span><input type="radio" name="prediction" value={value} checked={prediction === value} onChange={() => setPrediction(value)} /></label>)}</fieldset>
          </section>
        </fieldset>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.runBar}><Button type="submit" loading={running} className={styles.primary}>{running ? "Počítám backtest…" : "Spustit backtest"}<ArrowRight size={18} aria-hidden="true" /></Button><p>{copy.runHint}</p></div>
        {running && <p role="status" className={styles.hint}>Počítám obě cesty pro zvolené období…</p>}
      </form>
      <aside className={styles.rail} aria-label="O pokusu">
        <DataCard key={source} copy={copy} />
        <div className={styles.learningLink}><BookOpen size={16} aria-hidden="true" /><h2>Proč záleží na rozložení?</h2><p>Lekce vysvětlí váhy portfolia a rozkládání rizika.</p><Link href="/learn/foundations/your-first-portfolio" className={styles.textLink}>Portfolio, váhy a diverzifikace <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </aside>
    </div>
    {result && <section className={styles.results} aria-label="Výsledek backtestu" aria-busy={running || comparing}>
      <BacktestChart data={result.points} strategyLabel={result.strategy.name} benchmarkLabel={result.benchmarkName} currency={result.currency} source={resultCopy.chart} initial={result.amount} />
      <Metrics result={result} />
      <PredictionResult result={result} copy={resultCopy} />
      <div className={styles.retryBar}><Button className={styles.primary} onClick={() => void compare()} disabled={running} loading={comparing}><RotateCcw size={18} aria-hidden="true" />{comparing ? "Počítám období…" : "Zkusit jiné období"}</Button><Link href="/learn/foundations/your-first-portfolio" className={styles.textLink}><BookOpen size={16} aria-hidden="true" />Zpět k lekci o portfoliu</Link></div>
      {comparison && <section className={styles.comparison} aria-labelledby="comparison-heading">
        <h2 ref={comparisonHeading} id="comparison-heading" tabIndex={-1}>Stejný pokus, jiná období.</h2>
        <p>{result.strategy.name} · Start {money(result, result.amount)} v každém pokusu · {copyFor(result).chart.tag}</p>
        <div className={styles.comparisonGrid}>{comparison.results.map((item, index) => <article key={item.period} className={styles.comparisonCard}>
          <h3>{comparison.names[index]}</h3><p>{item.period}</p>
          <BacktestChart data={item.points} strategyLabel={item.strategy.name} benchmarkLabel={item.benchmarkName} currency={item.currency} source={copyFor(item).chart} initial={item.amount} compact />
          <dl><div><dt>A · Konečná hodnota</dt><dd>{money(item, item.metrics.finalValue)}</dd></div><div><dt>B · {item.benchmarkName}</dt><dd>{money(item, item.benchmark.finalValue)}</dd></div><div><dt>Propad A / B</dt><dd>{formatPercentage(item.metrics.maxDrawdown)} / {formatPercentage(item.benchmark.maxDrawdown)}</dd></div></dl>
          <Button variant="secondary" onClick={() => { if (source !== sourceOf(item)) { chooseSource(sourceOf(item)); setStrategy(item.config.strategy); } setStart(item.config.start); setEnd(item.config.end); setEditing(true); requestAnimationFrame(() => configuration.current?.querySelector<HTMLSelectElement>("#start-year")?.focus()); }}>Vybrat toto období<ArrowRight size={16} aria-hidden="true" /></Button>
        </article>)}</div>
        <p className={styles.hint}>Každý graf má vlastní svislou škálu. Srovnávej i hodnoty a propady, ne jen tvar křivek. Žádné období není předpověď.</p>
      </section>}
      <details className={styles.quiz}><summary>Ověř si porozumění <ChevronDown size={18} aria-hidden="true" /></summary><section aria-labelledby="lab-question"><h2 id="lab-question">Která metrika ukazuje největší pokles od předchozího maxima?</h2><fieldset className={styles.quizOptions}><legend className="sr-only">Vyber metriku</legend>{["CAGR", "Největší propad", "Volatilita"].map((value) => <AnswerOption key={value} name="backtest-question" value={value} checked={answer === value} disabled={checked} onChange={setAnswer}>{value}</AnswerOption>)}</fieldset><Button variant="secondary" disabled={!answer || checked} onClick={() => setChecked(true)}>Zkontrolovat odpověď</Button>{checked && <p role="status" className={styles.feedback}>{answer === "Největší propad" ? "Správně." : "Zaměř se na největší propad."} Sleduje největší pokles od vrcholu ke dnu. CAGR popisuje začátek a konec; volatilita popisuje kolísání.</p>}</section></details>
    </section>}
    <details className={styles.methodology}><summary><Info size={16} aria-hidden="true" />Data a předpoklady výpočtu<ChevronDown size={16} aria-hidden="true" /></summary><div><DataNotes copy={resultCopy} />{resultCopy.method.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<p>CAGR používá počet měsíčních intervalů dělený 12. Volatilita je výběrová směrodatná odchylka (n − 1) násobená √12. Největší propad (max. drawdown) je kladná velikost ztráty; zahrnuje počáteční investici a hodnoty na konci měsíce. Nezachytí větší propady uvnitř měsíce.</p><p>Výnosy se aplikují v pořadí, bez znalosti budoucích měsíců. Chybějící, duplicitní, neseřazená nebo neplatná pozorování se odmítají. Výpočet období nezkracuje a data nedoplňuje. Zaokrouhluje se až při zobrazení.</p></div></details>
    <footer className={styles.footer}><strong>investi!</strong><p>Výukový nástroj, ne investiční doporučení. Ukázkový ani minulý výsledek nezaručuje budoucí výnosy.</p><Link href="/lab" className={styles.textLink}>Zpět do Labu<ArrowRight size={16} aria-hidden="true" /></Link></footer>
  </main>;
}
