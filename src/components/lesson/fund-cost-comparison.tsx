"use client";

import { useId, useState } from "react";
import { FinanceSlider } from "@/components/learning/finance-slider";
import { CalculatorResult } from "@/components/learning/calculator-result";
import { MetricResult } from "@/components/learning/metric-result";
import { Select } from "@/components/ui/form-controls";
import { parseNumericAnswer } from "@/features/finance/numeric-input";
import { compareFundCosts } from "@/features/lessons/foundations/fund-cost-model";

const fields = [
  { id: "entry", label: "Vstupní poplatek", min: 0, max: 5, step: 0.1, suffix: "%", hint: "Z každého vkladu, 0 až 5 %." },
  { id: "ongoing", label: "Průběžné náklady", min: 0, max: 3, step: 0.01, suffix: "% ročně", hint: "Ročně z hodnoty investice, 0 až 3 %." },
  { id: "gross", label: "Hrubý výnos před náklady", min: -5, max: 12, step: 0.25, suffix: "% ročně", hint: "Tvůj předpoklad, ne slib ani historický průměr. Rozsah −5 až 12 %." },
  { id: "years", label: "Doba investování", min: 1, max: 40, step: 1, suffix: "let", hint: "Celé roky od 1 do 40." },
] as const;
const money = (value: number) => `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.round(value) || 0)} Kč`;

export function FundCostComparison() {
  const modeId = useId();
  const [draft, setDraft] = useState({ entry: "3", ongoing: "1,9", gross: "6", years: "20" });
  const [regular, setRegular] = useState(false);
  const values = fields.map(({ id }) => parseNumericAnswer(draft[id]));
  const valid = fields.map(({ min, max, id }, index) => Number.isFinite(values[index]) && values[index] >= min && values[index] <= max && (id !== "years" || Number.isInteger(values[index])));
  const result = valid.every(Boolean) ? compareFundCosts(values[0], values[1], values[2], values[3], regular) : null;
  return <section aria-label="Kalkulačka nákladů fondu" className="min-w-0 space-y-6">
    <p className="text-body text-secondary">Porovnáváš stejný fond s náklady a bez nich při stejném hrubém výnosu. Vstupy zůstávají jen v otevřeném kroku a neukládají se.</p>
    <label className="block min-w-0 space-y-2"><span id={modeId} className="text-body font-semibold">Způsob investování</span>
      <Select aria-labelledby={modeId} value={regular ? "regular" : "lump"} onChange={(event) => setRegular(event.target.value === "regular")}>
        <option value="lump">Jednorázově 100 000 Kč</option>
        <option value="regular">Měsíčně 2 000 Kč</option>
      </Select>
    </label>
    <div className="grid min-w-0 gap-6 sm:grid-cols-2">{fields.map((field, index) => <FinanceSlider key={field.id} label={field.label} mode={field.id === "years" ? "number" : "percentage"} suffix={field.suffix} value={draft[field.id]} onValueChange={(value) => setDraft((current) => ({ ...current, [field.id]: value }))} min={field.min} max={field.max} step={field.step} hint={field.hint} error={valid[index] ? undefined : field.id === "years" ? "Zadej celý počet let od 1 do 40." : `Zadej číslo od ${field.min} do ${field.max}.`} />)}</div>
    {result ? <CalculatorResult label="Výsledek porovnání nákladů fondu">
      <MetricResult label="Vloženo celkem" value={money(result.contributed)} />
      <MetricResult label="Hodnota bez nákladů" value={money(result.withoutCosts)} />
      <MetricResult label="Hodnota po nákladech" value={money(result.withCosts)} />
      <MetricResult label="Náklady tě stály" value={money(result.costImpact)} />
    </CalculatorResult> : <p role="status" className="text-body text-secondary">Oprav vstupy; bez platných hodnot výsledek nezobrazujeme.</p>}
    <p className="text-body text-secondary">Čistý roční výnos zjednodušeně počítáme jako hrubý výnos minus průběžné náklady. Vstupní poplatek se odečte z každého vkladu; pravidelné vklady přicházejí na konci měsíce. Bez daní, poplatků brokera a kolísání: skutečný výnos se každý rok liší. Výsledek není předpověď ani doporučení.</p>
  </section>;
}
