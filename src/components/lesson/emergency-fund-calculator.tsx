"use client";

import { Fragment, useState } from "react";
import { FinanceInput } from "@/components/learning/finance-input";
import { CalculatorResult } from "@/components/learning/calculator-result";
import { MetricResult } from "@/components/learning/metric-result";
import { emergencyFundEstimate, parseEmergencyInput, type EmergencyFundFacts } from "@/features/lessons/before-investing/emergency-fund-model";
import { formatFactDate } from "@/features/facts/resolve";

const number = (value: number, digits = 2) => new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: digits }).format(value);
const percent = (value: number) => `${number(value * 100)} %`;

/** Private ephemeral drafts. No form action, storage, analytics or link to portfolio accounting. */
export function EmergencyFundCalculator({ facts }: { facts?: EmergencyFundFacts }) {
  const [expenses, setExpenses] = useState("30000");
  const [months, setMonths] = useState("6");
  const [nominal, setNominal] = useState("3,5");
  const [inflationOverride, setInflationOverride] = useState<string>();
  const inflation = inflationOverride ?? (facts ? String(facts.inflation.rate * 100).replace(".", ",") : "");
  const values = [parseEmergencyInput(expenses, 0, 1_000_000_000), parseEmergencyInput(months, 1, 36), parseEmergencyInput(nominal, 0, 100), parseEmergencyInput(inflation, -99, 1000)];
  const [e, m, n, i] = values;
  const result = facts && e !== null && m !== null && n !== null && i !== null ? emergencyFundEstimate(e, m, n / 100, i / 100, facts.tax.rate) : null;
  if (!facts) return <p role="status">Ověřené vstupy nejsou dostupné. Výnos nelze spočítat bez datovaných údajů o inflaci a dani.</p>;
  return <section aria-label="Kalkulačka rezervy" className="min-w-0 space-y-6">
    <p className="text-body text-secondary">Modelový příklad · Částky zůstávají jen v této otevřené kalkulačce a po opuštění kroku se smažou. Můžeš použít smyšlená čísla. Výsledek není doporučená osobní rezerva.</p>
    <div className="grid min-w-0 gap-6 sm:grid-cols-2">
      <FinanceInput className="[&>div]:px-2" label="Měsíční výdaje" mode="currency" suffix="Kč" value={expenses} onValueChange={setExpenses} error={e === null ? "Zadej číslo od 0 do 1 000 000 000 Kč." : undefined} />
      <FinanceInput className="[&>div]:px-2" label="Počet měsíců rezervy" value={months} onValueChange={setMonths} hint="Tři až šest měsíců je pravidlo palce, ne norma. Zvaž stabilitu příjmů a závazky." error={m === null ? "Zadej počet měsíců od 1 do 36." : undefined} />
      <FinanceInput className="[&>div]:px-2" label="Modelová roční sazba účtu" mode="percentage" value={nominal} onValueChange={setNominal} hint="Hypotetický vstup, nikoli nabídka konkrétní banky." error={n === null ? "Zadej sazbu od 0 do 100 %." : undefined} />
      <FinanceInput className="[&>div]:px-2" label="Inflace pro roční model" mode="percentage" value={inflation} onValueChange={setInflationOverride} hint={inflationOverride === undefined ? `Výchozí údaj: ${facts.inflation.label}. Není to prognóza.` : "Vlastní modelový předpoklad, nikoli aktuální pozorování."} error={i === null ? "Zadej inflaci od −99 do 1 000 %." : undefined} />
    </div>
    <div className="space-y-2 text-small text-secondary">
      {[facts.inflation, facts.tax].map((fact) => <p key={fact.label}>{fact.label}: {percent(fact.rate)} · {fact.period} · stav k <time dateTime={fact.verifiedAt}>{formatFactDate(fact.verifiedAt)}</time>. <a className="text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary" href={fact.source.url}>{fact.source.title}</a>{fact.stale ? " Údaj může být zastaralý; ověř zdroj." : ""}</p>)}
      <p>Daňová sazba platí pro běžného českého rezidenta, fyzickou osobu, a český nepodnikatelský bankovní účet. Nejde o režim fondů ani zahraničních brokerů.</p>
    </div>
    {result ? <>
      <CalculatorResult label="Výsledek rezervy">
        <MetricResult label="Cílová rezerva v modelu" value={<>{number(result.target).split(/\s/).map((group, index) => <Fragment key={index}>{index ? " " : null}<span className="whitespace-nowrap">{group}</span></Fragment>)} <span className="whitespace-nowrap">Kč</span></>} />
        <MetricResult label="Čistý nominální výnos po dani" value={percent(result.netNominal)} />
        <MetricResult label="Reálný výnos před daní" value={percent(result.realBeforeTax)} />
        <MetricResult label="Reálný výnos po dani" value={percent(result.realAfterTax)} />
      </CalculatorResult>
      <p className="text-body">{result.realAfterTax < 0 ? "Kupní síla v tomto modelu klesá: ceny rostou rychleji než zůstatek po dani. Rezerva přesto může plnit úkol dostupných peněz pro nečekané výdaje." : "Kupní síla v tomto modelu neklesá. Skutečná inflace i sazba se mohou změnit; výsledek není záruka."}</p>
    </> : <p role="status" className="text-body text-secondary">Doplň platné vstupy. Prázdné pole není nula; bez všech údajů výsledek neukazujeme.</p>}
    <p className="text-small text-secondary">Odhad za jeden rok se stálou sazbou a zůstatkem, jedním připsáním úroku a bez poplatků. Reálný výnos = (1 + výnos po dani) ÷ (1 + inflace) − 1. Nejde o daňový výpočet banky ani o uložený IPS.</p>
  </section>;
}
