"use client";

import { useId, useState } from "react";
import { MetricResult } from "@/components/learning/metric-result";
import { formatCoefficient } from "@/features/instruments/comparison-presentation";
import { commonFactorReturns, correlationOf, correlationPairs, crisisWindow, type CrisisWindow } from "@/features/lessons/correlation/model";
import { cn } from "@/lib/utils";
import { ReturnScatter, signedPercent } from "./return-scatter";

const toggleClass = (active: boolean) => cn("min-h-12 rounded-control border px-4 py-2 text-left text-small font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary-hover", active ? "border-primary bg-primary-soft text-primary" : "border-border-strong bg-surface text-foreground hover:bg-surface-muted");
const coefficient = (value: number | null) => value === null ? "Nedostupné" : formatCoefficient(value);

function Toggle<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { id: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <div role="group" aria-label={label} className="flex flex-wrap gap-2">
    {options.map((option) => <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)} className={toggleClass(value === option.id)}>{option.label}</button>)}
  </div>;
}

/** Month-by-month values next to the chart, so nothing depends on reading dots alone. */
function ReturnTable({ caption, first, second, firstLabel = "Výnos A", secondLabel = "Výnos B", offset = 0 }: { caption: string; first: readonly number[]; second: readonly number[]; firstLabel?: string; secondLabel?: string; offset?: number }) {
  return <details className="rounded-control border border-border px-4 py-3">
    <summary className="min-h-11 cursor-pointer content-center text-small font-semibold">Zobrazit hodnoty v tabulce</summary>
    <table className="mt-3 w-full table-fixed text-left text-small">
      <caption className="sr-only">{caption}</caption>
      <thead className="border-b border-border-strong"><tr>{["Měsíc", firstLabel, secondLabel].map((heading) => <th key={heading} scope="col" className="py-2 pr-3 font-semibold">{heading}</th>)}</tr></thead>
      <tbody>{first.map((value, index) => <tr key={index} className="border-b border-border">
        <td className="py-2 pr-3 tabular-nums">{index + 1 + offset}.</td>
        <td className="py-2 pr-3 tabular-nums">{signedPercent(value)}</td>
        <td className="py-2 pr-3 tabular-nums">{signedPercent(second[index])}</td>
      </tr>)}</tbody>
    </table>
  </details>;
}

/** Four invented pairs of monthly returns and the coefficient of each. */
export function CorrelationExplorer() {
  const [pairId, setPairId] = useState<(typeof correlationPairs)[number]["id"]>("together");
  const pair = correlationPairs.find((item) => item.id === pairId)!;
  const value = correlationOf(pair.first, pair.second);
  return <section aria-label="Průzkumník korelace" className="min-w-0 space-y-6">
    <Toggle label="Vyber dvojici" options={correlationPairs.map(({ id, label }) => ({ id, label }))} value={pairId} onChange={setPairId} />
    <ReturnScatter points={pair.first.map((x, index) => ({ x, y: pair.second[index] }))} xLabel="výnos A" yLabel="výnos B" description={`Dvojice ${pair.label}: osm měsíců, každý bod je jeden měsíc. Ukázková data.`} domain={5} />
    <div aria-live="polite" aria-atomic="true" className="grid gap-5 border-y border-border py-6 sm:grid-cols-2">
      <MetricResult label="Korelace výnosů A a B" value={coefficient(value)} note="Spočítáno stejnou funkcí jako porovnání v Labu." />
      <MetricResult label="Co vidíš" value={pair.label} note={pair.note} />
    </div>
    <ReturnTable caption={`Měsíční výnosy dvojice ${pair.label}`} first={pair.first} second={pair.second} />
  </section>;
}

const shares = [0, 0.25, 0.5, 0.75, 1] as const;
const percentLabel = (share: number) => `${Math.round(share * 100)} %`;

/** Two stocks that never influence each other; only the share of one shared market move changes. */
export function CommonFactorExplorer() {
  const [index, setIndex] = useState(2);
  const sliderId = useId();
  const share = shares[index];
  const { first, second, coefficient: value } = commonFactorReturns(share);
  return <section aria-label="Průzkumník společného faktoru" className="min-w-0 space-y-6">
    <div>
      <label htmlFor={sliderId} className="mb-2 block text-small font-bold">Podíl společného pohybu trhu: {percentLabel(share)}</label>
      <input id={sliderId} type="range" min={0} max={shares.length - 1} step={1} value={index} onChange={(event) => setIndex(Number(event.target.value))} aria-valuetext={`${percentLabel(share)} pohybu pochází z trhu`} className="h-12 w-full cursor-pointer accent-primary" />
      <p className="text-microcopy text-secondary">Zbytek pohybu je vlastní pohyb každé firmy. Vlastní pohyby obou firem spolu nesouvisejí.</p>
    </div>
    <ReturnScatter points={first.map((x, position) => ({ x, y: second[position] }))} xLabel="výnos firmy A" yLabel="výnos firmy B" description={`${percentLabel(share)} společného pohybu: osm měsíců, každý bod je jeden měsíc. Ukázková data.`} domain={6} />
    <div aria-live="polite" aria-atomic="true" className="grid gap-5 border-y border-border py-6 sm:grid-cols-2">
      <MetricResult label="Korelace výnosů A a B" value={coefficient(value)} />
      <MetricResult label="Přímý vliv firmy A na firmu B" value="Žádný" note="Korelaci vytváří jen společný pohyb trhu." />
    </div>
    <ReturnTable caption={`Měsíční výnosy obou firem při ${percentLabel(share)} společného pohybu`} first={first} second={second} firstLabel="Výnos firmy A" secondLabel="Výnos firmy B" />
  </section>;
}

const windows = [
  { id: "calm", label: "Klidné měsíce 1–12" },
  { id: "crisis", label: "Krize: měsíce 13–18" },
  { id: "all", label: "Všech 18 měsíců" },
] as const satisfies readonly { id: CrisisWindow; label: string }[];

/** Twelve calm and six crisis months: the coefficient and the worst month of each side and of a 50/50 mix. */
export function CrisisCorrelationExplorer() {
  const [windowId, setWindowId] = useState<CrisisWindow>("calm");
  const result = crisisWindow(windowId);
  const label = windows.find((item) => item.id === windowId)!.label;
  return <section aria-label="Průzkumník korelace v krizi" className="min-w-0 space-y-6">
    <Toggle label="Vyber období" options={windows} value={windowId} onChange={setWindowId} />
    <ReturnScatter points={result.first.map((x, index) => ({ x, y: result.second[index] }))} xLabel="výnos akcie A" yLabel="výnos akcie B" description={`${label}: každý bod je jeden měsíc. Ukázková data.`} domain={14} />
    <div aria-live="polite" aria-atomic="true" className="space-y-5 border-y border-border py-6">
      <MetricResult label="Korelace výnosů A a B" value={coefficient(result.coefficient)} />
      <div className="grid gap-5 sm:grid-cols-3">
        <MetricResult label="Nejhorší měsíc A" value={signedPercent(result.worst.first)} sentiment="negative" />
        <MetricResult label="Nejhorší měsíc B" value={signedPercent(result.worst.second)} sentiment="negative" />
        <MetricResult label="Nejhorší měsíc půl napůl" value={signedPercent(result.worst.halfAndHalf)} sentiment="negative" note="Každý měsíc průměr výnosů A a B." />
      </div>
    </div>
    <ReturnTable caption={`Měsíční výnosy akcií A a B: ${label}`} first={result.first} second={result.second} offset={windowId === "crisis" ? 12 : 0} />
  </section>;
}
