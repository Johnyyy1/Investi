"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CompletionScreen } from "@/components/learning/completion-screen";
import { Button, ButtonLink } from "@/components/ui/button";
import type { GuidedStep } from "@/features/lessons/steps";
import { evaluateQuestion, isQuestion } from "@/features/lessons/question-evaluation";
import type { AuthoredLesson } from "@/features/lessons/types";
import type { LessonHistoryEntry } from "@/features/lessons/real-history/snapshot";
import type { RiskHistoryEntry } from "@/features/lessons/real-history/risk-window";
import { completeLessonAction, markLessonStartedAction, saveLessonPositionAction } from "@/features/progress/actions";
import type { CompletionRewardPresentation, LearningMomentum } from "@/features/progress/contracts";
import { formatPracticeCapitalMinor, type SerializedPracticeCapitalMinor } from "@/features/rewards/presentation";
import { LearningStats } from "@/components/gamification/learning-stats";
import { cn } from "@/lib/utils";
import type { LessonFactNotice as FactNotice } from "@/features/facts/types";
import { LessonFactNotice } from "./lesson-fact-notice";
import { GuidedBlock } from "./guided-block";
import { GuidedQuestion } from "./guided-question";
import { preloadLessonBlocks } from "./lazy-blocks";
import { LessonActionBar, LessonTopBar } from "./lesson-chrome";
import { createLessonSaveQueue } from "./lesson-save-queue";
import { FactStatusChip } from "./step-kinds/fact-notice";
import { stepWidth } from "@/features/lessons/step-kinds";
import type { FactKey } from "@/features/facts/registry";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Leaf, RotateCcw } from "lucide-react";

const primaryClassName = "min-w-0 flex-1 whitespace-normal px-3 min-[420px]:px-6 md:flex-none";

/** What the lesson screen needs besides its steps; the authored blocks arrive only inside `steps`. */
type GuidedLessonSummary = Pick<AuthoredLesson, "id" | "moduleSlug" | "title" | "position" | "estimatedMinutes">;

export function GuidedLesson({ lesson, moduleTitle, steps, factKeys, initialStatus, initialPosition, initialCompletedLessons, initialLearningMomentum, initialEarnedPracticeCapitalMinor, nextHref, guest = false, history, riskHistory, factNotice }: {
  lesson: GuidedLessonSummary; moduleTitle: string;
  /** This lesson's guided steps, resolved on the server so no other lesson's content reaches the browser. */
  steps: readonly GuidedStep[];
  /** Facts the lesson shows, for the "Stav k" chip on its first step. */
  factKeys: readonly FactKey[];
  initialStatus: "not_started" | "in_progress" | "completed"; initialPosition: number; initialCompletedLessons: number; initialLearningMomentum: LearningMomentum; initialEarnedPracticeCapitalMinor: SerializedPracticeCapitalMinor; nextHref: string;
  /** A guest's finished lesson leads to saving an account first (Pen onboarding step 6). */
  guest?: boolean;
  factNotice?: FactNotice;
  /** Frozen history for the lesson's historical-data figures, loaded on the server. */
  history?: readonly LessonHistoryEntry[];
  /** Frozen daily closes for the Volatility lessons' historical figures. */
  riskHistory?: readonly RiskHistoryEntry[];
}) {
  const router = useRouter();
  const moduleHref = `/learn/${lesson.moduleSlug}`;
  // A server revalidation after completion must not relabel this attempt as review.
  const [review] = useState(initialStatus === "completed");
  const [position, setPosition] = useState(review ? 0 : Math.min(Math.max(initialPosition, 0), steps.length - 1));
  const [finished, setFinished] = useState(false);
  const [completedLessons, setCompletedLessons] = useState(initialCompletedLessons);
  const [reward, setReward] = useState<CompletionRewardPresentation>();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [outputReady, setOutputReady] = useState<Record<string, boolean>>({});
  const onOutputReady = useCallback((id: string, ready: boolean) => setOutputReady((current) => current[id] === ready ? current : { ...current, [id]: ready }), []);
  const [verdict, setVerdict] = useState<boolean>();
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const busyRef = useRef(false);
  // Completion revalidates every overview, so leaving afterwards needs no extra refresh.
  const completedRef = useRef(false);
  // Steps advance at once; the cursor is saved behind them, one move at a time and in order.
  const [saves] = useState(() => createLessonSaveQueue({
    save: (move) => saveLessonPositionAction(lesson.id, move.to, move.answers),
    onFailure: (move, message) => {
      // The server cursor is still at move.from: return there with the answers that earned the move, so Continue retries it.
      setPosition(move.from); setAnswers(move.answers ?? {}); setVerdict(move.answers ? true : undefined); setError(message);
    },
    onPendingChange: setSaving,
  }));

  useEffect(() => preloadLessonBlocks(steps.flatMap((item) => item.blocks)), [steps]);
  useEffect(() => {
    if (initialStatus === "not_started") void markLessonStartedAction(lesson.id).then((result) => {
      if (!result.ok) setError(result.message);
    }).catch(() => setError("Postup se nepodařilo uložit. Pokračováním to zkusíš znovu."));
  }, [initialStatus, lesson.id]);
  useEffect(() => {
    if (movedRef.current && !finished) {
      headingRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [position, finished]);
  useEffect(() => () => {
    // Saving the cursor revalidates nothing, and Back/Forward reuses cached pages however stale: an overview
    // with an old step, or this lesson with an old starting step whose next save would move the cursor back.
    // Once the learner leaves, refresh the router (which drops that cache) after the last save has landed.
    void saves.flush().then(() => { if (saves.saved && !completedRef.current) router.refresh(); });
  }, [router, saves]);
  useEffect(() => {
    if (!error) return;
    const frame = requestAnimationFrame(() => primaryRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [error]);

  function move(next: number, submitted?: Record<string, string>, event?: MouseEvent) {
    // The second click of a double click would land on the next step's button and skip it.
    if (busyRef.current || (event?.detail ?? 0) > 1) return;
    setError(undefined);
    if (!review) saves.enqueue({ from: position, to: next, answers: submitted });
    movedRef.current = true; setPosition(next); setAnswers({}); setVerdict(undefined);
  }
  async function complete() {
    if (busyRef.current) return;
    busyRef.current = true; setPending(true); setError(undefined);
    try {
      if (!review) {
        // Completion needs the last step saved; a failed save has already returned the learner to its step.
        if (!(await saves.flush())) return;
        const result = await completeLessonAction(lesson.id);
        if (!result.ok || result.completedLessons === undefined) { setError(result.message ?? "Dokončení se nepodařilo potvrdit. Zkus to znovu."); return; }
        completedRef.current = true;
        setCompletedLessons(result.completedLessons);
        setReward(result.reward);
      }
      setFinished(true);
    } catch { setError("Dokončení se nepodařilo uložit. Zkus to znovu."); }
    finally { busyRef.current = false; setPending(false); }
  }
  function retry() {
    setAnswers({}); setVerdict(undefined);
    requestAnimationFrame(() => questionRef.current?.querySelector<HTMLInputElement>("input, select")?.focus());
  }

  const step = steps[position];
  const mastery = step.kind === "mastery";
  const masterySteps = steps.filter((item) => item.kind === "mastery");
  const masteryPosition = mastery ? masterySteps.findIndex((item) => item === step) + 1 : 0;
  const question = step.blocks.find(isQuestion);
  const evaluation = question ? evaluateQuestion(question, answers) : undefined;
  const isLast = position === steps.length - 1;
  const missingSubmission = step.blocks.some((block) => (block.type === "rubricSelfAssessment" || (block.type === "interactiveFigure" && block.figure === "goal-map")) && !outputReady[block.id]);
  const primary = question && verdict === undefined
    ? { label: "Zkontrolovat odpověď", icon: <ArrowRight aria-hidden="true" className="size-[18px]" />, disabled: evaluation === undefined, onClick: () => setVerdict(evaluation) }
    : question && verdict === false
      ? { label: "Zkusit znovu", icon: <RotateCcw aria-hidden="true" className="size-[18px]" />, disabled: false, onClick: retry }
      : { label: question || !isLast ? "Pokračovat" : review ? "Dokončit opakování" : "Dokončit lekci", icon: <ArrowRight aria-hidden="true" className="size-[18px]" />, disabled: missingSubmission, onClick: (event: MouseEvent) => question ? move(position + 1, answers, event) : isLast ? void complete() : move(position + 1, undefined, event) };

  return <main className="flex min-h-dvh flex-col" data-save-state={saving ? "saving" : "idle"}>
    <LessonTopBar eyebrow={`${moduleTitle} · Lekce ${lesson.position}${review ? " · Opakování" : ""}`} title={lesson.title} minutes={lesson.estimatedMinutes} segments={steps.map((item) => ({ mastery: item.kind === "mastery" }))} current={position} finished={finished} />
    <div className="flex-1 px-5 pt-5 pb-7 md:px-8 md:pt-10 md:pb-14 lg:px-16 lg:pt-12 lg:pb-[72px]">
      <div className={cn("mx-auto flex w-full min-w-0 flex-col gap-5 md:gap-7", finished ? "max-w-[760px]" : stepWidth(step.blocks))}>
        {!finished && factNotice ? <LessonFactNotice notice={factNotice} /> : null}
        {error ? <p role="alert" className="flex items-start gap-2 rounded-control bg-danger-soft px-4 py-3 text-[15px]/[23px] text-danger"><CircleAlert aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />{error}</p> : null}
        {finished ? <div className="overflow-hidden rounded-surface border border-border-card bg-surface shadow-elevation-1">
          <CompletionScreen autoFocusAction title={review ? "Opakování dokončeno" : "Lekce dokončena"} description={lesson.title} xpAwarded={reward?.xpAwarded} practiceCapitalAwardedMinor={reward && reward.practiceCapitalAwardedMinor !== "0" ? reward.practiceCapitalAwardedMinor : undefined} actionLabel={guest ? "Ulož si, co už víš" : reward?.portfolioLabUnlocked ? "Otevřít Portfolio Lab" : reward?.allComplete ? "Prozkoumat Lab" : "Další lekce"} onContinue={() => { router.push(guest ? "/onboarding/save" : reward?.portfolioLabUnlocked ? "/lab/portfolio" : reward?.nextHref ?? nextHref); router.refresh(); }}>
            {reward?.portfolioLabUnlocked && <p className="mt-5 text-body font-bold text-primary" role="status">Portfolio Lab odemčen · +{formatPracticeCapitalMinor(reward.unlockCapitalAwardedMinor)} cvičného kapitálu</p>}
            {reward && reward.xpAwarded > 0 && !reward.portfolioLabOpen && <p className="mt-4 text-small text-secondary">{reward.practiceCapitalAwardedMinor !== "0" ? "Cvičný kapitál ti zůstane uložený. Použiješ ho v Portfolio Labu, až dokončíš základy." : "Cvičný kapitál získáš po dokončení základů a odemčení Portfolio Labu."}</p>}
            {review && <p className="mt-4 text-small text-secondary">Opakováním si znalost upevníš. Další XP ani cvičný kapitál se nepřipisují.</p>}
            <div className="mt-7 rounded-surface border border-border bg-surface p-5 text-left"><LearningStats stats={reward?.learningMomentum ?? initialLearningMomentum} earnedPracticeCapitalMinor={reward?.earnedPracticeCapitalMinor ?? initialEarnedPracticeCapitalMinor} goal /></div>
            {reward && !reward.allComplete && !reward.portfolioLabUnlocked && <p className="mt-6 text-small text-secondary">Další na řadě: {reward.nextTitle}</p>}
          </CompletionScreen>
          <div className="flex flex-wrap justify-center gap-2 border-t border-divider px-6 py-4"><ButtonLink variant="ghost" className="text-foreground hover:bg-surface-muted" href="/learn"><ArrowLeft aria-hidden="true" className="size-4" />Zpět na Učení</ButtonLink><ButtonLink variant="ghost" className="text-foreground hover:bg-surface-muted" href={moduleHref}>Zobrazit modul</ButtonLink><p className="sr-only" data-testid="completion-progress">Počet dokončených dostupných lekcí v modulu {moduleTitle}: {completedLessons} · {guest ? "Uloženo v tomto prohlížeči" : "Uloženo k účtu"}</p></div>
        </div> : <article key={position} className="flex min-w-0 flex-col gap-5 md:gap-7" aria-labelledby="step-title">
          {review ? <p className="flex items-center gap-2 text-sm text-muted"><CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-primary" /><span>Lekce už je dokončena. Opakování uložený postup nezmění.</span></p> : null}
          <div className="flex flex-col gap-2 md:gap-2.5">
            {mastery ? <p className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface-practice py-[5px] pr-2.5 pl-2 text-[13px] font-semibold text-primary"><Leaf aria-hidden="true" className="size-3.5" />Ověření znalostí · {masteryPosition} z {masterySteps.length}</p> : <p className="text-[11px] font-semibold tracking-[0.9px] text-primary uppercase md:text-xs md:tracking-[1px]">Krok {position + 1}</p>}
            <h2 ref={headingRef} id="step-title" tabIndex={-1} lang="cs" className="scroll-mt-8 text-[28px]/8 font-semibold tracking-[-0.9px] [overflow-wrap:normal] md:text-[38px]/[44px] md:tracking-[-1.3px]">{step.title}</h2>
            {mastery ? <p className="text-sm/5 text-muted">Bez časového limitu. Když odpověď nevyjde, ukážeme proč a zkusíš to znovu.</p> : null}
            {position === 0 && factKeys.length ? <FactStatusChip factKeys={factKeys} /> : null}
          </div>
          {step.blocks.filter((block) => !isQuestion(block)).map((block) => <GuidedBlock key={block.id} block={block} lessonId={lesson.id} guest={guest} onOutputReady={onOutputReady} history={history} riskHistory={riskHistory} />)}
          {question ? <div ref={questionRef} className="flex flex-col">
            {mastery && verdict ? <MasteryGuide /> : null}
            <div className="relative z-[1]"><GuidedQuestion block={question} answers={answers} verdict={verdict} mastery={mastery} onAnswer={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))} /></div>
          </div> : null}
        </article>}
      </div>
    </div>
    {finished ? null : <LessonActionBar>
      {position > 0 ? <Button variant="ghost" disabled={pending} onClick={(event) => move(position - 1, undefined, event)} className="min-h-[52px] shrink-0 px-1 text-[15px] font-semibold text-foreground hover:bg-surface-muted md:min-h-12 md:px-3"><ArrowLeft aria-hidden="true" className="size-4" /><span className="max-[359px]:sr-only">Předchozí</span></Button> : null}
      <Button buttonRef={primaryRef} loading={pending} disabled={primary.disabled} aria-describedby={question && verdict !== undefined ? `${question.id}-feedback` : undefined} onClick={primary.onClick} className={cn(primaryClassName, position === 0 && "md:ml-auto")}><span className="min-w-0 [overflow-wrap:anywhere]">{primary.label}</span>{pending ? null : <span className="contents max-[374px]:hidden">{primary.icon}</span>}</Button>
    </LessonActionBar>}
  </main>;
}

/** Guide 04 reacts once a mastery check is answered correctly; decorative, the verdict is announced by the card. */
function MasteryGuide() {
  return <div className="relative ml-auto h-[157px] w-full max-w-[350px]">
    <Image src="/investi-assets/guide/04-calm-book.webp" width={710} height={710} sizes="169px" alt="" className="absolute top-0 right-0 size-[169px] object-contain" />
    <p className="absolute top-[30px] left-0 z-[1] w-[167px] rounded-surface border border-border bg-surface px-3.5 py-3 text-sm/5 text-foreground">
      Přesně tak.
      <span aria-hidden="true" className="absolute top-1/2 -right-[6px] size-3 -translate-y-1/2 rotate-45 border-t border-r border-border bg-surface" />
    </p>
  </div>;
}
