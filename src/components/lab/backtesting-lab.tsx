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
import { benchmarkName, type BacktestHistoryView, type CostSettings, type HistoryBacktestResult } from "@/features/backtesting/catalog";
import { costImpact, parseCostRate, parseFixedFee } from "@/features/backtesting/costs";
import type { BacktestCosts } from "@/features/backtesting/spec";
import type { RebalanceRule } from "@/features/backtesting/spec";
import { FinancialInputError } from "@/features/finance/returns";
import { BACKTEST_RISK_FREE_RATE } from "@/features/lab/backtest";
import { formatPercentage } from "@/lib/formatters";
import { backtestPeriods, backtestStrategies, backtestYears, buildBacktestResult, formatBacktestMoney, formatBacktestMoneyDifference, formatCostRate, formatPercentagePoints, formatSharpeDifference, formatSharpeRatio, sampleBenchmarkName, viewWithCosts, type BacktestPrediction, type BacktestResult, type CostView } from "./backtest-model";
import { BacktestSimulation } from "./backtest-simulation";
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
const sameCosts = (a: CostSettings | null, b: CostSettings | null) => a === b || (a !== null && b !== null && a.rate === b.rate && a.fixedFee === b.fixedFee);
/** The setup's costs for the data notes; the server parses them again and reports invalid input. */
function draftCosts(settings: CostSettings | null): BacktestCosts | null {
  try { return settings && { rateBps: parseCostRate(settings.rate), fixedFee: parseFixedFee(settings.fixedFee) }; } catch { return null; }
}

function DataNotes({ copy }: { copy: BacktestSourceCopy }) {
  return <dl className={styles.dataRows}>{copy.notes.map((note) => <div key={note.term}><dt>{note.term}</dt><dd>{note.detail}</dd></div>)}</dl>;
}

function DataCard({ copy }: { copy: BacktestSourceCopy }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (details.current) details.current.open = window.matchMedia("(min-width: 1024px)").matches; }, []);
  return <details ref={details} className={styles.dataCard}><summary>Data pokusu <FlaskConical size={16} aria-hidden="true" /><ChevronDown size={16} aria-hidden="true" /></summary><p className={styles.hint}>{copy === sampleSourceCopy ? "Ukázková data · žádné historické tržní ceny." : `${copy.label} · jen cena, bez dividend.`}</p><DataNotes copy={copy} /></details>;
}

function Metrics({ result, onMethodology }: { result: BacktestResult; onMethodology: () => void }) {
  const { metrics: a, benchmark: b } = result;
  const ratio = (key: "totalReturn" | "cagr" | "maxDrawdown" | "volatility") => ({ value: formatPercentage(a[key]), benchmark: formatPercentage(b[key]), difference: formatPercentagePoints(a[key] - b[key]) });
  const rows: { label: string; detail: React.ReactNode; value: string; benchmark: string; difference: string }[] = [
    { label: "Konečná hodnota", detail: "Poslední bod grafu po zvoleném období.", value: money(result, a.finalValue), benchmark: money(result, b.finalValue), difference: formatBacktestMoneyDifference(a.finalValue - b.finalValue, result.currency) },
    { label: "Celkový výnos", detail: "Změna od počáteční částky za celé období. Není přepočtený na rok.", ...ratio("totalReturn") },
    { label: "CAGR", detail: "Přepočteno na rok: stálé roční tempo od začátku do konce. Ne výnos každého roku.", ...ratio("cagr") },
    { label: "Největší propad", detail: "Největší pokles od předchozího maxima, měřený na konci měsíce (max. drawdown).", ...ratio("maxDrawdown") },
    { label: "Volatilita", detail: "Anualizované kolísání měsíčních výnosů. Ne každý typ rizika.", ...ratio("volatility") },
    { label: "Sharpeho poměr", detail: <>Anualizovaný výnos nad bezrizikovou sazbou ({formatPercentage(a.riskFreeRate)}) na jednotku volatility (Sharpe ratio). Vyšší znamená víc výnosu za stejné kolísání. Za krátké období je nestabilní. <a href="#backtest-methodology" className={styles.inlineLink} onClick={onMethodology}>Jak se počítá</a></>, value: formatSharpeRatio(a.sharpeRatio), benchmark: formatSharpeRatio(b.sharpeRatio), difference: formatSharpeDifference(a.sharpeRatio, b.sharpeRatio) },
  ];
  return <section className={styles.metrics} aria-labelledby="journey-heading">
    <h2 id="journey-heading">Jak se ta cesta cítila</h2>
    <p>Konečná hodnota je jen poslední bod grafu. Porovnej i kolísání a propady. Rozdíl je A minus B. U procent je v procentních bodech (p. b.).</p>
    <dl className={styles.metricRows}>{rows.map((row) => {
      const slug = row.label.toLowerCase().replaceAll(" ", "-");
      return <div key={row.label} className={styles.metricRow}>
        <dt><strong>{row.label}</strong><span>{row.detail}</span></dt>
        <dd><span className={styles.metricSeries}><Badge>A</Badge> {result.strategy.name}</span><strong data-testid={`metric-${slug}`}>{row.value}</strong></dd>
        <dd><span className={styles.metricSeries}><Badge>B</Badge> {result.benchmarkName}</span><strong data-testid={`benchmark-${slug}`}>{row.benchmark}</strong></dd>
        <dd className={styles.metricDifference}><span className={styles.metricSeries}>Rozdíl A − B</span><strong data-testid={`difference-${slug}`}>{row.difference}</strong></dd>
      </div>;
    })}</dl>
  </section>;
}

function explanation(result: BacktestResult) {
  if (isHistory(result)) {
    const symbol = result.source.symbol;
    const other = result.source.benchmark.symbol;
    const benchmark = other === symbol
      ? `Benchmark koupí ${symbol} jednou na začátku a drží ho celou dobu.`
      : `Benchmark koupí jednou na začátku jiný instrument, ${other}, a drží ho celou dobu. Rozdíl proto ukazuje i rozdíl mezi ${symbol} a ${other}, nejen pravidlo strategie.`;
    if (result.strategy.id === "trend-sma") return `Filtr držel ${symbol} ${result.monthsInvested} z ${result.months} měsíců a ${result.switches}× přepnul mezi ${symbol} a hotovostí. Rozhoduje vždy podle uzávěrky předchozího měsíce, takže na rychlý obrat trhu reaguje se zpožděním. ${benchmark}`;
    const rule = result.config.rebalance === "none" ? `Mix se nerebalancoval, takže podíl ${symbol} se posouval s cenou.` : `Mix se ${result.rebalances}× vrátil k vahám 60 / 40.`;
    return `Mix drží část peněz v hotovosti bez úroku. V propadech proto ztrácí méně, v růstu méně získá. ${rule} ${benchmark}`;
  }
  if (result.strategy.id === "stocks") return "Vybraná strategie používá stejný akciový vzorek jako benchmark. Obě křivky proto mají totožné výnosy i propady.";
  if (result.strategy.id === "bonds") return "Dluhopisový a akciový vzorek mají různé měsíční výnosy. Ty se postupně násobí, takže rozhoduje celá cesta, ne jen poslední měsíc.";
  return "Mix kombinuje akcie, dluhopisy a hotovost. Každý měsíc používá váhy 60 / 30 / 10, zatímco benchmark zůstává celý v akciovém vzorku. Rozdílné měsíční výnosy se postupně násobí.";
}

function costLesson(result: HistoryBacktestResult, impact: number) {
  const { strategy: a } = result.trading;
  const paid = money(result, a.costs);
  const compounding = a.costs === 0 ? "" : -impact > a.costs
    ? ` Konečnou hodnotu snížily o víc než ${paid}, které stály samotné poplatky: zaplacené peníze už dál nevydělávaly.`
    : ` Konečnou hodnotu snížily o méně než ${paid}, které stály samotné poplatky: peníze na poplatky by v tomto období jinak část hodnoty ztratily.`;
  if (result.strategy.id === "trend-sma") return `Každé přepnutí mezi ${result.source.symbol} a hotovostí prodá nebo koupí celou částku, a to je obchod s poplatkem. Filtr obchodoval ${a.trades}×, benchmark B jen jednou, při nákupu.${compounding}`;
  const trades = result.config.rebalance === "none" ? "Mix se nerebalancoval, takže zaplatil jen nákup na začátku, stejně jako benchmark B." : `Každé rebalancování je obchod a každý obchod něco stojí. Mix obchodoval ${a.trades}× (nákup na začátku a ${result.rebalances}× rebalancování), benchmark B jen jednou, při nákupu. Měsíční rebalancování obchoduje zhruba 12× častěji než roční, takže zaplatí víc.`;
  return `${trades}${compounding}`;
}

function CostSummary({ result }: { result: HistoryBacktestResult }) {
  if (!result.withoutCosts) return null;
  const a = costImpact(result.metrics, result.withoutCosts.metrics);
  const b = costImpact(result.benchmark, result.withoutCosts.benchmark);
  const { strategy: tradesA, benchmark: tradesB } = result.trading;
  const fee = result.costs.fixedFee > 0 ? ` + ${money(result, result.costs.fixedFee)} za obchod` : "";
  const rows: { label: string; detail?: string; testId: string; value: string; benchmark: string }[] = [
    { label: "Obchody", detail: "Každý nákup nebo prodej jednoho instrumentu.", testId: "trades", value: String(tradesA.trades), benchmark: String(tradesB.trades) },
    { label: "Obrat", detail: "Hodnota všech nákupů a prodejů dohromady (turnover).", testId: "turnover", value: money(result, tradesA.turnover), benchmark: money(result, tradesB.turnover) },
    { label: "Zaplacené náklady", testId: "paid", value: money(result, tradesA.costs), benchmark: money(result, tradesB.costs) },
    { label: "Dopad na konečnou hodnotu", testId: "final-value", value: formatBacktestMoneyDifference(a.finalValue, result.currency), benchmark: formatBacktestMoneyDifference(b.finalValue, result.currency) },
    { label: "Dopad na celkový výnos", testId: "total-return", value: formatPercentagePoints(a.totalReturn), benchmark: formatPercentagePoints(b.totalReturn) },
    { label: "Dopad na CAGR", detail: "Kolik procentních bodů ročně náklady ubraly.", testId: "cagr", value: formatPercentagePoints(a.cagr), benchmark: formatPercentagePoints(b.cagr) },
    { label: "Dopad na Sharpeho poměr", testId: "sharpe", value: formatSharpeDifference(result.metrics.sharpeRatio, result.withoutCosts.metrics.sharpeRatio), benchmark: formatSharpeDifference(result.benchmark.sharpeRatio, result.withoutCosts.benchmark.sharpeRatio) },
  ];
  return <section className={styles.metrics} aria-labelledby="costs-heading">
    <h2 id="costs-heading">Co stály náklady</h2>
    <p className={styles.costHeadline} data-testid="cost-headline">Náklady tě u strategie A stály {money(result, -a.finalValue)} ({formatPercentagePoints(-a.cagr, { signed: false })} ročně).</p>
    <p>{formatCostRate(result.costs.rateBps)} z hodnoty každého obchodu{fee}. Dopad je výsledek s náklady minus výsledek bez nich, na stejných cenách. Bez nákladů by A skončila na {money(result, result.withoutCosts.metrics.finalValue)}.</p>
    <dl className={styles.metricRows}>{rows.map((row) => <div key={row.label} className={`${styles.metricRow} ${styles.costRow}`}>
      <dt><strong>{row.label}</strong>{row.detail && <span>{row.detail}</span>}</dt>
      <dd><span className={styles.metricSeries}><Badge>A</Badge> {result.strategy.name}</span><strong data-testid={`cost-${row.testId}`}>{row.value}</strong></dd>
      <dd><span className={styles.metricSeries}><Badge>B</Badge> {result.benchmarkName}</span><strong data-testid={`cost-benchmark-${row.testId}`}>{row.benchmark}</strong></dd>
    </div>)}</dl>
    <div className={styles.costLesson}>
      <h3>Proč víc obchodů stojí víc</h3>
      <p>{costLesson(result, a.finalValue)}</p>
      <p>Prodej na konci nepočítáme. I ten by stál poplatek.</p>
    </div>
  </section>;
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
  benchmarkName: sampleBenchmarkName,
  benchmarkDescription: "Celá částka jednou koupí akciový vzorek na začátku a drží ho. Žádné rebalancování ani obchody. Stejná počáteční částka i období.",
};

function historyOptions(history: BacktestHistoryView, benchmarkId?: string): SourceOptions {
  const benchmark = history.benchmarks.find((item) => item.instrumentId === benchmarkId) ?? history.benchmarks[0];
  return {
    strategies: history.strategies,
    periods: history.periods,
    years: Array.from({ length: history.lastYear - history.firstYear + 1 }, (_, index) => history.firstYear + index),
    benchmarkName: benchmarkName(benchmark.symbol),
    benchmarkDescription: `Celá částka jednou koupí ${benchmark.symbol} (${benchmark.name}) na začátku a drží ho. Žádné rebalancování ani obchody. Stejné období, počáteční částka, měna (${history.currency}) i výnos jen z ceny.`,
  };
}

export function BacktestingLab({ history = null }: { history?: BacktestHistoryView | null }) {
  const [source, setSource] = useState<BacktestSourceKind>("sample");
  const [strategy, setStrategy] = useState("mixed");
  const [benchmark, setBenchmark] = useState(history?.benchmarks[0].instrumentId ?? "");
  const [rebalance, setRebalance] = useState<RebalanceRule>("annual");
  const [start, setStart] = useState(2015), [end, setEnd] = useState(2025);
  const [amount, setAmount] = useState("100000");
  const [costsOn, setCostsOn] = useState(false);
  const [costRate, setCostRate] = useState("0,1"), [fixedFee, setFixedFee] = useState("0");
  const [costView, setCostView] = useState<CostView>("with");
  const [prediction, setPrediction] = useState<BacktestPrediction>();
  const [result, setResult] = useState<BacktestResult>();
  const [editing, setEditing] = useState(true);
  const [running, setRunning] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string>();
  const [comparison, setComparison] = useState<{ results: BacktestResult[]; names: string[] }>();
  /** Counts finished runs, so a new result starts the simulation step afresh. */
  const [runs, setRuns] = useState(0);
  const [answer, setAnswer] = useState<string>(), [checked, setChecked] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const configuration = useRef<HTMLFormElement>(null);
  const comparisonHeading = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const methodology = useRef<HTMLDetailsElement>(null);
  const options = source === "history" && history ? historyOptions(history, benchmark) : sampleOptions;
  const selected = options.strategies.find((item) => item.id === strategy) ?? options.strategies[0];
  const selectedKind = source === "history" ? history?.strategies.find((item) => item.id === selected.id)?.kind : undefined;
  const selectedBenchmark = history?.benchmarks.find((item) => item.instrumentId === benchmark) ?? history?.benchmarks[0];
  const costSettings: CostSettings | null = costsOn ? { rate: costRate, fixedFee } : null;
  const copy = source === "history" && history ? historySourceCopy(history, { benchmark: selectedBenchmark, costs: draftCosts(costSettings) }) : sampleSourceCopy;
  const shown = result && viewWithCosts(result, costView);
  const resultCopy = result ? copyFor(result, costView) : copy;
  const currency = source === "history" && history ? history.currency : "CZK";
  const dirty = Boolean(result && (source !== sourceOf(result) || selected.id !== result.config.strategy || start !== result.config.start || end !== result.config.end || amount !== result.config.amount || (isHistory(result) && (selectedBenchmark?.instrumentId !== result.config.benchmark || !sameCosts(costSettings, result.config.costs) || (selectedKind === "fixed-weights" && rebalance !== result.config.rebalance)))));
  const steps = [...(history ? ["source"] : []), "approaches", "period", "amount", ...(source === "history" && history ? ["costs"] : []), "prediction"];
  const step = (id: string) => steps.indexOf(id) + 1;
  const periodId = options.periods.find((period) => period.start === start && period.end === end)?.id ?? "custom";

  /** Copy for a result in a view: with its costs, or none in the view without them. */
  function copyFor(item: BacktestResult, view: CostView = "with") {
    return isHistory(item) && history ? historySourceCopy(history, { years: { start: item.config.start, end: item.config.end }, source: item.source, costs: item.withoutCosts && view === "with" ? item.costs : null }) : sampleSourceCopy;
  }

  function chooseSource(next: BacktestSourceKind) {
    const nextOptions = next === "history" && history ? historyOptions(history) : sampleOptions;
    setSource(next);
    setStrategy(nextOptions.strategies[0].id);
    if (history) setBenchmark(history.benchmarks[0].instrumentId);
    setStart(nextOptions.years[0]); setEnd(nextOptions.years.at(-1)!);
    setAmount(next === "history" ? "10000" : "100000");
    setError(undefined);
  }

  async function calculate(periods: readonly { start: number; end: number }[], config: { strategy: string; benchmark: string; amount: string; rebalance: RebalanceRule; costs: CostSettings | null }, kind: BacktestSourceKind): Promise<BacktestResult[]> {
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
      const [next] = await calculate([{ start, end }], { strategy: selected.id, benchmark: selectedBenchmark?.instrumentId ?? "", amount, rebalance, costs: costSettings }, source);
      setResult({ ...next, prediction });
      setRuns((count) => count + 1);
      setCostView("with");
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
      const results = await calculate(presets, { strategy: result.config.strategy, benchmark: isHistory(result) ? result.config.benchmark : "", amount: result.config.amount, rebalance: isHistory(result) ? result.config.rebalance : "annual", costs: isHistory(result) ? result.config.costs : null }, kind);
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
            <h2 id="source-heading" className={styles.step}>{step("source")} · Data</h2>
            <fieldset className={styles.periods}><legend className="sr-only">Zdroj dat</legend>
              <label className={styles.period}><input type="radio" name="source" checked={source === "sample"} onChange={() => chooseSource("sample")} /><span><strong>Ukázkový vzorek</strong><small>Vymyšlené výnosy akcií, dluhopisů a hotovosti</small></span></label>
              <label className={styles.period}><input type="radio" name="source" checked={source === "history"} onChange={() => chooseSource("history")} /><span><strong>{history.sample ? `Ukázková řada ${history.symbol}` : `Cenová historie ${history.symbol}`}</strong><small>{history.sample ? "Ukázková data" : `Historická data · ${history.sourceName}`} · {history.firstYear}–{history.lastYear}</small></span></label>
            </fieldset>
          </section>}
          <section className={styles.formSection} aria-labelledby="approaches-heading">
            <h2 id="approaches-heading" className={styles.step}>{step("approaches")} · Dvě cesty</h2>
            <label htmlFor="strategy" className={styles.label}>Zvolená strategie</label>
            <Select id="strategy" value={selected.id} onChange={(event) => setStrategy(event.target.value)}>{options.strategies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            {selectedKind === "fixed-weights" && <div className={styles.rebalance}><label htmlFor="rebalance" className={styles.label}>Rebalancování</label><Select id="rebalance" value={rebalance} onChange={(event) => setRebalance(event.target.value as RebalanceRule)}>{rebalanceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>}
            {source === "history" && history && <div className={styles.rebalance}><label htmlFor="benchmark" className={styles.label}>Benchmark B · koupit a držet</label><Select id="benchmark" value={selectedBenchmark?.instrumentId} onChange={(event) => setBenchmark(event.target.value)}>{history.benchmarks.map((item) => <option key={item.instrumentId} value={item.instrumentId}>{benchmarkName(item.symbol)}</option>)}</Select></div>}
            <div className={styles.approaches}>
              <div><h3><Badge>A</Badge>{selected.name}</h3><p>{selected.description}</p></div>
              <div><h3><Badge>B</Badge>{options.benchmarkName}</h3><p>{options.benchmarkDescription}</p></div>
            </div>
          </section>
          <section className={styles.formSection} aria-labelledby="period-heading">
            <h2 id="period-heading" className={styles.step}>{step("period")} · Období</h2>
            <p className={styles.hint}>{copy.periodHint}</p>
            <fieldset className={styles.periods}><legend className="sr-only">Připravená období</legend>{options.periods.map((period) => <label key={period.id} className={styles.period}>
              <input type="radio" name="period" checked={periodId === period.id} onChange={() => { setStart(period.start); setEnd(period.end); }} />
              <span><strong>{period.name}</strong><small>{period.start === period.end ? `1–12/${period.start}` : `${period.start}–${period.end}`} · {(period.end - period.start + 1) * 12} měsíců</small></span>
            </label>)}</fieldset>
            <div className={styles.dates}><div><label htmlFor="start-year" className={styles.label}>Od ledna</label><Select id="start-year" value={start} onChange={(event) => setStart(Number(event.target.value))}>{options.years.map((year) => <option key={year}>{year}</option>)}</Select></div><div><label htmlFor="end-year" className={styles.label}>Do prosince</label><Select id="end-year" value={end} onChange={(event) => setEnd(Number(event.target.value))}>{options.years.map((year) => <option key={year}>{year}</option>)}</Select></div></div>
          </section>
          <section className={styles.formSection} aria-labelledby="amount-heading">
            <h2 id="amount-heading" className={styles.step}>{step("amount")} · Počáteční částka</h2>
            <div className={styles.amountRow}><FinanceInput id="backtest-amount" label="Počáteční částka" suffix={currency === "CZK" ? "Kč" : currency} value={amount} onValueChange={setAmount} /><p className={styles.hint}>{copy.amountHint}</p></div>
          </section>
          {source === "history" && history && <section className={styles.formSection} aria-labelledby="costs-setup-heading">
            <h2 id="costs-setup-heading" className={styles.step}>{step("costs")} · Náklady obchodů</h2>
            <p className={styles.hint}>Každý obchod něco stojí. Strategie platí při nákupu na začátku a při každém rebalancování nebo přepnutí, benchmark B jen při nákupu.</p>
            <fieldset className={styles.periods}><legend className="sr-only">Náklady obchodů</legend>
              <label className={styles.period}><input type="radio" name="costs" checked={!costsOn} onChange={() => setCostsOn(false)} /><span><strong>Bez nákladů</strong><small>Obchody nic nestojí</small></span></label>
              <label className={styles.period}><input type="radio" name="costs" checked={costsOn} onChange={() => setCostsOn(true)} /><span><strong>Započítat náklady</strong><small>Porovnáš výsledek s náklady a bez nich</small></span></label>
            </fieldset>
            {costsOn && <div className={styles.dates}>
              <FinanceInput id="cost-rate" label="Poplatek z objemu obchodu" mode="percentage" value={costRate} onValueChange={setCostRate} hint="Například 0,1 %. Nejvýš 2 %." />
              <FinanceInput id="cost-fee" label="Fixní poplatek za obchod" suffix={currency} value={fixedFee} onValueChange={setFixedFee} hint={`V ${currency}. Bez fixního poplatku nech 0.`} />
            </div>}
          </section>}
          <section className={styles.formSection} aria-labelledby="prediction-heading">
            <h2 id="prediction-heading" className={styles.step}>{step("prediction")} · Tvůj tip předem</h2>
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
    {result && shown && <section className={styles.results} aria-label="Výsledek backtestu" aria-busy={running || comparing}>
      {isHistory(result) && result.withoutCosts && <fieldset className={styles.costView}><legend>Zobrazit výsledek</legend>
        {([["with", "S náklady", `${formatCostRate(result.costs.rateBps)} z obchodu${result.costs.fixedFee > 0 ? ` + ${money(result, result.costs.fixedFee)}` : ""}`], ["without", "Bez nákladů", "Stejné ceny, obchody zdarma"]] as const).map(([value, label, detail]) => <label key={value} className={styles.period}><input type="radio" name="cost-view" value={value} checked={costView === value} onChange={() => setCostView(value)} /><span><strong>{label}</strong><small>{detail}</small></span></label>)}
      </fieldset>}
      <BacktestChart data={shown.points} strategyLabel={shown.strategy.name} benchmarkLabel={shown.benchmarkName} currency={shown.currency} source={resultCopy.chart} initial={shown.amount} />
      <Metrics result={shown} onMethodology={() => { if (methodology.current) methodology.current.open = true; }} />
      {isHistory(result) && <CostSummary result={result} />}
      <PredictionResult result={shown} copy={resultCopy} />
      <div className={styles.retryBar}><Button className={styles.primary} onClick={() => void compare()} disabled={running} loading={comparing}><RotateCcw size={18} aria-hidden="true" />{comparing ? "Počítám období…" : "Zkusit jiné období"}</Button><Link href="/learn/foundations/your-first-portfolio" className={styles.textLink}><BookOpen size={16} aria-hidden="true" />Zpět k lekci o portfoliu</Link></div>
      {comparison && <section className={styles.comparison} aria-labelledby="comparison-heading">
        <h2 ref={comparisonHeading} id="comparison-heading" tabIndex={-1}>Stejný pokus, jiná období.</h2>
        <p>{result.strategy.name} · Start {money(result, result.amount)} v každém pokusu · {copyFor(result, costView).chart.tag}</p>
        <div className={styles.comparisonGrid}>{comparison.results.map((item) => [item, viewWithCosts(item, costView)] as const).map(([original, item], index) => <article key={item.period} className={styles.comparisonCard}>
          <h3>{comparison.names[index]}</h3><p>{item.period}</p>
          <BacktestChart data={item.points} strategyLabel={item.strategy.name} benchmarkLabel={item.benchmarkName} currency={item.currency} source={copyFor(original, costView).chart} initial={item.amount} compact />
          <dl><div><dt>A · Konečná hodnota</dt><dd>{money(item, item.metrics.finalValue)}</dd></div><div><dt>B · {item.benchmarkName}</dt><dd>{money(item, item.benchmark.finalValue)}</dd></div><div><dt>Propad A / B</dt><dd>{formatPercentage(item.metrics.maxDrawdown)} / {formatPercentage(item.benchmark.maxDrawdown)}</dd></div></dl>
          <Button variant="secondary" onClick={() => { if (source !== sourceOf(item)) { chooseSource(sourceOf(item)); setStrategy(item.config.strategy); if (isHistory(item)) setBenchmark(item.config.benchmark); } setStart(item.config.start); setEnd(item.config.end); setEditing(true); requestAnimationFrame(() => configuration.current?.querySelector<HTMLSelectElement>("#start-year")?.focus()); }}>Vybrat toto období<ArrowRight size={16} aria-hidden="true" /></Button>
        </article>)}</div>
        <p className={styles.hint}>Každý graf má vlastní svislou škálu. Srovnávej i hodnoty a propady, ne jen tvar křivek. Žádné období není předpověď.</p>
      </section>}
      <BacktestSimulation key={`${runs}-${costView}`} values={shown.points.map((point) => point.value)} basis={`${shown.strategy.name} · ${shown.period}${isHistory(result) && result.withoutCosts ? costView === "with" ? " · s náklady obchodů" : " · bez nákladů obchodů" : ""}`} sourceTag={resultCopy.chart.tag} currency={shown.currency} amount={shown.amount} />
      <details className={styles.quiz}><summary>Ověř si porozumění <ChevronDown size={18} aria-hidden="true" /></summary><section aria-labelledby="lab-question"><h2 id="lab-question">Která metrika ukazuje největší pokles od předchozího maxima?</h2><fieldset className={styles.quizOptions}><legend className="sr-only">Vyber metriku</legend>{["CAGR", "Největší propad", "Volatilita"].map((value) => <AnswerOption key={value} name="backtest-question" value={value} checked={answer === value} disabled={checked} onChange={setAnswer}>{value}</AnswerOption>)}</fieldset><Button variant="secondary" disabled={!answer || checked} onClick={() => setChecked(true)}>Zkontrolovat odpověď</Button>{checked && <p role="status" className={styles.feedback}>{answer === "Největší propad" ? "Správně." : "Zaměř se na největší propad."} Sleduje největší pokles od vrcholu ke dnu. CAGR popisuje začátek a konec; volatilita popisuje kolísání.</p>}</section></details>
    </section>}
    <details ref={methodology} id="backtest-methodology" className={styles.methodology}><summary><Info size={16} aria-hidden="true" />Data a předpoklady výpočtu<ChevronDown size={16} aria-hidden="true" /></summary><div><DataNotes copy={resultCopy} />{resultCopy.method.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<p>Celkový výnos je konečná hodnota ÷ počáteční částka − 1 za celé období, bez přepočtu na rok. CAGR je totéž přepočtené na rok: používá počet měsíčních intervalů dělený 12. Volatilita je výběrová směrodatná odchylka (n − 1) měsíčních výnosů násobená √12. Největší propad (max. drawdown) je kladná velikost ztráty; zahrnuje počáteční investici a hodnoty na konci měsíce. Nezachytí větší propady uvnitř měsíce.</p><p>Sharpeho poměr (Sharpe ratio) = průměrný měsíční nadvýnos × 12 ÷ (výběrová směrodatná odchylka nadvýnosů × √12). Nadvýnos je měsíční výnos minus měsíční bezriziková sazba. Použitá sazba je {formatPercentage(result?.metrics.riskFreeRate ?? BACKTEST_RISK_FREE_RATE)} ročně: stejně jako hotovost v backtestu nic nevydělává. Není to tržní sazba; s kladnou sazbou by vyšel nižší. Bez kolísání nebo s méně než 12 měsíci je Sharpeho poměr nedostupný. Nad krátkým obdobím je nestabilní: pár měsíců ho může výrazně posunout.</p><p>Výnosy se aplikují v pořadí, bez znalosti budoucích měsíců. Chybějící, duplicitní, neseřazená nebo neplatná pozorování se odmítají. Výpočet období nezkracuje a data nedoplňuje. Zaokrouhluje se až při zobrazení.</p></div></details>
    <footer className={styles.footer}><strong>investi!</strong><p>Výukový nástroj, ne investiční doporučení. Ukázkový ani minulý výsledek nezaručuje budoucí výnosy.</p><Link href="/lab" className={styles.textLink}>Zpět do Labu<ArrowRight size={16} aria-hidden="true" /></Link></footer>
  </main>;
}
