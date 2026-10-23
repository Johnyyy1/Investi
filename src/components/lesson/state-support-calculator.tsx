"use client";

import { Fragment, useState } from "react";
import { FinanceInput } from "@/components/learning/finance-input";
import { CalculatorResult } from "@/components/learning/calculator-result";
import { MetricResult } from "@/components/learning/metric-result";
import { annualDeduction, parseWholeKc, pensionRules, stateContribution, taxSaving } from "@/features/lessons/before-investing/pension-model";

const kc = (value: number) => `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value)} Kč`;
// Break only between digit groups at 200 % text, never inside one.
const amount = (value: number) => kc(value).split(/\s/).map((group, index) => <Fragment key={index}>{index ? " " : null}<span className="whitespace-nowrap">{group}</span></Fragment>);

/** Private ephemeral drafts. No form action, storage, analytics or link to portfolio accounting. */
export function StateSupportCalculator() {
  const [dps, setDps] = useState("1700");
  const [dip, setDip] = useState("0");
  const monthly = parseWholeKc(dps);
  const annualDip = parseWholeKc(dip);
  const deduction = monthly !== null && annualDip !== null ? annualDeduction(monthly, annualDip) : null;
  const error = "Zadej celé Kč od 0 do 10 000 000.";
  return <section aria-label="Kalkulačka státní podpory" className="min-w-0 space-y-6">
    <p className="text-body text-secondary">Částky zůstávají jen v této kalkulačce a po opuštění kroku se smažou. Výsledek není doporučení, kolik do produktů vkládat.</p>
    <div className="grid min-w-0 gap-6 sm:grid-cols-2">
      <FinanceInput className="[&>div]:px-2" label="Měsíční vklad do DPS" mode="currency" suffix="Kč" value={dps} onValueChange={setDps} hint="Stejný vklad každý měsíc celý rok." error={monthly === null ? error : undefined} />
      <FinanceInput className="[&>div]:px-2" label="Roční vklad do DIP" mode="currency" suffix="Kč" value={dip} onValueChange={setDip} hint="Sdílí s DPS jeden roční limit odpočtu." error={annualDip === null ? error : undefined} />
    </div>
    {monthly !== null && deduction !== null ? <>
      <CalculatorResult label="Výsledek státní podpory">
        <MetricResult label="Státní příspěvek měsíčně" value={amount(stateContribution(monthly))} />
        <MetricResult label="Státní příspěvek za rok" value={amount(stateContribution(monthly) * 12)} />
        <MetricResult label="Roční odpočet" value={amount(deduction)} />
        <MetricResult label={`Úspora na dani při ${pensionRules.taxPercent} %`} value={amount(taxSaving(deduction))} />
      </CalculatorResult>
      <p className="text-body">{deduction === pensionRules.sharedDeductionAnnual ? "Společný limit odpočtu je vyčerpaný; vyšší vklad už daň nesníží." : monthly < pensionRules.minMonthly ? `Pod ${kc(pensionRules.minMonthly)} měsíčně stát do DPS nepřispívá.` : monthly >= pensionRules.capMonthly ? "Příspěvek je na stropu; další vklad do DPS může jen snížit daň." : "Vyšší vklad do DPS zatím zvyšuje státní příspěvek."}</p>
    </> : <p role="status" className="text-body text-secondary">Doplň platné vstupy. Prázdné pole není nula; bez všech údajů výsledek neukazujeme.</p>}
    <p className="text-small text-secondary">Model: příspěvek {pensionRules.statePercent} % z měsíčního vkladu od {kc(pensionRules.minMonthly)} do {kc(pensionRules.capMonthly)}; odpočet z DPS jen nad touto hranicí, společně s DIP nejvýše {kc(pensionRules.sharedDeductionAnnual)} ročně. Modelová sazba daně {pensionRules.taxPercent} % a dost vysoký základ daně. Bez životního pojištění, poplatků a výnosu fondu. Nejde o daňový výpočet ani osobní doporučení.</p>
  </section>;
}
