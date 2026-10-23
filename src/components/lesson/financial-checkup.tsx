"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import { ArtifactSaveControl } from "./artifact-save-control";
import { listArtifacts } from "@/features/artifacts/actions";
import { availableLessons } from "@/features/learning/catalog";
import { CHECKUP_LESSON_ID, checkupAdvice, checkupNextStep, type FinancialCheckup as Checkup } from "@/features/lessons/before-investing/checkup-model";

type Answers = Omit<Checkup, "nextStep">;
const fields = [
  { key: "reserve", label: "Mám rezervu alespoň na 3 měsíce výdajů.", hint: "Tři měsíce jsou orientační bod tohoto check-upu, ne univerzální cíl. Posuď i stabilitu příjmu a dostupnost peněz.", options: { ready_for_goal: "Ano", building: "Částečně", needs_review: "Ne" } },
  { key: "expensiveDebt", label: "Nemám dluh s RPSN nad 10 %.", hint: "RPSN jsou roční náklady úvěru včetně poplatků. Deset procent je orientační hranice tohoto check-upu, ne právní pravidlo ani záruka levného dluhu.", options: { none: "Ano", plan_needed: "Ne" } },
  { key: "goals", label: "Vím, na co a za kolik let budu peníze potřebovat.", options: { defined: "Ano", needs_review: "Ne" } },
  { key: "retirement", label: "Podmínky státní podpory nebo příspěvku zaměstnavatele mám prověřené a využívám je, pokud dávají smysl.", hint: "Bez nároku na podporu může být nevyužití vědomá volba. Zvaž i vázanost a náklady; zde neuvádíme aktuální daňové limity.", options: { reviewed: "Ano / vědomě nevyužívám", needs_review: "Ne", unknown: "Nevím" } },
  { key: "budget", label: "Pravidelně mi zbývá kladný peněžní přebytek.", hint: "Po započtení nepravidelných výdajů.", options: { reviewed: "Ano", needs_review: "Ne" } },
] as const;

export function FinancialCheckup({ guest = false, onReady, summary = false }: { guest?: boolean; summary?: boolean; onReady?: (blockId: string, ready: boolean) => void }) {
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [saved, setSaved] = useState<Checkup>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (guest) return;
    let active = true;
    void listArtifacts({ kind: "financial_checkup" }).then((result) => {
      if (!active) return;
      if (!result.ok) { setError(result.message); return; }
      const current = result.artifacts.find((artifact) => artifact.kind === "financial_checkup");
      if (current) { setAnswers(current.payload); setSaved(current.payload); }
      setLoaded(true); setError(undefined);
      onReady?.("checkup", current?.sourceLessonId === CHECKUP_LESSON_ID);
    }, () => { if (active) setError("Check-up se nepodařilo načíst. Zkus to znovu; uložené odpovědi nepřepisujeme."); });
    return () => { active = false; };
  }, [guest, retry, onReady]);
  if (guest) return <div className="space-y-4"><p>Pro uložení check-upu si nejdřív ulož účet. Pak se vrať k tomuto kroku.</p><ButtonLink href="/onboarding/save">Uložit účet</ButtonLink></div>;
  if (!loaded) return <div className="space-y-4"><p role={error ? "alert" : "status"}>{error ?? "Načítám check-up…"}</p>{error && <Button variant="secondary" onClick={() => { setError(undefined); setRetry((value) => value + 1); }}>Načíst znovu</Button>}</div>;
  const complete = answers.budget && answers.reserve && answers.expensiveDebt && answers.goals && answers.retirement;
  const payload = complete ? { ...answers, nextStep: checkupNextStep(answers as Answers) } as Checkup : undefined;
  const advice = saved && checkupAdvice[checkupNextStep(saved)];
  const lesson = advice && availableLessons.find((lesson) => lesson.id === advice.lessonId);
  const editor = <>
    <p className="text-body text-secondary">Bez částek, čísel účtů a skóre. Odpovědi se odešlou až po souhlasu a uložení. Každou oblast můžeš nechat soukromou volbou Nechci uvádět. Kontrolu pojištění příjmu řeš podle vlastní situace; zde ji nevyhodnocujeme.</p>
    <div className="space-y-5">{fields.map((field) => <label key={field.key} className="block min-w-0 space-y-2 border-t border-divider pt-4">
      <span className="block font-semibold">{field.label}</span>
      {"hint" in field && <span className="block text-small text-secondary">{field.hint}</span>}
      <Select value={answers[field.key] ?? ""} onChange={(event) => setAnswers((old) => ({ ...old, [field.key]: event.target.value }))}>
        <option value="" disabled>Vyber odpověď</option>
        {Object.entries(field.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        <option value="prefer_not_to_say">Nechci uvádět</option>
      </Select>
    </label>)}</div>
    {!complete && <p role="status">Zvol odpověď v každé oblasti. Žádná z nich není neúspěch.</p>}
    {saved && <p role="status" className="text-small text-secondary">{fields.every((field) => answers[field.key] === saved[field.key]) ? "Aktuální check-up je uložený." : "Máš neuložené změny. Doporučení vychází z poslední uložené verze."}</p>}
    {payload && <ArtifactSaveControl key={JSON.stringify(payload)} content={{ kind: "financial_checkup", payload }} sourceLessonId={CHECKUP_LESSON_ID} onSaved={(artifact) => { if (artifact.kind === "financial_checkup") { setSaved(artifact.payload); onReady?.("checkup", true); } }} />}
  </>;
  const result = advice && <div aria-live="polite" className="space-y-3 border-t border-divider pt-5">
      <h4 className="font-display text-lg font-semibold">{advice.title}</h4><p>{advice.body}</p>
      {lesson ? <Link className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href={`/learn/${lesson.moduleSlug}/${lesson.slug}`}>{lesson.title}</Link> : <p className="text-small text-secondary">Podrobná lekce o rezervě se připravuje. Další dostupné lekce najdeš v <Link className="text-primary underline underline-offset-4" href="/learn">učení</Link>.</p>}
      {saved?.retirement !== "reviewed" && <p>Podmínky podpory a zaměstnavatelského příspěvku si ještě prověř. Nevyužití podpory samo o sobě není chyba.</p>}
      <p className="text-small text-secondary">Výsledek není hodnocení člověka ani osobní investiční doporučení. Obsah a pravidla odemčení Labu se nemění. Check-up můžeš kdykoli zopakovat.</p>
    </div>;
  return <section aria-label="Finanční základ" className="min-w-0 space-y-6">
    {summary ? <>{result ?? <p>Check-up zatím není uložený. Můžeš ho vyplnit níže.</p>}<details><summary className="min-h-11 cursor-pointer py-3 font-semibold text-primary">Upravit check-up</summary><div className="space-y-6 pt-4">{editor}</div></details></> : <>{editor}{result}</>}
  </section>;
}
