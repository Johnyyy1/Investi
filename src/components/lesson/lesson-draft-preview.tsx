"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { GuidedStep } from "@/features/lessons/steps";
import { evaluateQuestion, isQuestion } from "@/features/lessons/question-evaluation";
import { stepWidth } from "@/features/lessons/step-kinds";
import type { LessonFactNotice as Notice } from "@/features/facts/types";
import { GuidedBlock } from "./guided-block";
import { GuidedQuestion } from "./guided-question";
import { LessonFactNotice } from "./lesson-fact-notice";
import { cn } from "@/lib/utils";

/** Development-only editorial walk. No learner mutations, completion, awards or draft persistence. */
export function LessonDraftPreview({ title, steps, notice }: { title: string; steps: readonly GuidedStep[]; notice?: Notice }) {
  const [position, setPosition] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [verdict, setVerdict] = useState<boolean>();
  const heading = useRef<HTMLHeadingElement>(null);
  const step = steps[position];
  const question = step.blocks.find(isQuestion);
  const evaluation = question ? evaluateQuestion(question, answers) : undefined;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [position]);
  function move(next: number) { setPosition(next); setAnswers({}); setVerdict(undefined); }
  return <main className="mx-auto min-w-0 max-w-5xl space-y-8 [overflow-wrap:anywhere] px-4 py-8 md:px-8">
    <header className="space-y-3"><h1 className="text-2xl font-semibold">{title}</h1><p className="text-body text-secondary">Redakční náhled · Lekce čeká na odbornou revizi podle #133. Není publikovaná, neukládá pokrok a neuděluje odměny. Obnovení stránky náhled vrátí na začátek.</p>{notice ? <LessonFactNotice notice={notice} /> : null}</header>
    <section className={cn("mx-auto min-w-0 space-y-6", stepWidth(step.blocks))}>
      <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">{step.title}</h2>
      <p className="text-small text-secondary">Krok {position + 1} z {steps.length}</p>
      {step.blocks.map((block) => isQuestion(block) ? <GuidedQuestion key={`${position}-${block.id}`} block={block} answers={answers} verdict={verdict} mastery={step.kind === "mastery"} onAnswer={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))} /> : <GuidedBlock key={`${position}-${block.id}`} block={block} />)}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={position === 0} onClick={() => move(position - 1)}>Předchozí</Button>
        {question && verdict !== true ? <Button disabled={evaluation === undefined} onClick={() => setVerdict(evaluation)}>Zkontrolovat odpověď</Button> : position < steps.length - 1 ? <Button onClick={() => move(position + 1)}>Pokračovat</Button> : <Button onClick={() => move(0)}>Projít náhled znovu</Button>}
        {verdict === false ? <Button variant="ghost" onClick={() => { setAnswers({}); setVerdict(undefined); }}>Zkusit znovu</Button> : null}
      </div>
    </section>
  </main>;
}
