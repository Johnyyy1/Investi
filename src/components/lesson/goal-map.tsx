"use client";

import { useEffect, useId, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { FinanceInput } from "@/components/learning/finance-input";
import { ArtifactSaveControl } from "./artifact-save-control";
import { listArtifacts } from "@/features/artifacts/actions";
import { purposeLabels, priorityLabels } from "@/features/ips/presentation";
import { emptyGoal, goalDraftsFromMap, goalMapFromDraft, horizonCategory, GOALS_LESSON_ID, type GoalDraft } from "@/features/lessons/before-investing/goals-model";

export function GoalMap({ guest = false, onReady }: { guest?: boolean; onReady?: (blockId: string, ready: boolean) => void }) {
  const id = useId();
  const [drafts, setDrafts] = useState<GoalDraft[]>([emptyGoal()]);
  const [noGoal, setNoGoal] = useState(false);
  const [year, setYear] = useState<number>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState<string>();
  useEffect(() => {
    if (guest) return;
    let active = true;
    const currentYear = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Prague" }).format(new Date()));
    void listArtifacts({ kind: "goal_map" }).then((result) => {
      if (!active) return;
      if (!result.ok) { setError(result.message); return; }
      const map = result.artifacts.find((artifact) => artifact.kind === "goal_map");
      if (map) {
        setDrafts(map.payload.goals.length ? goalDraftsFromMap(map.payload, currentYear) : [emptyGoal()]);
        setNoGoal(map.payload.noSpecificGoal === true);
        if (map.sourceLessonId === GOALS_LESSON_ID) setSaved(JSON.stringify(map.payload));
      }
      setYear(currentYear); setLoaded(true); setError(undefined);
      onReady?.("map", map?.sourceLessonId === GOALS_LESSON_ID);
    }, () => { if (active) setError("Mapu se nepodařilo načíst. Zkus to znovu; uloženou verzi nepřepisujeme."); });
    return () => { active = false; };
  }, [guest, retry, onReady]);

  if (guest) return <div className="space-y-4"><p>Pro uložení mapy nebo volby „Zatím nemám konkrétní cíl“ si nejdřív ulož účet. Pak se vrať k tomuto kroku.</p><ButtonLink href="/onboarding/save">Uložit účet</ButtonLink></div>;
  if (!loaded || year === undefined) return <div className="space-y-4"><p role={error ? "alert" : "status"}>{error ?? "Načítám mapu cílů…"}</p>{error && <Button variant="secondary" onClick={() => { setError(undefined); setRetry((value) => value + 1); }}>Načíst znovu</Button>}</div>;

  let payload;
  let validation;
  try { payload = goalMapFromDraft(drafts, noGoal, year); }
  catch (reason) { validation = reason instanceof Error ? reason.message : "Zkontroluj cíle."; }
  const update = (index: number, value: Partial<GoalDraft>) => setDrafts((current) => current.map((goal, i) => i === index ? { ...goal, ...value } : goal));
  return <section aria-label="Vlastní mapa cílů" className="min-w-0 space-y-6">
    <p className="text-body text-secondary">Přidej 1–5 cílů nebo vědomě zvol, že zatím žádný nemáš. Můžeš použít smyšlené údaje. Částku můžeš vynechat; nepiš čísla účtů ani osobní údaje. Návrh se odešle až po souhlasu a uložení.</p>
    <label className="flex min-h-12 items-start gap-3 text-body"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground" checked={noGoal} onChange={(event) => setNoGoal(event.target.checked)} /><span>Zatím nemám konkrétní cíl</span></label>
    {!noGoal && <>
      {drafts.map((goal, index) => <fieldset key={index} className="min-w-0 space-y-4 border-t border-divider pt-5">
        <legend className="font-semibold">Cíl {index + 1}</legend>
        <label className="block space-y-2"><span>Název cíle {index + 1}</span><Input value={goal.label} maxLength={160} onChange={(event) => update(index, { label: event.target.value })} /></label>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <FinanceInput label={`Částka cíle ${index + 1} (nepovinná)`} mode="currency" suffix="Kč" value={goal.amount} onValueChange={(amount) => update(index, { amount })} hint="V dnešních Kč, bez odhadu inflace. Nejvýše dvě desetinná místa." />
          <label className="block space-y-2"><span>Rok použití peněz pro cíl {index + 1}</span><Input type="number" min={year} max={year + 100} value={goal.year} onChange={(event) => update(index, { year: event.target.value })} /></label>
          <label className="block space-y-2"><span id={`${id}-purpose-${index}`}>Účel cíle {index + 1}</span><Select aria-labelledby={`${id}-purpose-${index}`} value={goal.purpose} onChange={(event) => update(index, { purpose: event.target.value as GoalDraft["purpose"] })}>{Object.entries(purposeLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></label>
          <label className="block space-y-2"><span id={`${id}-priority-${index}`}>Pevnost cíle {index + 1}</span><Select aria-labelledby={`${id}-priority-${index}`} value={goal.priority} onChange={(event) => update(index, { priority: event.target.value as GoalDraft["priority"] })}>{Object.entries(priorityLabels).map(([id, label]) => <option key={id} value={id}>{id === "essential" ? "Nutný · termín potřebuji dodržet" : id === "optional" ? "Přání · mohu odložit" : label}</option>)}</Select></label>
        </div>
        <Button variant="ghost" size="compact" onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}>Odebrat cíl {index + 1}</Button>
      </fieldset>)}
      <Button variant="secondary" size="compact" disabled={drafts.length >= 5} onClick={() => setDrafts((current) => [...current, emptyGoal()])}>Přidat cíl</Button>
      <p className="text-small text-secondary">Horizont odhadujeme rozdílem kalendářních let × 12 měsíců; pro letošní rok použijeme 1 měsíc. Přesný termín upřesni v investičním plánu. Starší mapu s více cíli zachováme.</p>
      {payload && <div aria-live="polite" className="space-y-3"><h4 className="font-semibold">Časová osa cílů</h4><ol className="space-y-3">{[...payload.goals].sort((a, b) => a.horizonMonths - b.horizonMonths).map((goal, index) => <li key={index} className="border-t border-divider pt-3"><strong>{goal.targetYear} · {goal.label}</strong><p>{horizonCategory(goal.horizonMonths)} · {priorityLabels[goal.priority]}</p></li>)}</ol><p className="text-small text-secondary">Kategorie je orientační pravidlo palce, ne doporučení nástroje nebo podílu akcií.</p></div>}
    </>}
    {saved && <p role="status" className="text-small text-secondary">{JSON.stringify(payload) === saved ? "Aktuální mapa je uložená." : "Mapa obsahuje neuložené změny. Pokračování použije poslední uloženou verzi."}</p>}
    {validation && <p role="status" className="text-small text-secondary">{validation}</p>}
    {payload && <ArtifactSaveControl key={JSON.stringify(payload)} content={{ kind: "goal_map", payload }} sourceLessonId={GOALS_LESSON_ID} onSaved={(artifact) => { if (artifact.kind === "goal_map") { setSaved(JSON.stringify(artifact.payload)); onReady?.("map", true); } }} />}
    <p className="text-small text-secondary">Uložené cíle předvyplní nový <a className="underline underline-offset-4" href="/lab/plan" target="_blank" rel="noopener noreferrer">investiční plán (otevře novou kartu)</a>. Stávající plán se nepřepisuje. Všechny verze mapy lze smazat v <a className="underline underline-offset-4" href="/settings" target="_blank" rel="noopener noreferrer">Nastavení → Moje data (nová karta)</a>; jsou i v exportu účtu. Dokončení lekce tím nezmizí.</p>
  </section>;
}
