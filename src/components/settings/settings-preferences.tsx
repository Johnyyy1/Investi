"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Info } from "lucide-react";
import { updatePersonalizedPreferencesAction } from "@/features/personalization/actions";
import { personalizedPreferencesSchema, type PersonalizedPreferences } from "@/features/personalization/profile";
import { experienceLabels, goalLabels, interestLabels, sessionLabels } from "@/features/personalization/presentation";
import { Button } from "@/components/ui/button";
import styles from "./settings.module.css";

const sessionHints = { 5: "Kratší kroky, víc zastávek", 10: "Jedno sezení v klidu", 20: "Čas na hlubší pochopení", 30: "Prostor pro souvislosti" };
const same = (a: PersonalizedPreferences, b: PersonalizedPreferences) => JSON.stringify(a) === JSON.stringify(b);

export function SettingsPreferences({ initialPreferences, onDirtyChange, onEditingChange }: { initialPreferences: PersonalizedPreferences; onDirtyChange: (dirty: boolean) => void; onEditingChange: (editing: boolean) => void }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialPreferences);
  const [draft, setDraft] = useState(initialPreferences);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; signIn?: boolean }>();
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const errorSummary = useRef<HTMLParagraphElement>(null);
  const focusAfterSave = useRef<HTMLElement | null>(null);
  const dirty = !same(saved, draft);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { if (message && !message.ok) errorSummary.current?.focus(); }, [message]);
  useEffect(() => {
    if (pending || !focusAfterSave.current) return;
    const target = focusAfterSave.current;
    focusAfterSave.current = null;
    if (document.activeElement === document.body && target.isConnected && target.getClientRects().length > 0) target.focus();
  }, [pending]);

  function change(next: PersonalizedPreferences) { setDraft(next); setMessage(undefined); }
  function save(next = draft, automatic = false) {
    if (submitting.current) return;
    const parsed = personalizedPreferencesSchema.safeParse(next);
    if (!parsed.success) { setMessage({ ok: false, text: "Zkontroluj své předvolby a zkus to znovu." }); return; }
    submitting.current = true;
    focusAfterSave.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMessage(undefined);
    startTransition(async () => {
      try {
        const result = await updatePersonalizedPreferencesAction(parsed.data);
        if (!result.ok) { setMessage({ ok: false, text: result.message, signIn: "signIn" in result && result.signIn }); return; }
        setSaved(parsed.data); setDraft(parsed.data);
        setMessage({ ok: true, text: automatic ? "Uloženo" : "Tvoje předvolby učení jsou uložené." });
        router.refresh();
      } catch { setMessage({ ok: false, text: "Změny se nepodařilo uložit. Zkus to znovu. Tvůj výběr zůstává zachovaný." }); }
      finally { submitting.current = false; }
    });
  }

  return <div className={styles.preferences} data-settings-preferences>
    {editing ? <form onSubmit={(event) => { event.preventDefault(); save(); }} onReset={(event) => event.preventDefault()} aria-busy={pending || undefined}>
      <div className={styles.sectionHead}><p>Vyber, co ti teď sedí. Nic se neuloží, dokud změnu nepotvrdíš.</p></div>
      <fieldset disabled={pending} aria-describedby={message && !message.ok ? "preferences-message" : undefined} className={styles.fieldset}>
        <legend>Cíl</legend>
        <div className={styles.choices}>{Object.entries(goalLabels).map(([value, label]) => <label key={value} className={styles.choice}>
          <input type="radio" name="preference-0" value={value} checked={draft.primaryGoal === value} onChange={() => change({ ...draft, primaryGoal: value as PersonalizedPreferences["primaryGoal"] })} />
          <span><strong>{label}</strong>{saved.primaryGoal === value && <small>Současný cíl</small>}</span>
        </label>)}</div>
      </fieldset>
      <fieldset disabled={pending} aria-describedby={message && !message.ok ? "preferences-message" : undefined} className={styles.fieldset}>
        <legend>Úroveň</legend><div className={styles.choices}>{Object.entries(experienceLabels).map(([value, label]) => <label key={value} className={styles.choice}>
          <input type="radio" name="preference-2" value={value} checked={draft.selfAssessedExperience === value} onChange={() => change({ ...draft, selfAssessedExperience: value as PersonalizedPreferences["selfAssessedExperience"] })} /><span><strong>{label}</strong></span>
        </label>)}</div>
      </fieldset>
      <fieldset disabled={pending} aria-describedby={message && !message.ok ? "preferences-message" : undefined} className={styles.fieldset}>
        <legend>Zájmy</legend><p className={styles.hint}>Můžeš vybrat více témat.</p><div className={styles.interests}>{Object.entries(interestLabels).map(([value, label]) => {
          const interest = value as PersonalizedPreferences["interests"][number];
          return <label key={value} className={styles.choice}><input type="checkbox" name="preference-1" value={value} checked={draft.interests.includes(interest)} onChange={() => change({ ...draft, interests: draft.interests.includes(interest) ? draft.interests.filter((item) => item !== interest) : [...draft.interests, interest] })} /><span><strong>{label}</strong></span></label>;
        })}</div>
      </fieldset>
      <div className={styles.preview}><Info size={20} aria-hidden="true" /><div><h3>Co se změnou upraví</h3><p>Zájmy a zkušenosti upraví doporučení a kontext učení. Délka sezení je orientační. Pořadí lekcí, uložená diagnostika, dokončené lekce i cvičný kapitál zůstávají zachované.</p></div></div>
      <SessionChoices draft={draft} pending={pending} error={Boolean(message && !message.ok)} onChange={(preferredSessionMinutes) => change({ ...draft, preferredSessionMinutes })} />
      <Feedback message={message} pending={pending} errorRef={errorSummary} />
      <div className={styles.actions}><Button type="submit" loading={pending}>{pending ? "Ukládám předvolby…" : "Uložit předvolby"}</Button><Button variant="secondary" disabled={pending} size="compact" onClick={() => { setDraft(saved); setEditing(false); onEditingChange(false); setMessage(undefined); requestAnimationFrame(() => editButton.current?.focus()); }}>Zrušit</Button></div>
      {dirty && <p className={styles.hint}>Máš neuložené změny.</p>}
    </form> : <>
      <section aria-labelledby="goal-heading"><div className={styles.sectionHead}><h2 id="goal-heading">Můj cíl</h2><p>Podle tvého cíle ladíme doporučení a kontext učení.</p></div>
        <div className={styles.card}><dl className={styles.rows}><div><dt>Cíl</dt><dd>{saved.primaryGoal ? goalLabels[saved.primaryGoal] : "Zatím nevybraný"}</dd></div><div><dt>Úroveň</dt><dd>{experienceLabels[saved.selfAssessedExperience]}</dd></div>{saved.interests.length > 0 && <div><dt>Zájmy</dt><dd>{saved.interests.map((interest) => interestLabels[interest]).join(", ")}</dd></div>}</dl>
          <div className={styles.cardFooter}><p><Info size={18} aria-hidden="true" />Změna zachová diagnostiku, postup v lekcích i cvičný kapitál.</p><Button buttonRef={editButton} variant="secondary" disabled={pending} size="compact" onClick={() => { setDraft(saved); setEditing(true); onEditingChange(true); setMessage(undefined); }}>Změnit cíl nebo úroveň…</Button></div>
        </div>
      </section>
      <SessionChoices draft={draft} pending={pending} error={Boolean(message && !message.ok)} onChange={(preferredSessionMinutes) => { const next = { ...saved, preferredSessionMinutes }; change(next); save(next, true); }} />
      <Feedback message={message} pending={pending} errorRef={errorSummary} />
      {message && !message.ok && <Button variant="secondary" size="compact" loading={pending} onClick={() => save(draft, true)}>Zkusit uložit znovu</Button>}
    </>}
  </div>;
}

function SessionChoices({ draft, pending, error, onChange }: { draft: PersonalizedPreferences; pending: boolean; error: boolean; onChange: (value: PersonalizedPreferences["preferredSessionMinutes"]) => void }) {
  return <section aria-labelledby="session-heading" className={styles.session}><div className={styles.sectionHead}><h2 id="session-heading">Délka sezení</h2><p>Delší lekci můžeš kdykoli přerušit a pokračovat jindy.</p></div><fieldset disabled={pending} aria-describedby={error ? "preferences-message" : "session-hint"} className={styles.fieldset}><legend className="sr-only">Délka sezení</legend><div className={styles.sessionChoices}>{([5, 10, 20, 30] as const).map((value) => <label key={value} className={styles.choice}><input type="radio" name="preference-3" value={value} checked={draft.preferredSessionMinutes === value} onChange={() => onChange(value)} /><span><strong>{sessionLabels[value]}</strong><small>{sessionHints[value]}</small></span></label>)}</div></fieldset><p id="session-hint" className={styles.hint}>Tempo je přibližná délka jednoho sezení.</p></section>;
}

function Feedback({ message, pending, errorRef }: { message?: { ok: boolean; text: string; signIn?: boolean }; pending: boolean; errorRef: React.Ref<HTMLParagraphElement> }) {
  return <>{pending ? <p className={styles.status} role="status">Ukládám…</p> : message ? <p id="preferences-message" ref={errorRef} tabIndex={-1} className={message.ok ? styles.status : styles.error} role={message.ok ? "status" : "alert"}>{message.ok && <Check size={16} aria-hidden="true" />}{message.text}{message.signIn && <> <a href="/sign-in" target="_blank" rel="noopener noreferrer">Přihlásit se v novém okně</a></>}</p> : null}</>;
}
