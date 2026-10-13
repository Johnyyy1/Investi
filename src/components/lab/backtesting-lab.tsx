"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, FlaskConical, Info, RotateCcw, SlidersHorizontal } from "lucide-react";
import { FinanceInput } from "@/components/learning/finance-input";
import { AnswerOption } from "@/components/learning/answer-option";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import { FinancialInputError } from "@/features/finance/returns";
import { formatPercentage } from "@/lib/formatters";
import { backtestPeriods, backtestStrategies, backtestYears, buildBacktestResult, formatBacktestMoney as money, type BacktestPrediction, type BacktestResult } from "./backtest-model";
import styles from "./backtesting-lab.module.css";

const BacktestChart = dynamic(() => import("./backtest-chart").then((module) => module.BacktestChart), {
  loading: () => <div role="status" className={styles.chartLoading}>Načítám graf…<div className={styles.skeleton} /></div>,
});

function Badge({ children }: { children: React.ReactNode }) {
  return <span className={styles.badge}>{children}</span>;
}

function DataNotes() {
  return <dl className={styles.dataRows}>
    <div><dt>Zdroj</dt><dd>Syntetický měsíční vzorek vytvořený pro investi. Žádná tržní pozorování.</dd></div>
    <div><dt>Dostupné období</dt><dd>Leden 2015 – prosinec 2025 · 132 měsíčních výnosů</dd></div>
    <div><dt>Výnosy a rozložení</dt><dd>Model celkového výnosu s reinvesticí. Mix se každý měsíc vrací k cílovým vahám.</dd></div>
    <div><dt>Měna</dt><dd>Kč je zobrazovací jednotka. Výpočet neobsahuje převod měny ani FX.</dd></div>
    <div><dt>Co v tom není</dt><dd>Další vklady, výběry, poplatky, daně, inflace ani měnové vlivy.</dd></div>
  </dl>;
}

function DataCard() {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (details.current) details.current.open = window.matchMedia("(min-width: 1024px)").matches; }, []);
  return <details ref={details} className={styles.dataCard}><summary>Data pokusu <FlaskConical size={16} aria-hidden="true" /><ChevronDown size={16} aria-hidden="true" /></summary><p className={styles.hint}>Ukázková data · žádné historické tržní ceny.</p><DataNotes /></details>;
}

function Metrics({ result }: { result: BacktestResult }) {
  const rows = [
    { label: "Konečná hodnota", detail: "Poslední bod grafu po zvoleném období.", value: money(result.metrics.finalValue), benchmark: money(result.benchmark.finalValue) },
    { label: "CAGR", detail: "Stálé roční tempo od začátku do konce. Ne výnos každého roku.", value: formatPercentage(result.metrics.cagr), benchmark: formatPercentage(result.benchmark.cagr) },
    { label: "Maximální drawdown", detail: "Největší pokles od předchozího maxima, měřený na konci měsíce.", value: formatPercentage(result.metrics.maxDrawdown), benchmark: formatPercentage(result.benchmark.maxDrawdown) },
    { label: "Volatilita", detail: "Anualizované kolísání měsíčních výnosů. Ne každý typ rizika.", value: formatPercentage(result.metrics.volatility), benchmark: formatPercentage(result.benchmark.volatility) },
  ];
  return <section className={styles.metrics} aria-labelledby="journey-heading">
    <h2 id="journey-heading">Jak se ta cesta cítila</h2>
    <p>Konečná hodnota je jen poslední bod grafu. Porovnej i kolísání a propady.</p>
    <dl className={styles.metricRows}>{rows.map((row) => <div key={row.label} className={styles.metricRow}>
      <dt><strong>{row.label}</strong><span>{row.detail}</span></dt>
      <dd><span className={styles.metricSeries}><Badge>A</Badge> {result.strategy.name}</span><strong data-testid={`metric-${row.label.toLowerCase().replaceAll(" ", "-")}`}>{row.value}</strong></dd>
      <dd><span className={styles.metricSeries}><Badge>B</Badge> Akciový vzorek</span><strong>{row.benchmark}</strong></dd>
    </div>)}</dl>
  </section>;
}

function PredictionResult({ result }: { result: BacktestResult }) {
  const equal = result.metrics.finalValue === result.benchmark.finalValue;
  const higher = result.metrics.finalValue > result.benchmark.finalValue ? "A" : "B";
  const smaller = result.metrics.maxDrawdown === result.benchmark.maxDrawdown ? "Stejný u obou" : result.metrics.maxDrawdown < result.benchmark.maxDrawdown ? "A · Zvolená strategie" : "B · Akciový vzorek";
  const prediction = result.prediction === "strategy" ? "A" : result.prediction === "benchmark" ? "B" : undefined;
  return <section className={styles.reflection} aria-labelledby="prediction-result-heading">
    <h2 id="prediction-result-heading">{equal ? "Obě cesty skončily stejně." : `V tomhle období skončil výš ${higher}.`}</h2>
    <p>{prediction ? `Tvůj tip byl ${prediction}. ` : result.prediction === "unknown" ? "Předem jsi zvolil/a „Nevím“. " : "Tentokrát bez tipu předem. "}Tip se nehodnotí. Výsledek popisuje jen zvolený syntetický vzorek.</p>
    <div className={styles.reflectionBody}>
      <dl className={styles.outcomes}>
        <div><dt>Na konci výš</dt><dd>{equal ? "Stejné hodnoty" : `${higher} · o ${money(Math.abs(result.metrics.finalValue - result.benchmark.finalValue))}`}</dd></div>
        <div><dt>Menší propad cestou</dt><dd>{smaller}</dd></div>
        <div><dt>Vloženo na začátku</dt><dd>{money(result.amount)} do každé cesty. Žádné další vklady.</dd></div>
      </dl>
      <div className={styles.explanation}>
        <h3>Proč se výsledky liší</h3>
        <p>{result.strategy.id === "stocks" ? "Zvolil/a jsi stejný akciový vzorek jako benchmark. Obě křivky proto mají totožné výnosy i propady." : result.strategy.id === "bonds" ? "Dluhopisový a akciový vzorek mají různé měsíční výnosy. Ty se postupně násobí, takže rozhoduje celá cesta, ne jen poslední měsíc." : "Mix kombinuje akcie, dluhopisy a hotovost. Každý měsíc používá váhy 60 / 30 / 10, zatímco benchmark zůstává celý v akciovém vzorku. Rozdílné měsíční výnosy se postupně násobí."}</p>
        <p>Vyšší konečná hodnota sama o sobě neříká, jak náročná byla cesta. Zkus stejné rozložení v jiném období. Z těchto výsledků nelze předpovídat budoucnost.</p>
      </div>
    </div>
  </section>;
}

export function BacktestingLab() {
  const [strategy, setStrategy] = useState("mixed");
  const [start, setStart] = useState(2015), [end, setEnd] = useState(2025);
  const [amount, setAmount] = useState("100000");
  const [prediction, setPrediction] = useState<BacktestPrediction>();
  const [result, setResult] = useState<BacktestResult>();
  const [editing, setEditing] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [comparison, setComparison] = useState<BacktestResult[]>();
  const [answer, setAnswer] = useState<string>(), [checked, setChecked] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const configuration = useRef<HTMLFormElement>(null);
  const comparisonHeading = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const selected = backtestStrategies.find((item) => item.id === strategy)!;
  const dirty = Boolean(result && (strategy !== result.config.strategy || start !== result.config.start || end !== result.config.end || amount !== result.config.amount));
  const periodId = backtestPeriods.find((period) => period.start === start && period.end === end)?.id ?? "custom";

  async function run() {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true); setError(undefined);
    // Yield to paint the actual running state; no artificial network delay.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      const next = buildBacktestResult({ strategy, start, end, amount });
      setResult({ ...next, prediction });
      setEditing(false); setComparison(undefined); setAnswer(undefined); setChecked(false);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (cause) {
      setError(cause instanceof FinancialInputError ? cause.message : "Vzorek se nepodařilo spočítat. Zkontroluj nastavení a zkus to znovu.");
    } finally { inFlight.current = false; setRunning(false); }
  }
  function edit() {
    setEditing(true);
    requestAnimationFrame(() => configuration.current?.querySelector<HTMLSelectElement>("select")?.focus());
  }
  function compare() {
    if (!result) return;
    try {
      setComparison(backtestPeriods.map((period) => ({ ...buildBacktestResult({ ...result.config, start: period.start, end: period.end }), prediction: result.prediction })));
      requestAnimationFrame(() => comparisonHeading.current?.focus());
    } catch { setError("Srovnání období se nepodařilo spočítat. Zkus spustit backtest znovu."); setEditing(true); }
  }

  return <main className={styles.page} data-backtesting-lab data-state={result ? "result" : "setup"} data-editing={editing} data-comparing={Boolean(comparison)}>
    <Link href="/lab" className={styles.textLink}><ArrowLeft size={16} aria-hidden="true" /> Lab</Link>
    <header className={styles.header}>
      <p className={styles.eyebrow}>Backtesting Lab · {result ? "Výsledek pokusu" : "Stroj času"}</p>
      <h1>Co by se stalo, kdyby…</h1>
      <p>Porovnej dvě cesty stejným obdobím. Uvidíš, kde skončily i jak kolísaly. Pak totéž zkusíš v jiném období.</p>
      <div className={styles.groundRules}><span><FlaskConical size={16} aria-hidden="true" /> Ukázková data · syntetické výnosy</span><span>Practice Capital ani portfolio se nemění.</span></div>
    </header>
    {result && <div className={styles.resultHead}>
      <div><h2 ref={heading} tabIndex={-1}>{result.strategy.name}</h2><p>{result.period} · {result.months} měsíců · Start {money(result.amount)}</p></div>
      <Button variant="secondary" className={styles.secondary} onClick={() => editing ? setEditing(false) : edit()} aria-expanded={editing} aria-controls="backtest-configuration"><SlidersHorizontal size={16} aria-hidden="true" />{editing ? "Zavřít nastavení" : "Změnit nastavení"}</Button>
    </div>}
    {dirty && <p role="status" className={styles.notice}>Vstupy se změnily. Spusť backtest znovu a aktualizuj výsledek. Níže je stále výsledek předchozího nastavení.</p>}
    <div className={styles.setupLayout} hidden={!editing}>
      <form id="backtest-configuration" ref={configuration} onSubmit={(event) => { event.preventDefault(); void run(); }} className={styles.setup} aria-label="Nastavení backtestu" aria-busy={running}>
        <fieldset disabled={running} className={styles.formFields}>
          <legend className="sr-only">Nastavení pokusu</legend>
          <section className={styles.formSection} aria-labelledby="approaches-heading">
            <h2 id="approaches-heading" className={styles.step}>1 · Dvě cesty</h2>
            <label htmlFor="strategy" className={styles.label}>Zvolená strategie</label>
            <Select id="strategy" value={strategy} onChange={(event) => setStrategy(event.target.value)}>{backtestStrategies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            <div className={styles.approaches}>
              <div><h3><Badge>A</Badge>{selected.name}</h3><p>{selected.description}</p></div>
              <div><h3><Badge>B</Badge>Akciový vzorek</h3><p>100 % akcií jako srovnávací benchmark. Stejná počáteční částka i období.</p></div>
            </div>
          </section>
          <section className={styles.formSection} aria-labelledby="period-heading">
            <h2 id="period-heading" className={styles.step}>2 · Období</h2>
            <p className={styles.hint}>Stejný pokus může v jiném období dopadnout jinak. Letopočty označují vymyšlenou řadu.</p>
            <fieldset className={styles.periods}><legend className="sr-only">Připravená období</legend>{backtestPeriods.map((period) => <label key={period.id} className={styles.period}>
              <input type="radio" name="period" checked={periodId === period.id} onChange={() => { setStart(period.start); setEnd(period.end); }} />
              <span><strong>{period.name}</strong><small>{period.start === period.end ? `1–12/${period.start}` : `${period.start}–${period.end}`} · {(period.end - period.start + 1) * 12} měsíců</small></span>
            </label>)}</fieldset>
            <div className={styles.dates}><div><label htmlFor="start-year" className={styles.label}>Od ledna</label><Select id="start-year" value={start} onChange={(event) => setStart(Number(event.target.value))}>{backtestYears.map((year) => <option key={year}>{year}</option>)}</Select></div><div><label htmlFor="end-year" className={styles.label}>Do prosince</label><Select id="end-year" value={end} onChange={(event) => setEnd(Number(event.target.value))}>{backtestYears.map((year) => <option key={year}>{year}</option>)}</Select></div></div>
          </section>
          <section className={styles.formSection} aria-labelledby="amount-heading">
            <h2 id="amount-heading" className={styles.step}>3 · Počáteční částka</h2>
            <div className={styles.amountRow}><FinanceInput id="backtest-amount" label="Počáteční částka" suffix="Kč" value={amount} onValueChange={setAmount} /><p className={styles.hint}>Jen pro tenhle pokus. Stejnou částku vložíme do obou cest na začátku. Žádné další vklady.</p></div>
          </section>
          <section className={styles.formSection} aria-labelledby="prediction-heading">
            <h2 id="prediction-heading" className={styles.step}>4 · Tvůj tip předem</h2>
            <h3 className={styles.predictionQuestion}>Která cesta skončí výš?</h3>
            <p className={styles.hint}>Tip je dobrovolný. Nic se nehodnotí, jen uvidíš, co tě překvapilo.</p>
            <fieldset className={styles.predictions}><legend className="sr-only">Tvůj tip předem</legend>{([
              ["strategy", "A", "Zvolená strategie"], ["benchmark", "B", "Akciový vzorek"], ["unknown", "?", "Nevím"],
            ] as const).map(([value, letter, label]) => <label key={value} className={styles.prediction}><Badge>{letter}</Badge><span>{label}</span><input type="radio" name="prediction" value={value} checked={prediction === value} onChange={() => setPrediction(value)} /></label>)}</fieldset>
          </section>
        </fieldset>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.runBar}><Button type="submit" loading={running} className={styles.primary}>{running ? "Počítám backtest…" : "Spustit backtest"}<ArrowRight size={18} aria-hidden="true" /></Button><p>Počítá se z ukázkových dat. Nic se nekupuje.</p></div>
        {running && <p role="status" className={styles.hint}>Počítám obě cesty pro zvolené období…</p>}
      </form>
      <aside className={styles.rail} aria-label="O pokusu">
        <DataCard />
        <div className={styles.learningLink}><BookOpen size={16} aria-hidden="true" /><h2>Proč záleží na rozložení?</h2><p>Lekce vysvětlí váhy portfolia a rozkládání rizika.</p><Link href="/learn/foundations/your-first-portfolio" className={styles.textLink}>Portfolio, váhy a diverzifikace <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </aside>
    </div>
    {result && <section className={styles.results} aria-label="Výsledek backtestu" aria-busy={running}>
      <BacktestChart data={result.points} strategyLabel={result.strategy.name} initial={result.amount} />
      <Metrics result={result} />
      <PredictionResult result={result} />
      <div className={styles.retryBar}><Button className={styles.primary} onClick={compare} disabled={running}><RotateCcw size={18} aria-hidden="true" />Zkusit jiné období</Button><Link href="/learn/foundations/your-first-portfolio" className={styles.textLink}><BookOpen size={16} aria-hidden="true" />Zpět k lekci o portfoliu</Link></div>
      {comparison && <section className={styles.comparison} aria-labelledby="comparison-heading">
        <h2 ref={comparisonHeading} id="comparison-heading" tabIndex={-1}>Stejný pokus, jiná období.</h2>
        <p>{result.strategy.name} · Start {money(result.amount)} v každém pokusu · Ukázková data</p>
        <div className={styles.comparisonGrid}>{comparison.map((item, index) => <article key={item.period} className={styles.comparisonCard}>
          <h3>{backtestPeriods[index].name}</h3><p>{item.period}</p>
          <BacktestChart data={item.points} strategyLabel={item.strategy.name} initial={item.amount} compact />
          <dl><div><dt>A · Konečná hodnota</dt><dd>{money(item.metrics.finalValue)}</dd></div><div><dt>B · Akciový vzorek</dt><dd>{money(item.benchmark.finalValue)}</dd></div><div><dt>Propad A / B</dt><dd>{formatPercentage(item.metrics.maxDrawdown)} / {formatPercentage(item.benchmark.maxDrawdown)}</dd></div></dl>
          <Button variant="secondary" className={styles.secondary} onClick={() => { setStart(item.config.start); setEnd(item.config.end); setEditing(true); requestAnimationFrame(() => configuration.current?.querySelector<HTMLSelectElement>("#start-year")?.focus()); }}>Vybrat toto období<ArrowRight size={16} aria-hidden="true" /></Button>
        </article>)}</div>
        <p className={styles.hint}>Každý graf má vlastní svislou škálu. Srovnávej i hodnoty a propady, ne jen tvar křivek. Žádné období není předpověď.</p>
      </section>}
      <details className={styles.quiz}><summary>Ověř si porozumění <ChevronDown size={18} aria-hidden="true" /></summary><section aria-labelledby="lab-question"><h2 id="lab-question">Která metrika ukazuje největší pokles od předchozího maxima?</h2><fieldset className={styles.quizOptions}><legend className="sr-only">Vyber metriku</legend>{["CAGR", "Maximální drawdown", "Volatilita"].map((value) => <AnswerOption key={value} name="backtest-question" value={value} checked={answer === value} disabled={checked} onChange={setAnswer}>{value}</AnswerOption>)}</fieldset><Button variant="secondary" className={styles.secondary} disabled={!answer || checked} onClick={() => setChecked(true)}>Zkontrolovat odpověď</Button>{checked && <p role="status" className={styles.feedback}>{answer === "Maximální drawdown" ? "Správně." : "Zaměř se na maximální drawdown."} Sleduje největší pokles od vrcholu ke dnu. CAGR popisuje začátek a konec; volatilita popisuje kolísání.</p>}</section></details>
    </section>}
    <details className={styles.methodology}><summary><Info size={16} aria-hidden="true" />Data a předpoklady výpočtu<ChevronDown size={16} aria-hidden="true" /></summary><div><DataNotes /><p>Všech 132 výnosů je vymyšlených. Nejde o živé ceny ani historické tržní výnosy. Předpoklad reinvestice je součástí syntetického modelu, nikoli záznam skutečně vyplacených dividend.</p><p>CAGR používá počet měsíčních intervalů dělený 12. Volatilita je výběrová směrodatná odchylka (n − 1) násobená √12. Drawdown je kladná velikost ztráty; zahrnuje počáteční investici a hodnoty na konci měsíce. Nezachytí větší propady uvnitř měsíce.</p><p>Výnosy se aplikují v pořadí, bez znalosti budoucích měsíců. Chybějící, duplicitní, neseřazená nebo neplatná pozorování se odmítají. Výpočet období nezkracuje a data nedoplňuje. Zaokrouhluje se až při zobrazení.</p></div></details>
    <footer className={styles.footer}><strong>investi!</strong><p>Výukový nástroj, ne investiční doporučení. Ukázkový ani minulý výsledek nezaručuje budoucí výnosy.</p><Link href="/lab" className={styles.textLink}>Zpět do Labu<ArrowRight size={16} aria-hidden="true" /></Link></footer>
  </main>;
}
