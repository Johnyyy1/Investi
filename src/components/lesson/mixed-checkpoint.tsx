"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleAlert, Leaf } from "lucide-react";
import { CompletionScreen } from "@/components/learning/completion-screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { recordSkillAttemptAction } from "@/features/mastery/actions";
import { evaluateQuestion, type QuestionBlock } from "@/features/lessons/question-evaluation";
import { GuidedQuestion } from "./guided-question";
import { LessonActionBar, LessonTopBar } from "./lesson-chrome";

export type CheckpointItem = { itemId: string; lessonTitle: string; block: QuestionBlock };

/**
 * Mixed checkpoint (#122): interleaved questions from several lessons, one attempt each. The verdict shown is the
 * one the server evaluated and recorded; nothing here touches lesson progress or rewards.
 */
export function MixedCheckpoint({ code, title, items }: { code: string; title: string; items: readonly CheckpointItem[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [verdict, setVerdict] = useState<boolean>();
  const [correct, setCorrect] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  // Reused while the same answer is resubmitted, so a lost response cannot record the attempt twice.
  const requestId = useRef<string>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const finished = index === items.length;
  const item = items[index];
  const isLast = index === items.length - 1;

  useEffect(() => {
    if (!moved.current || finished) return;
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [index, finished]);

  async function check() {
    if (pending) return;
    setPending(true); setError(undefined);
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await recordSkillAttemptAction({ requestId: requestId.current, itemId: item.itemId, answers, mode: "checkpoint" });
      if (!result.ok) { setError(result.message); return; }
      setVerdict(result.correct);
      if (result.correct) setCorrect((count) => count + 1);
    } catch { setError("Odpověď se nepodařilo uložit. Zkus to znovu."); }
    finally { setPending(false); }
  }
  function next(event: MouseEvent) {
    // The second click of a double click would land on the next question's button.
    if (event.detail > 1) return;
    requestId.current = undefined; moved.current = true;
    setIndex(index + 1); setAnswers({}); setVerdict(undefined); setError(undefined);
  }

  return <main className="flex min-h-dvh flex-col">
    <LessonTopBar eyebrow={`Smíšený checkpoint · ${code}`} title={title} minutes={items.length} segments={items.map(() => ({ mastery: true }))} current={index} finished={finished} />
    <div className="flex-1 px-5 pt-5 pb-7 md:px-8 md:pt-10 md:pb-14 lg:px-16 lg:pt-12 lg:pb-[72px]">
      <div className="mx-auto flex w-full max-w-[760px] min-w-0 flex-col gap-5 md:gap-7">
        {error ? <p role="alert" className="flex items-start gap-2 rounded-control bg-danger-soft px-4 py-3 text-[15px]/[23px] text-danger"><CircleAlert aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />{error}</p> : null}
        {finished ? <div className="overflow-hidden rounded-surface border border-border-card bg-surface shadow-elevation-1">
          <CompletionScreen autoFocusAction title="Checkpoint hotový" description={`Správně ${correct} z ${items.length}. Odpovědi jsou uložené jako důkaz dovedností.`} actionLabel="Zobrazit dovednosti" onContinue={() => { router.push("/progress"); router.refresh(); }}>
            <p className="mt-4 text-small text-secondary">Checkpoint nepřidává XP ani cvičný kapitál. Zvládnuté dovednosti si za týden ověříš opakováním.</p>
          </CompletionScreen>
          <div className="flex justify-center border-t border-divider px-6 py-4"><ButtonLink variant="ghost" className="text-foreground hover:bg-surface-muted" href="/learn"><ArrowLeft aria-hidden="true" className="size-4" />Zpět na Učení</ButtonLink></div>
        </div> : <article key={index} className="flex min-w-0 flex-col gap-5 md:gap-7" aria-labelledby="step-title">
          <div className="flex flex-col gap-2 md:gap-2.5">
            <p className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface-practice py-[5px] pr-2.5 pl-2 text-[13px] font-semibold text-primary"><Leaf aria-hidden="true" className="size-3.5" />Otázka {index + 1} z {items.length}</p>
            <h2 ref={headingRef} id="step-title" tabIndex={-1} lang="cs" className="scroll-mt-8 text-[28px]/8 font-semibold tracking-[-0.9px] md:text-[38px]/[44px] md:tracking-[-1.3px]">Z lekce {item.lessonTitle}</h2>
            <p className="text-sm/5 text-muted">Bez časového limitu. Každá otázka má jeden pokus, vysvětlení uvidíš hned.</p>
          </div>
          <GuidedQuestion block={item.block} answers={answers} verdict={verdict} mastery onAnswer={(id, value) => { requestId.current = undefined; setAnswers((current) => ({ ...current, [id]: value })); }} />
        </article>}
      </div>
    </div>
    {finished ? null : <LessonActionBar>
      {verdict === undefined
        ? <Button loading={pending} disabled={evaluateQuestion(item.block, answers) === undefined} onClick={() => void check()} className="min-w-0 flex-1 md:ml-auto whitespace-normal px-3 min-[420px]:px-6 md:flex-none">Zkontrolovat odpověď<ArrowRight aria-hidden="true" className="size-[18px]" /></Button>
        : <Button aria-describedby={`${item.block.id}-feedback`} onClick={next} className="min-w-0 flex-1 md:ml-auto whitespace-normal px-3 min-[420px]:px-6 md:flex-none">{isLast ? "Dokončit checkpoint" : "Další otázka"}<ArrowRight aria-hidden="true" className="size-[18px]" /></Button>}
    </LessonActionBar>}
  </main>;
}
