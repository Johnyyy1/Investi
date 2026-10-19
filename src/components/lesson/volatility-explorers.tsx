"use client";

import { useId, useMemo, useState } from "react";
import { FinanceInput } from "@/components/learning/finance-input";
import { LearningChart } from "@/components/learning/learning-chart";
import { MetricResult } from "@/components/learning/metric-result";
import { Button } from "@/components/ui/button";
import { parseNumericAnswer } from "@/features/lessons/question-evaluation";
import { annualiseVolatility, deviationSteps, drawdownPath, drawdownSample, pathReturns, PERIODS_PER_YEAR, volatilityPaths, type ReturnFrequency } from "@/features/lessons/volatility/model";
import { cn } from "@/lib/utils";

const number = (value: number, digits = 2) => new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const signed = (value: number, digits = 2) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${number(Math.abs(value), digits)}`;
/** Decimal return → "+3,00 %"; rounding happens here only. */
const percent = (value: number, digits = 2) => `${signed(value * 100, digits)} %`;
const toggleClass = (active: boolean) => cn("min-h-12 rounded-control border px-4 py-2 text-left text-small font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary-hover", active ? "border-primary bg-primary-soft text-primary" : "border-border-strong bg-surface text-foreground hover:bg-surface-muted");

function Toggle<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { id: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <div role="group" aria-label={label} className="flex flex-wrap gap-2">
    {options.map((option) => <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)} className={toggleClass(value === option.id)}>{option.label}</button>)}
  </div>;
}

/** Two invented funds with the same start and end; only the path differs. */
export function VolatilityPaths() {
  const [fund, setFund] = useState<keyof typeof volatilityPaths>("calm");
  const { label, values } = volatilityPaths[fund];
  const returns = pathReturns(values);
  const lowest = Math.min(...returns), highest = Math.max(...returns);
  const quarter = (index: number) => index === 0 ? "Začátek" : `${index}. čtvrtletí`;
  return <section aria-label="Dvě cesty ke stejnému výsledku" className="min-w-0 space-y-6">
    <Toggle label="Vyber fond" options={[{ id: "calm", label: volatilityPaths.calm.label }, { id: "swing", label: volatilityPaths.swing.label }]} value={fund} onChange={setFund} />
    <LearningChart data={values.map((value, index) => ({ label: index === 0 ? "Start" : `Q${index}`, value }))} title={`${label}: hodnota po čtvrtletích`} description={`${values.join(" → ")} Kč. Ukázková data.`} valueLabel="Hodnota" formatValue={(value) => `${number(value, 0)} Kč`} yDomain={[90, 125]} />
    <ol aria-label={`Výnosy po čtvrtletích: ${label}`} className="divide-y divide-border border-y border-border">
      {values.map((value, index) => <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
        <span className="font-semibold">{quarter(index)} · {number(value, 0)} Kč</span>
        <span className="text-small tabular-nums text-secondary">{index === 0 ? "Výnos: nedefinovaný" : `Výnos za čtvrtletí: ${percent(returns[index - 1])}`}</span>
      </li>)}
    </ol>
    <div aria-live="polite" aria-atomic="true" className="grid gap-5 sm:grid-cols-3">
      <MetricResult label="Nejnižší čtvrtletní výnos" value={percent(lowest)} />
      <MetricResult label="Nejvyšší čtvrtletní výnos" value={percent(highest)} />
      <MetricResult label="Rozpětí výnosů" value={`${number((highest - lowest) * 100)}\u00a0p.\u00a0b.`} note="Nejvyšší minus nejnižší. Čím širší, tím víc fond kolísal." />
    </div>
  </section>;
}

const deviationPresets = [
  { id: "x", label: "Řada X", values: ["1", "1", "1", "1"] },
  { id: "y", label: "Řada Y", values: ["4", "-2", "3", "-1"] },
  { id: "wild", label: "Prudší řada", values: ["8", "-6", "5", "-3"] },
] as const;

/** Every step of the sample standard deviation for four editable returns. */
export function StandardDeviationExplorer() {
  const [inputs, setInputs] = useState<string[]>([...deviationPresets[1].values]);
  const errorId = useId();
  const parsed = inputs.map(parseNumericAnswer);
  const valid = parsed.every((value) => Number.isFinite(value) && value > -100 && value <= 1000);
  const steps = valid ? deviationSteps(parsed.map((value) => value / 100)) : null;
  return <section aria-label="Výpočet směrodatné odchylky" className="min-w-0 space-y-6">
    <div role="group" aria-label="Připravené řady" className="flex flex-wrap gap-2">
      {deviationPresets.map((preset) => <Button key={preset.id} variant="secondary" size="compact" aria-pressed={inputs.join("|") === preset.values.join("|")} onClick={() => setInputs([...preset.values])}>{preset.label}</Button>)}
    </div>
    <div className="grid gap-4 sm:grid-cols-4">
      {inputs.map((input, index) => <FinanceInput key={index} label={`Výnos ${index + 1}`} mode="percentage" value={input} aria-describedby={valid ? undefined : errorId} aria-invalid={!valid && !Number.isFinite(parsed[index])} onValueChange={(value) => setInputs((current) => current.map((item, position) => position === index ? value : item))} />)}
    </div>
    {!steps ? <p id={errorId} role="alert" className="text-small text-danger-ink">Zadej čtyři čísla větší než −100, například 2,5 nebo -1.</p> : <div aria-live="polite" className="space-y-5">
      <table className="w-full table-fixed text-left text-small">
        <caption className="sr-only">Výnosy, jejich odchylky od průměru a druhé mocniny odchylek</caption>
        <thead className="border-b border-border-strong"><tr>{["Výnos", "Odchylka od průměru", "Druhá mocnina"].map((heading) => <th key={heading} scope="col" className="py-2 pr-3 font-semibold">{heading}</th>)}</tr></thead>
        <tbody>{steps.rows.map((row, index) => <tr key={index} className="border-b border-border">
          <td className="py-2 pr-3 tabular-nums">{percent(row.value)}</td>
          <td className="py-2 pr-3 tabular-nums">{signed(row.deviation * 100)}{"\u00a0p.\u00a0b."}</td>
          <td className="py-2 pr-3 tabular-nums">{number(row.squared * 10_000, 3)}</td>
        </tr>)}</tbody>
      </table>
      <dl className="grid gap-x-6 gap-y-3 text-small sm:grid-cols-2">
        <div className="flex justify-between gap-3 border-b border-border pb-2"><dt className="text-secondary">Průměrný výnos</dt><dd className="font-semibold tabular-nums">{percent(steps.mean)}</dd></div>
        <div className="flex justify-between gap-3 border-b border-border pb-2"><dt className="text-secondary">Součet druhých mocnin</dt><dd className="font-semibold tabular-nums">{number(steps.sumOfSquares * 10_000, 3)}</dd></div>
        <div className="flex justify-between gap-3 border-b border-border pb-2"><dt className="text-secondary">Děleno n − 1 = {steps.rows.length - 1}</dt><dd className="font-semibold tabular-nums">{number(steps.variance * 10_000, 3)}</dd></div>
        <div className="flex justify-between gap-3 border-b border-border pb-2"><dt className="text-secondary">Odmocnina</dt><dd className="font-semibold tabular-nums">{number(steps.deviation * 100)} %</dd></div>
      </dl>
      <div className="grid gap-5 border-y border-border py-5 sm:grid-cols-2">
        <MetricResult label="Směrodatná odchylka (n − 1)" value={`${number(steps.deviation * 100)} %`} note="Stejná konvence jako v Labu." />
        <MetricResult label="Při dělení n" value={`${number(steps.populationDeviation * 100)} %`} note="Vyjde menší. U dlouhých řad je rozdíl malý." />
      </div>
    </div>}
  </section>;
}

const frequencyOptions = [
  { id: "daily", label: "Denní" },
  { id: "weekly", label: "Týdenní" },
  { id: "monthly", label: "Měsíční" },
] as const satisfies readonly { id: ReturnFrequency; label: string }[];

/** Period deviation × √N, next to the overstated deviation × N. */
export function AnnualisationExplorer() {
  const [frequency, setFrequency] = useState<ReturnFrequency>("daily");
  const [input, setInput] = useState("1");
  const value = parseNumericAnswer(input);
  const valid = Number.isFinite(value) && value >= 0 && value <= 100;
  const periods = PERIODS_PER_YEAR[frequency];
  return <section aria-label="Anualizace volatility" className="min-w-0 space-y-6">
    <Toggle label="Frekvence výnosů" options={frequencyOptions} value={frequency} onChange={setFrequency} />
    <FinanceInput className="sm:max-w-sm" label={`Směrodatná odchylka ${frequency === "daily" ? "denních" : frequency === "weekly" ? "týdenních" : "měsíčních"} výnosů`} mode="percentage" value={input} onValueChange={setInput} error={valid ? undefined : "Zadej číslo od 0 do 100."} hint={valid ? `Rok má ${periods} ${frequency === "daily" ? "obchodních dní" : frequency === "weekly" ? "týdnů" : "měsíců"}.` : undefined} />
    {valid ? <div aria-live="polite" aria-atomic="true" className="grid gap-5 border-y border-border py-6 sm:grid-cols-3">
      <MetricResult label={`√${periods}`} value={number(Math.sqrt(periods))} />
      <MetricResult label="Anualizovaná volatilita" value={`${number(annualiseVolatility(value, frequency))} %`} note={`${number(value)} % × √${periods}`} />
      <MetricResult label={`Prosté násobení × ${periods}`} value={<s>{number(value * periods)} %</s>} sentiment="negative" note="Chybně: přehlíží, že se růsty a poklesy částečně vyruší." />
    </div> : null}
  </section>;
}

/** Step through an invented year and watch the running peak and the drawdown from it. */
export function MaxDrawdownExplorer() {
  const { labels, values } = drawdownSample;
  const path = useMemo(() => drawdownPath(values), [values]);
  const [month, setMonth] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const sliderId = useId();
  const step = path.steps[month];
  const worst = path.maxDrawdown!;
  return <section aria-label="Průzkumník největšího propadu" className="min-w-0 space-y-6">
    <LearningChart data={values.map((value, index) => ({ label: labels[index], value }))} title="Hodnota investice po měsících" description={`${values.join(" → ")} Kč. Ukázková data.`} valueLabel="Hodnota" formatValue={(value) => `${number(value, 0)} Kč`} yDomain={[80, 125]} />
    <div>
      <label htmlFor={sliderId} className="mb-2 block text-small font-bold">Měsíc: {labels[month]}</label>
      <input id={sliderId} type="range" min={0} max={values.length - 1} step={1} value={month} onChange={(event) => setMonth(Number(event.target.value))} aria-valuetext={`${labels[month]}, ${values[month]} Kč`} className="h-12 w-full cursor-pointer accent-primary" />
    </div>
    <div aria-live="polite" aria-atomic="true" className="grid gap-5 border-y border-border py-6 sm:grid-cols-3">
      <MetricResult label="Hodnota" value={`${number(step.value, 0)} Kč`} />
      <MetricResult label="Dosavadní vrchol" value={`${number(step.peak, 0)} Kč`} />
      <MetricResult label="Propad od vrcholu" value={percent(step.drawdown)} sentiment={step.drawdown < 0 ? "negative" : "neutral"} note={step.drawdown === 0 ? "Hodnota je na vrcholu." : `${number(step.value, 0)} ÷ ${number(step.peak, 0)} − 1`} />
    </div>
    {revealed
      ? <div role="status" className="grid gap-5 sm:grid-cols-3">
        <MetricResult label="Největší propad" value={percent(worst.depth)} sentiment="negative" note={`${labels[worst.peakIndex]} (${values[worst.peakIndex]} Kč) → ${labels[worst.troughIndex]} (${values[worst.troughIndex]} Kč)`} />
        <MetricResult label="Návrat na vrchol" value={worst.recoveryIndex === null ? "Nenastal" : labels[worst.recoveryIndex]} note={worst.recoveryIndex === null ? undefined : `${values[worst.recoveryIndex]} Kč překonalo ${values[worst.peakIndex]} Kč.`} />
        <MetricResult label="Délka propadu" value={`${(worst.recoveryIndex ?? values.length - 1) - worst.peakIndex} měsíců`} note="Od vrcholu po návrat." />
      </div>
      : <Button variant="secondary" size="compact" onClick={() => setRevealed(true)}>Odhalit největší propad</Button>}
  </section>;
}
