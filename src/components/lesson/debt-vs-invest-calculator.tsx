"use client";

import { useState } from "react";
import { FinanceSlider } from "@/components/learning/finance-slider";
import { CalculatorResult } from "@/components/learning/calculator-result";
import { MetricResult } from "@/components/learning/metric-result";
import { parseNumericAnswer } from "@/features/finance/numeric-input";
import { compareDebtAndInvest } from "@/features/lessons/before-investing/debt-model";

const fields = [
  { id: "debt", label: "RPSN dluhu", min: 0, max: 40, step: 0.25, suffix: "%", hint: "Modelová roční cena dluhu, 0 až 40 %." },
  { id: "investment", label: "Předpokládaný roční výnos investice", min: -50, max: 30, step: 0.25, suffix: "%", hint: "Tvůj předpoklad, ne slib ani historický průměr. Rozsah −50 až 30 %." },
  { id: "years", label: "Doba porovnání", min: 1, max: 10, step: 1, suffix: "let", hint: "Celé roky od 1 do 10." },
] as const;
const money = (value: number) => `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.round(value) || 0)} Kč`;

export function DebtVsInvestCalculator() {
  const [draft, setDraft] = useState({ debt: "24", investment: "5", years: "3" });
  const values = fields.map(({ id }) => parseNumericAnswer(draft[id]));
  const valid = fields.map(({ min, max, id }, index) => Number.isFinite(values[index]) && values[index] >= min && values[index] <= max && (id !== "years" || Number.isInteger(values[index])));
  const result = valid.every(Boolean) ? compareDebtAndInvest(values[0], values[1], values[2]) : null;
  return <section aria-label="Kalkulačka dluh, nebo investice" className="min-w-0 space-y-6">
    <p className="text-body text-secondary">Simulace · Obě cesty začínají s 25 000 Kč v hotovosti a stejným dluhem 25 000 Kč. Každý měsíc mají k dispozici dalších 1 000 Kč. Vstupy zůstávají jen v otevřeném kroku a neukládají se.</p>
    <div className="grid min-w-0 gap-6 sm:grid-cols-2">{fields.map((field, index) => <FinanceSlider key={field.id} label={field.label} mode={field.id === "years" ? "number" : "percentage"} suffix={field.suffix} value={draft[field.id]} onValueChange={(value) => setDraft((current) => ({ ...current, [field.id]: value }))} min={field.min} max={field.max} step={field.step} hint={field.hint} error={valid[index] ? undefined : field.id === "years" ? "Zadej celý počet let od 1 do 10." : `Zadej číslo od ${field.min} do ${field.max}; můžeš použít desetinnou čárku.`} />)}</div>
    <p className="text-body">Nejdřív splatit: hotovost splatí celý dluh a měsíčních 1 000 Kč jde do investice. Investovat a splácet minimum: hotovost jde do investice, měsíčních 1 000 Kč na modelovou minimální splátku; po splacení jde zbytek do investice. Toto minimum je smyšlený předpoklad, ne podmínka skutečné smlouvy.</p>
    {result ? <CalculatorResult label="Výsledek porovnání dluhu a investice">
      <MetricResult label="Nejdřív splatit · čistá hodnota" value={money(result.repayFirst)} />
      <MetricResult label="Investovat a splácet · investice minus dluh" value={money(result.investFirst - result.remainingDebt)} />
      <MetricResult label="Zbývající dluh při investování" value={money(result.remainingDebt)} />
      <MetricResult label="Modelové náklady dluhu při investování" value={money(result.costs)} />
      <MetricResult label="Rozdíl: nejdřív splatit minus investovat" value={money(result.difference)} />
    </CalculatorResult> : <p role="status" className="text-body text-secondary">Oprav vstupy; bez platných hodnot výsledek nezobrazujeme.</p>}
    <p className="text-body text-secondary">Kladný rozdíl znamená vyšší čistou hodnotu cesty „nejdřív splatit“, záporný cesty „investovat“. RPSN pro model převádíme na stálou měsíční sazbu: (1 + RPSN / 100)^(1/12) − 1. Stejně převádíme předpoklad výnosu; splátky a vklady probíhají na konci měsíce. Skutečné poplatky a splátkový kalendář mohou výsledek změnit. Investice v modelu rostou či klesají rovnoměrně, bez daní a investičních nákladů. Ve skutečnosti kolísají; výsledek není předpověď ani doporučení.</p>
  </section>;
}
