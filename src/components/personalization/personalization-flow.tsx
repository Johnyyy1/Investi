"use client";
import { startTransition as restoreTransition, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { completePersonalizationAction, retakeDiagnosticAction, skipPersonalizationAction } from "@/features/personalization/actions";
import type { PersonalizedPreferences } from "@/features/personalization/profile";
import { type PersonalizationDraft, type PublicQuestion, restoreDraft } from "@/features/personalization/draft";
import { GUEST_KIND_HEADER } from "@/features/guest/identity";
import { authClient } from "@/lib/auth-client";
import { questionTitles } from "@/features/personalization/presentation";
import { PreferenceFields } from "./preference-fields";
import { OnboardingChoice } from "./onboarding-choice";
import { OnboardingGuide, OnboardingHeader, type GuidePose } from "./onboarding-frame";
import styles from "./personalization-flow.module.css";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Guests answer without an account. Their answers are saved to a guest identity that then sees the plan and
 * the first lesson; the account comes after that lesson (/onboarding/save) and takes the guest's learning over. */
export function PersonalizationFlow({ initialPreferences, questions, version, draftKey, retake = false, guest = false }: {
  initialPreferences: PersonalizedPreferences; questions: readonly PublicQuestion[]; version: string; draftKey: string; retake?: boolean; guest?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PersonalizationDraft>({ preferences: initialPreferences, step: retake ? 4 : 0, question: -1, answers: {} });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [signIn, setSignIn] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    let saved: PersonalizationDraft | null = null;
    try {
      saved = restoreDraft(sessionStorage.getItem(draftKey), questions);
      // A signed-in draft without a session means the session expired mid-onboarding: sign back in to it.
      if (!saved && guest && Object.keys(sessionStorage).some((key) => key !== draftKey && /^investi-personalization-v1:.+:initial$/.test(key))) { router.replace("/sign-in"); return; }
    } catch { /* Storage can be disabled. */ }
    restoreTransition(() => { if (saved) setDraft({ ...saved, step: retake ? 4 : saved.step }); setReady(true); });
  }, [draftKey, questions, retake, guest, router]);
  useEffect(() => {
    if (ready) { try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* The form still works without local recovery. */ } }
  }, [draft, draftKey, ready]);
  useEffect(() => {
    if (moved.current) { heading.current?.focus(); window.scrollTo({ top: 0, behavior: "instant" }); }
  }, [draft.step, draft.question]);
  function move(update: Partial<PersonalizationDraft>) { moved.current = true; setError(undefined); setSignIn(false); setDraft((current) => ({ ...current, ...update })); }
  function submit(skip = false) {
    if (busy.current) return;
    busy.current = true; setError(undefined); setSignIn(false);
    startTransition(async () => {
      try {
        // The guest identity is created only now, so browsing the questions never creates a database user.
        if (guest && !(await ensureGuestSession())) { setError("Plán se nepodařilo připravit. Odpovědi tu zůstaly, zkus to znovu."); return; }
        const diagnostic = { version, answers: draft.answers };
        const result = await (skip ? skipPersonalizationAction({}) : retake ? retakeDiagnosticAction(diagnostic) : completePersonalizationAction({ preferences: draft.preferences, diagnostic }));
        if (!result.ok) { setError(result.message); setSignIn("signIn" in result && result.signIn === true); return; }
        try { sessionStorage.removeItem(draftKey); } catch { /* Optional recovery storage. */ }
        router.replace(skip ? "/learn" : "/onboarding/plan"); router.refresh();
      } catch { setError("Připojení se nepodařilo. Odpovědi tu zůstaly, zkus je odeslat znovu."); }
      finally { busy.current = false; }
    });
  }
  const current = draft.step === 4 && draft.question >= 0 ? questions[draft.question] : undefined;
  const title = draft.step < 4 ? questionTitles[draft.step] : current?.prompt ?? (retake ? "Zopakovat krátkou diagnostiku" : "Najdeme vhodný začátek");
  const canContinue = draft.step === 0 ? Boolean(draft.preferences.primaryGoal) : current ? Boolean(draft.answers[current.id]) : true;
  function next() {
    if (!canContinue || pending) return;
    if (draft.step < 4) move({ step: draft.step + 1 });
    else if (draft.question < questions.length - 1) move({ question: draft.question + 1 });
    else submit();
  }
  const canBack = draft.step > 0 && !retake || draft.question >= 0;
  const progress = retake ? (draft.question + 2) / (questions.length + 2) : (draft.step + (draft.step === 4 ? draft.question + 1 : 0) + 1) / (questions.length + 6);
  const guide = guideResponse(draft, current);
  const helper = ["Vyber, co sedí nejvíc. Podle toho poskládáme začátek.", "Vyber libovolný počet témat. Zájmy můžeš doplnit i později.", "Zkušenosti jsou tvůj pohled. Krátké otázky nám pak pomohou upřesnit začátek.", "Jde o přibližné tempo jednoho sezení. Kdykoli si můžeš dát pauzu."][draft.step];
  return <main className={styles.flow}>
    <OnboardingHeader progress={ready ? progress : 0} disabled={pending || !ready} brandHref={guest ? "/" : undefined} back={canBack ? () => move(draft.step === 4 && draft.question >= 0 ? { question: draft.question - 1 } : { step: draft.step - 1 }) : undefined}
      trailing={guest ? <p className={styles.accountHint}>Už máš účet? <Link className={styles.accountLink} href="/sign-in">Přihlásit se</Link></p> : retake ? <Link className={styles.quiet} href="/settings">Zpět do nastavení</Link> : <button type="button" className={styles.quiet} disabled={pending || !ready} onClick={() => submit(true)}>Přeskočit personalizaci</button>} />
    {!ready ? <div className={styles.column}><OnboardingGuide pose="02-thinking">Načítám tvé předvolby…</OnboardingGuide></div> : <div className={styles.column}>
      <OnboardingGuide pose={pending ? "21-hourglass" : error ? "05-shrug" : guide.pose}>{pending ? "Skládám tvůj plán a ukládám odpovědi. Ještě chvilku…" : error ? "Odpovědi tu zůstaly. Až budeš připravený, zkus je uložit znovu." : guide.text}</OnboardingGuide>
      <form onReset={(event) => event.preventDefault()} onSubmit={(event) => { event.preventDefault(); next(); }} aria-busy={pending} aria-describedby={error ? "personalization-error" : undefined}>
        <section className={styles.questionCard} key={`${draft.step}:${draft.question}`}>
          <p role="status" aria-live="polite" className={styles.eyebrow}>{retake ? "Krátká diagnostika" : `Krok ${draft.step + 1} z 6 · ${["Cíl", "Zájmy", "Zkušenosti", "Tempo", "Diagnostika"][draft.step]}`}{current ? ` · Otázka ${draft.question + 1} z ${questions.length}` : ""}</p>
          <h1 ref={heading} tabIndex={-1} className={`${styles.questionTitle} ${current ? styles.diagnosticTitle : ""}`}>{title}</h1>
          {helper && <p className={styles.helper}>{helper}</p>}
          {draft.step < 4 ? <PreferenceFields onboarding step={draft.step} value={draft.preferences} onChange={(preferences) => { setError(undefined); setSignIn(false); setDraft((current) => ({ ...current, preferences })); }} disabled={pending} errorId={error ? "personalization-error" : undefined} /> : current ? <fieldset disabled={pending} aria-describedby={error ? "personalization-error" : undefined} className={styles.choices}>
            <legend className="sr-only">{current.prompt}</legend>
            {current.options.map((option) => <OnboardingChoice key={option.id} name={current.id} value={option.id} checked={draft.answers[current.id] === option.id} disabled={pending} onChange={(answer) => { setError(undefined); setSignIn(false); setDraft((draft) => ({ ...draft, answers: { ...draft.answers, [current.id]: answer } })); }}>{option.label}</OnboardingChoice>)}
          </fieldset> : <div className={styles.diagnosticIntro}><p>{questions.length} krátkých otázek nám pomůže doporučit, kde začít.</p><p>Výsledek nic neodemkne ani nepřeskakuje.</p><p>Nemusíš znát všechny odpovědi. Vyber tu, která ti dává největší smysl.</p></div>}
          {error && <p id="personalization-error" role="alert" className={styles.error}>{error} {signIn && <Link className={styles.textLink} href="/sign-in">Přihlášení</Link>}</p>}
        </section>
        <div className={styles.actionRow}>
          <p className={styles.actionHint}>{draft.step === 1 ? "Více témat? Klidně vyber všechna, která tě lákají." : "Odpovědi můžeš před uložením měnit."}</p>
          <button type="submit" className={cn(buttonVariants(), styles.primary)} disabled={!canContinue || pending}>{pending ? <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" /> : null}<span>{pending ? "Ukládám odpovědi…" : draft.step === 4 ? draft.question === questions.length - 1 ? "Zobrazit můj plán" : draft.question === -1 ? "Začít diagnostiku" : "Další otázka" : "Pokračovat"}</span>{!pending && <ArrowRight size={18} aria-hidden="true" />}</button>
        </div>
      </form>
      <p className={styles.disclosure}>Vzdělávání, ne investiční doporučení.</p>
    </div>}
  </main>;
}

/** Reuses a guest session whose creation response was lost; a retry must not create a second guest. */
async function ensureGuestSession() {
  const current = await authClient.getSession();
  if (current.data) return true;
  const created = await authClient.signIn.anonymous({ fetchOptions: { headers: { [GUEST_KIND_HEADER]: "guest" } } });
  return !created.error;
}

/** Presentation only: no answer key, scoring, or recommendation decisions in the client. */
function guideResponse(draft: PersonalizationDraft, question?: PublicQuestion): { pose: GuidePose; text: string } {
  if (question) {
    const poses: Record<string, GuidePose> = { simple_return: "14-returns", compounding: "12-compounding", portfolio_weight: "15-weights", bid_ask: "16-bid-ask", diversification: "10-diversification" };
    return { pose: draft.answers[question.id] ? "04-calm-book" : poses[question.id] ?? "02-thinking", text: draft.answers[question.id] ? "Mám tvoji odpověď. Můžeš ji ještě změnit, nebo pokračovat." : "Zkus si to promyslet. Nejde o známku, hledáme dobrý začátek pro tvoje učení." };
  }
  if (draft.step === 0) {
    const responses = { CONFIDENCE: "Dobrý start. Nejdřív si ujasníme, co se s penězi vlastně děje.", LONG_TERM_ETF: "ETF mají svůj kontext. Základy ti pomohou rozumět tomu, co držíš.", COMPANIES: "Za každou akcií je firma. Začneme pojmy, o které se můžeš opřít.", PORTFOLIO: "Podíváme se na celek: co držíš a jak spolu jednotlivé části souvisejí.", QUANT: "Výnosy, riziko a data. Nejdřív si připravíme pevný základ pro práci s čísly." };
    return { pose: draft.preferences.primaryGoal ? "03-explaining" : "01-welcome", text: draft.preferences.primaryGoal ? responses[draft.preferences.primaryGoal] : "Ahoj. Nejdřív pár otázek, pak tvůj plán a první lekce." };
  }
  if (draft.step === 1) return { pose: draft.preferences.interests.length ? "06-map" : "02-thinking", text: draft.preferences.interests.length ? "Témata mám poznamenaná. Pomohou zasadit doporučení do toho, co tě zajímá." : "Co tě láká? Můžeš vybrat víc témat, nebo zatím žádné." };
  if (draft.step === 2) return { pose: draft.preferences.selfAssessedExperience === "BEGINNER" ? "01-welcome" : "03-explaining", text: draft.preferences.selfAssessedExperience === "BEGINNER" ? "Nemusíš nic znát předem. Půjdeme postupně, po jednom pojmu." : "Navážeme na to, co už znáš. Další otázky ukážou, co stojí za procvičení." };
  if (draft.step === 3) return { pose: "04-calm-book", text: draft.preferences.preferredSessionMinutes === 5 ? "Pět minut se počítá. Delší lekci si klidně rozděl do více sezení." : draft.preferences.preferredSessionMinutes === 10 ? "Deset minut, jeden soustředěný krok. Pokrok se ukládá, pauza je v pořádku." : "Máš prostor jít do hloubky. Plán nabídne víc lekcí, když se do tvého tempa vejdou." };
  return { pose: "02-thinking", text: "Žádná známka ani závod. Jen zjistíme, kolik vysvětlení se ti bude hodit." };
}
