"use client";

import type { ReactNode } from "react";
import { CircleCheck, CircleX, MousePointerClick, Search } from "lucide-react";
import type { LessonBlock } from "@/features/lessons/types";
import { cn } from "@/lib/utils";
import { AnswerChoice, type ChoiceState } from "../lesson-answer";
import { cardTitle, eyebrow, plainCard, questionCard } from "./shared";

type Block = Extract<LessonBlock, { type: "findError" }>;

/** Design I: tap the wrong row of a calculation, then choose its fix. Whole rows are the touch targets. */
export function FindError({ block, answers, verdict, mastery, onAnswer, feedback }: {
  block: Block; answers: Record<string, string>; verdict?: boolean; mastery: boolean; onAnswer: (id: string, value: string) => void; feedback: ReactNode;
}) {
  const checked = verdict !== undefined;
  const rowIndex = block.rows.findIndex((row) => row.id === answers.row);
  function fixState(id: string): ChoiceState {
    if (!checked) return answers.fix === id ? "selected" : "idle";
    return answers.fix === id ? verdict ? "correct" : "incorrect" : "off";
  }
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:items-start lg:gap-7">
    <section aria-labelledby={`${block.id}-title`} className={cn(plainCard, "min-w-0")}>
      <div className="flex flex-col gap-3.5 p-[18px] md:px-6 md:py-5">
        <div className="flex flex-col gap-1.5">
          <p className={cn(eyebrow, "flex items-center gap-1.5 text-primary")}><Search aria-hidden="true" className="size-3.5" />Najdi chybu ve výpočtu</p>
          <h3 id={`${block.id}-title`} className={cardTitle}>{block.title}</h3>
          {block.introduction ? <p className="text-sm/[21px] text-secondary">{block.introduction}</p> : null}
        </div>
        <fieldset disabled={checked} className="flex flex-col gap-2">
          <legend className="sr-only">Vyber řádek s chybou</legend>
          {block.rows.map((row, index) => {
            const isSelected = answers.row === row.id;
            const solved = verdict === true;
            const fixed = solved && row.id === block.errorRowId;
            return <label key={row.id} className={cn("relative flex gap-3 rounded-control border px-3.5 py-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground",
              isSelected ? checked && !verdict ? "border-danger bg-surface" : "border-primary bg-surface-practice" : "border-transparent bg-surface-sunken")}>
              <input type="radio" name={`${block.id}-row`} value={row.id} checked={isSelected} onChange={() => onAnswer("row", row.id)} aria-label={`Řádek ${index + 1}: ${row.label}, ${row.value}`} className="absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-control opacity-0 disabled:cursor-default" />
              <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-secondary">{index + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm/5 text-secondary">{row.label}</span>
                <span className={cn("text-[17px]/[23px] tabular-nums", fixed ? "font-normal text-secondary line-through decoration-1" : "font-semibold text-foreground")}>{row.value}</span>
                {solved && row.correction ? <span className="text-sm/5 font-semibold text-primary">Oprava: {row.correction}</span> : null}
              </span>
              {isSelected ? checked ? verdict ? <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-primary" /> : <CircleX aria-hidden="true" className="size-5 shrink-0 text-danger" /> : <MousePointerClick aria-hidden="true" className="size-5 shrink-0 text-primary" /> : null}
            </label>;
          })}
        </fieldset>
      </div>
    </section>
    <section aria-labelledby={`${block.id}-fix`} aria-describedby={checked ? `${block.id}-feedback` : undefined} className={questionCard(mastery, "lg:sticky lg:top-6")}>
      <div className="flex flex-col gap-3 p-[18px] md:px-6 md:py-5">
        <p id={`${block.id}-fix`} className={cn(eyebrow, "text-primary")}>{rowIndex >= 0 ? `Co je v řádku ${rowIndex + 1} špatně?` : "Nejdřív vyber řádek"}</p>
        {rowIndex >= 0 ? <fieldset disabled={checked} className="flex flex-col gap-2">
          <legend className="sr-only">Vyber opravu</legend>
          {block.fixes.map((fix, index) => <AnswerChoice key={fix.id} name={`${block.id}-fix`} value={fix.id} letter={String.fromCharCode(65 + index)} checked={answers.fix === fix.id} state={fixState(fix.id)} onChange={(value) => onAnswer("fix", value)}>{fix.label}</AnswerChoice>)}
        </fieldset> : <p className="text-[15px]/[23px] text-secondary">Klepni na řádek, ve kterém je podle tebe chyba. Potom vybereš, jak ho opravit.</p>}
      </div>
      {feedback}
    </section>
  </div>;
}
