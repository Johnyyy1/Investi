"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { evaluateQuestion, isQuestion } from "@/features/lessons/question-evaluation";
import { stepWidth } from "@/features/lessons/step-kinds";
import type { LessonBlock } from "@/features/lessons/types";
import { timeTestSpecimens } from "@/features/lessons/specimens/time-test";
import { cn } from "@/lib/utils";
import { GuidedBlock } from "../guided-block";
import { GuidedQuestion } from "../guided-question";

const sections: { kind: keyof typeof timeTestSpecimens; code: string; title: string }[] = [
  { kind: "fadedExample", code: "F", title: "Dokonči příklad" },
  { kind: "choice", code: "G", title: "Výběr s vysvětlením ke každé možnosti" },
  { kind: "documentTap", code: "H", title: "Dokument — klepni na správné místo" },
  { kind: "findError", code: "I", title: "Najdi chybu" },
  { kind: "personaDecision", code: "J", title: "Rozhodnutí za personu" },
  { kind: "labMission", code: "K", title: "Mise v Labu" },
  { kind: "factNotice", code: "L", title: "Daňový a regulatorní blok" },
  { kind: "writtenReflection", code: "M", title: "Krátký psaný výstup" },
];

/** Development gallery of every step kind on its reference content, with the real Check → feedback → retry loop. */
export function StepSpecimenGallery() {
  return <main className="mx-auto flex max-w-[1312px] flex-col gap-16 px-5 py-10 md:px-8">
    <header className="flex flex-col gap-2">
      <p className="text-xs font-semibold tracking-[1px] text-muted uppercase">Investník · lekce · typy kroků</p>
      <h1 className="text-[34px]/[40px] font-semibold tracking-[-1px]">Typy kroků lekce</h1>
      <p className="max-w-[720px] text-base/[25px] text-secondary">Každý typ kroku na referenčním obsahu „Časový test“. Návrhy jsou v docs/design/lesson-steps, popis v docs/education/lesson-steps.md.</p>
    </header>
    {sections.map(({ kind, code, title }) => <Specimen key={kind} code={code} title={title} block={timeTestSpecimens[kind] as LessonBlock} />)}
  </main>;
}

function Specimen({ code, title, block }: { code: string; title: string; block: LessonBlock }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [verdict, setVerdict] = useState<boolean>();
  const question = isQuestion(block) ? block : undefined;
  const evaluation = question ? evaluateQuestion(question, answers) : undefined;
  return <section aria-labelledby={`${block.id}-section`} data-step-kind={block.type} className={cn("mx-auto flex w-full min-w-0 flex-col gap-4", stepWidth([block]))}>
    <h2 id={`${block.id}-section`} className="text-sm font-semibold text-primary">{code} · {title} <code className="ml-1 font-normal text-muted">{block.type}</code></h2>
    {question ? <>
      <GuidedQuestion block={question} answers={answers} verdict={verdict} mastery={false} onAnswer={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))} />
      <div className="flex justify-end">
        {verdict === undefined ? <Button disabled={evaluation === undefined} onClick={() => setVerdict(evaluation)}>Zkontrolovat odpověď</Button>
          : <Button variant="secondary" onClick={() => { setAnswers({}); setVerdict(undefined); }}><RotateCcw aria-hidden="true" className="size-4" />Znovu</Button>}
      </div>
    </> : <GuidedBlock block={block} />}
  </section>;
}
