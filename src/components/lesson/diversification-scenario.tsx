"use client";

import { useRef, useState } from "react";
import { Lock, Minus, Plus, RotateCcw } from "lucide-react";
import { MetricResult } from "@/components/learning/metric-result";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { evaluateScenario, lessonInstrumentIds, lessonInstruments, scenarioRules, type LessonInstrumentId, type ScenarioAllocation } from "@/features/lessons/diversification/model";
import { RuleStatus } from "./diversification-explorers";

const STEP = 10;
const CAPITAL = 100_000;
const number = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });
const crowns = (percent: number) => `${new Intl.NumberFormat("cs-CZ").format(CAPITAL * percent / 100)} Kč`;
const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value) * 100)} %`;
const ruleTarget = (id: string) => scenarioRules.find((rule) => rule.id === id)!;

/**
 * A separate fictional portfolio. Optional onSubmit persists only the isolated decision for a mission;
 * the ordinary published explorer remains ephemeral and never changes personal portfolio data.
 */
export function DiversificationScenario({ onSubmit }: { onSubmit?: (decision: { allocation: Record<LessonInstrumentId, number>; prediction: "pass" | "fail" }, requestId: string) => Promise<void> } = {}) {
  const requestId = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [allocation, setAllocation] = useState<Record<LessonInstrumentId, number>>(() => Object.fromEntries(lessonInstrumentIds.map((id) => [id, 0])) as Record<LessonInstrumentId, number>);
  const [prediction, setPrediction] = useState<"pass" | "fail" | null>(null);
  const [locked, setLocked] = useState(false);
  const invested = lessonInstrumentIds.reduce((sum, id) => sum + allocation[id], 0);
  const cash = 100 - invested;
  const result = locked ? evaluateScenario(allocation as ScenarioAllocation) : null;
  const change = (id: LessonInstrumentId, delta: number) => { requestId.current = null; setAllocation((current) => ({ ...current, [id]: Math.min(100, Math.max(0, current[id] + delta)) })); };
  const passedCount = result?.rules.filter((rule) => rule.pass).length ?? 0;
  const failed = result?.rules.filter((rule) => !rule.pass) ?? [];

  return <section aria-label="Scénář diverzifikace" className="min-w-0 space-y-6">
    <Feedback state="informational" role="note"><p className="text-small"><strong>Scénářový kapitál 100 000 Kč.</strong> Oddělené cvičení: nic se nenakupuje v tvém Portfolio Labu a tvůj cvičný kapitál se nemění.</p></Feedback>
    <fieldset disabled={locked || pending} className="min-w-0 space-y-3">
      <legend className="text-body font-semibold">1. Rozhodnutí: rozděl kapitál po {STEP} %</legend>
      <ul className="divide-y divide-border border-y border-border">
        {lessonInstrumentIds.map((id) => {
          const instrument = lessonInstruments[id];
          return <li key={id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-semibold">{instrument.label}</p>
              <p className="text-microcopy text-secondary">{instrument.description}</p>
            </div>
            <div className="flex max-w-full items-center gap-2">
              <Button variant="secondary" size="icon" aria-label={`${instrument.label}: ubrat ${STEP} %`} disabled={allocation[id] === 0} onClick={() => change(id, -STEP)}><Minus aria-hidden="true" className="size-4" /></Button>
              <output aria-live="polite" className="w-24 min-w-0 text-center tabular-nums [overflow-wrap:anywhere]"><span className="block font-semibold">{allocation[id]} %</span><span className="block text-microcopy text-secondary">{crowns(allocation[id])}</span></output>
              <Button variant="secondary" size="icon" aria-label={`${instrument.label}: přidat ${STEP} %`} disabled={cash === 0} onClick={() => change(id, STEP)}><Plus aria-hidden="true" className="size-4" /></Button>
            </div>
          </li>;
        })}
        <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
          <p className="font-semibold">Hotovost</p>
          <p className="tabular-nums" data-testid="scenario-cash"><span className="font-semibold">{cash} %</span> <span className="text-microcopy text-secondary">· {crowns(cash)}</span></p>
        </li>
      </ul>
    </fieldset>

    <fieldset disabled={locked || pending} className="space-y-3">
      <legend className="text-body font-semibold">2. Předpověď: projde tvoje portfolio všemi čtyřmi pravidly?</legend>
      <div className="flex flex-wrap gap-2">
        {([["pass", "Ano, projde"], ["fail", "Ne, nějaké nesplní"]] as const).map(([id, label]) => <Button key={id} variant="secondary" size="compact" aria-pressed={prediction === id} className={prediction === id ? "border-primary bg-primary-soft text-primary" : undefined} onClick={() => { requestId.current = null; setPrediction(id); }}>{label}</Button>)}
      </div>
    </fieldset>

    {locked ? null : <div className="flex flex-col gap-2">
      <Button className="w-fit" loading={pending} disabled={!prediction || invested === 0} onClick={async () => {
        if (!prediction) return;
        setPending(true); setSaveError(false);
        try {
          if (onSubmit) { requestId.current ??= crypto.randomUUID(); await onSubmit({ allocation, prediction }, requestId.current); }
          setLocked(true);
        } catch { setSaveError(true); } finally { setPending(false); }
      }}><Lock aria-hidden="true" className="size-4" />Zamknout rozhodnutí</Button>
      <p className="text-microcopy text-secondary">{invested === 0 ? "Nejdřív něco investuj." : !prediction ? "Vyber předpověď a pak rozhodnutí zamkni." : "Po zamknutí uvidíš pravidla a výsledek dvou vymyšlených roků."}</p>
    </div>}

    {saveError ? <p role="alert" className="text-sm text-danger">Rozhodnutí se nepodařilo uložit. Zkus zamknutí znovu.</p> : null}
    {result ? <div aria-live="polite" className="space-y-6">
      <Feedback state={(prediction === "pass") === result.passed ? "correct" : "incorrect"} role="status">
        <p className="font-semibold">Tvůj odhad: {prediction === "pass" ? "projde" : "neprojde"}. {(prediction === "pass") === result.passed ? "Odhad sedí." : "Tentokrát ne."} Portfolio splnilo {passedCount} ze {result.rules.length} pravidel.</p>
      </Feedback>
      <div className="space-y-3">
        <h4 className="text-card-title font-semibold">3. Pravidla po pohledu dovnitř fondů</h4>
        <ul aria-label="Výsledek pravidel" className="divide-y divide-border border-y border-border">
          {result.rules.map((rule) => <li key={rule.id} className="space-y-1 py-3">
            <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><span className="font-semibold">{rule.label}{rule.largest ? `: ${rule.largest}` : ""}</span><span className="tabular-nums">{number.format(rule.percent)} % · Cíl: ≤ {ruleTarget(rule.id).maxPercent} % · <RuleStatus pass={rule.pass} /></span></p>
            <p className="text-microcopy text-secondary">{rule.why}</p>
          </li>)}
        </ul>
      </div>
      <div className="space-y-3">
        <h4 className="text-card-title font-semibold">4. Výsledek dvou vymyšlených roků</h4>
        <div className="grid gap-5 sm:grid-cols-2">
          {result.outcomes.map((outcome) => <MetricResult key={outcome.id} label={outcome.label} value={signed(outcome.portfolioReturn)} sentiment={outcome.portfolioReturn < 0 ? "negative" : outcome.portfolioReturn > 0 ? "positive" : "neutral"} />)}
        </div>
        <p className="text-microcopy text-secondary">Ve scénáři se každá firma pohne jako její sektor. Hotovost má výnos 0 %. Pro srovnání: celé ve Fondu Technologie by to bylo −30,00 % a +35,00 %.</p>
      </div>
      <Feedback state="informational" role="note">
        <p className="font-semibold">Co z toho plyne</p>
        <p className="mt-1 text-small">{result.passed
          ? "Portfolio splnilo všechna pravidla. Ani jeden rok o něm nerozhodl úplně: na žádné firmě, sektoru ani zemi nevisí příliš velká část. To je rozložení, ne výsledek jednoho roku."
          : `Nesplněno: ${failed.map((rule) => rule.label.toLocaleLowerCase("cs-CZ")).join(", ")}. Výsledek scénáře na tom nic nemění. I když koncentrované portfolio v jednom roce vydělá víc, v jiném roce může stejná koncentrace ztrátu zvětšit.`}</p>
      </Feedback>
      <Button variant="secondary" className="w-fit" onClick={() => { requestId.current = null; setLocked(false); setPrediction(null); }}><RotateCcw aria-hidden="true" className="size-4" />Upravit portfolio a zkusit znovu</Button>
    </div> : null}
  </section>;
}
