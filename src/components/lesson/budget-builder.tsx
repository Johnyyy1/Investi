"use client";

import { useState } from "react";
import { FinanceInput } from "@/components/learning/finance-input";
import { CalculatorResult } from "@/components/learning/calculator-result";
import { MetricResult } from "@/components/learning/metric-result";
import { Button } from "@/components/ui/button";
import { monthlyBudget, parseBudgetAmount } from "@/features/lessons/before-investing/model";

const fields = [
  { id: "income", label: "Čistý měsíční příjem", hint: "Částka po dani a pojistném, která přijde na účet." },
  { id: "fixed", label: "Fixní měsíční výdaje", hint: "Například nájem, splátky, telefon a předplatná." },
  { id: "variable", label: "Variabilní měsíční výdaje", hint: "Například potraviny, doprava, oblečení a zábava." },
  { id: "annual", label: "Nepravidelné výdaje za rok", hint: "Součet za celý rok: pojištění, servis, dárky i odhad oprav." },
] as const;
type Draft = Record<(typeof fields)[number]["id"], string>;
const example: Draft = { income: "38000", fixed: "16000", variable: "14000", annual: "7200" };
const money = (value: number) => `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value)} Kč`;

/** Deliberately no persistence, telemetry, form action or lesson-answer callback. Drafts die on unmount. */
export function BudgetBuilder() {
  const [draft, setDraft] = useState<Draft>(example);
  const [own, setOwn] = useState(false);
  const values = fields.map(({ id }) => parseBudgetAmount(draft[id]));
  const [income, fixed, variable, annual] = values;
  const result = income !== null && fixed !== null && variable !== null && annual !== null
    ? monthlyBudget(income, fixed, variable, annual) : null;
  return <section aria-label="Kalkulačka rozpočtu" className="min-w-0 space-y-6">
    <p className="text-body text-secondary">{own ? "Vlastní rozpočet · orientační výpočet" : "Petřin modelový rozpočet"}. Čísla zůstávají jen v této otevřené kalkulačce. Neodesílají se na server ani se neukládají; po opuštění kroku se smažou. Můžeš použít i smyšlené částky.</p>
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" size="compact" onClick={() => { setDraft({ income: "", fixed: "", variable: "", annual: "" }); setOwn(true); }}>Vyplnit vlastní rozpočet</Button>
      <Button variant="ghost" size="compact" onClick={() => { setDraft(example); setOwn(false); }}>Načíst Petřin příklad</Button>
    </div>
    <div className="grid min-w-0 gap-6 sm:grid-cols-2">{fields.map(({ id, label, hint }, index) => <FinanceInput key={id} label={label} mode="currency" suffix="Kč" value={draft[id]} onValueChange={(value) => setDraft((current) => ({ ...current, [id]: value }))} hint={hint} error={values[index] === null ? "Zadej nezáporné číslo do 1 000 000 000; desetinnou čárku i tečku lze použít." : undefined} />)}</div>
    {result ? <>
      <CalculatorResult label="Výsledek rozpočtu">
        <MetricResult label="Nepravidelné výdaje měsíčně" value={money(result.monthlyIrregular)} />
        <MetricResult label="Všechny výdaje měsíčně" value={money(result.expenses)} />
        <MetricResult label={result.surplus < 0 ? "Měsíční schodek" : "Měsíční přebytek"} value={money(result.surplus)} />
        <MetricResult label="Míra úspor" value={result.savingsRate === null ? "Nelze určit při nulovém příjmu" : `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(result.savingsRate * 100)} %`} />
      </CalculatorResult>
      <p className="text-body">{result.surplus < 0 ? "Výdaje převyšují příjem. Nejdřív prozkoumej rozpočet; výsledek není částka k investování." : result.surplus === 0 ? "Příjem právě pokrývá výdaje. Tento rozpočet zatím nemá přebytek k odkládání." : "Přebytek je odhad částky k odkládání, ne pokyn vše investovat. Zohledni drahé dluhy, rezervu a blízké cíle. Rozpočet ověř za více měsíců."}</p>
    </> : <p role="status" className="text-body text-secondary">Doplň všechna čtyři pole. Pokud některý výdaj nemáš, napiš 0. Bez platných vstupů výsledek nezobrazujeme.</p>}
  </section>;
}
