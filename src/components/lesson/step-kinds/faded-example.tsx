"use client";

import type { ReactNode } from "react";
import { Calculator } from "lucide-react";
import type { LessonBlock } from "@/features/lessons/types";
import { parseNumericAnswer } from "@/features/lessons/question-evaluation";
import { cn } from "@/lib/utils";
import { AnswerChoice, NumberField, type ChoiceState } from "../lesson-answer";
import { cardTitle, eyebrow, questionCard } from "./shared";

type Block = Extract<LessonBlock, { type: "fadedExample" }>;

/** Design F: the worked example's earlier rows are filled in; the learner completes the last one inside the card. */
export function FadedExample({ block, answers, verdict, mastery, onAnswer, feedback }: {
  block: Block; answers: Record<string, string>; verdict?: boolean; mastery: boolean; onAnswer: (id: string, value: string) => void; feedback: ReactNode;
}) {
  const checked = verdict !== undefined;
  const { blank } = block;
  const position = block.steps.length + 1;
  const chosen = blank.input === "choice" ? blank.options.find((option) => option.id === answers.answer)?.label : answers.answer ? `${answers.answer} ${blank.unit}`.trim() : undefined;
  function choiceState(id: string): ChoiceState {
    if (!checked) return answers.answer === id ? "selected" : "idle";
    return answers.answer === id ? verdict ? "correct" : "incorrect" : "off";
  }
  const raw = answers.answer ?? "";
  return <section aria-labelledby={`${block.id}-title`} aria-describedby={checked ? `${block.id}-feedback` : undefined} className={questionCard(mastery)}>
    <div className="flex flex-col gap-3.5 p-[18px] md:gap-[18px] md:px-7 md:py-6">
      <div className="flex flex-col gap-1.5">
        <p className={cn(eyebrow, "flex items-center gap-1.5 text-primary")}><Calculator aria-hidden="true" className="size-3.5" />Řešený příklad · dokonči</p>
        <h3 id={`${block.id}-title`} className={cardTitle}>{block.title}</h3>
      </div>
      {block.introduction ? <p className="text-[15px]/[23px] text-secondary">{block.introduction}</p> : null}
      <ol className="flex flex-col gap-1.5">
        {block.steps.map((step, index) => {
          const stacked = step.value.length > 14;
          return <li key={step.label} className={cn("rounded-md bg-surface-sunken px-3 py-2.5", stacked ? "flex flex-col gap-0.5" : "flex items-center justify-between gap-3")}>
            <span className="text-sm/5 text-secondary">{index + 1} · {step.label}</span>
            <span className={cn("font-semibold tabular-nums text-foreground", stacked ? "text-base/[21px]" : "text-right text-[17px]/[22px]")}>{step.value}</span>
          </li>;
        })}
        <li className={cn("flex flex-col gap-3 rounded-control border p-3", !checked ? "border-primary/40 bg-surface" : verdict ? "border-primary bg-primary-soft" : "border-danger bg-surface")}>
          <div className="flex items-start justify-between gap-3">
            <p id={`${block.id}-blank`} className="text-sm/5 font-semibold text-foreground">{position} · {blank.label}</p>
            {checked && chosen ? <span className={cn("shrink-0 text-sm font-semibold", verdict ? "text-primary" : "text-danger")}>{chosen}</span> : null}
          </div>
          {blank.input === "choice" ? <fieldset disabled={checked} aria-labelledby={`${block.id}-blank`} className={cn("grid gap-2", blank.options.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
            {blank.options.map((option) => <AnswerChoice key={option.id} name={block.id} value={option.id} checked={answers.answer === option.id} state={choiceState(option.id)} onChange={(value) => onAnswer("answer", value)}>{option.label}</AnswerChoice>)}
          </fieldset> : <NumberField label="Tvoje doplnění" unit={blank.unit || undefined} value={raw} onValueChange={(value) => onAnswer("answer", value)} disabled={checked}
            state={checked ? verdict ? "correct" : "incorrect" : "idle"} hint={blank.unit ? `Zadej číselnou hodnotu v ${blank.unit}.` : "Zadej číselnou hodnotu."}
            error={raw && !Number.isFinite(parseNumericAnswer(raw)) ? "Zadej konečné číslo." : undefined} />}
        </li>
      </ol>
    </div>
    {feedback}
  </section>;
}
