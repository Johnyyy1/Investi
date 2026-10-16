"use client";

import { parseNumericAnswer, type QuestionBlock } from "@/features/lessons/question-evaluation";
import { cn } from "@/lib/utils";
import { AnswerChoice, NumberField, QuestionFeedback, type ChoiceState } from "./lesson-answer";

/** Controlled question card; the lesson action bar owns Check → Continue / Try again. */
export function GuidedQuestion({ block, answers, verdict, mastery, onAnswer }: {
  block: QuestionBlock; answers: Record<string, string>; verdict?: boolean; mastery: boolean; onAnswer: (id: string, value: string) => void;
}) {
  const checked = verdict !== undefined;
  const fields = block.type === "multiNumericQuestion" ? block.answers : block.type === "numericQuestion" ? [{ id: "answer", label: "Tvoje odpověď", unit: block.unit, answer: block.answer, tolerance: block.tolerance }] : [];
  function choiceState(id: string): ChoiceState {
    if (!checked) return answers.answer === id ? "selected" : "idle";
    return answers.answer === id ? verdict ? "correct" : "incorrect" : "off";
  }
  return <section aria-labelledby={`${block.id}-question`} aria-describedby={checked ? `${block.id}-feedback` : undefined} className={cn("overflow-hidden rounded-surface border", mastery ? "border-border bg-surface-practice" : "border-border-card bg-surface shadow-elevation-1")}>
    <div className="flex flex-col gap-3.5 p-[18px] md:gap-[18px] md:px-7 md:py-[26px]">
      {mastery ? null : <p className="text-[11px] font-semibold tracking-[0.9px] text-primary uppercase md:text-xs md:tracking-[1px]">Ověř si porozumění</p>}
      <h3 id={`${block.id}-question`} className="text-[19px]/6 font-semibold tracking-[-0.3px] md:text-[22px]/7">{block.prompt}</h3>
      {block.type === "multipleChoiceQuestion" ? <fieldset disabled={checked} className="flex flex-col gap-2 md:gap-2.5">
        <legend className="sr-only">Vyber odpověď</legend>
        {block.options.map((option, index) => <AnswerChoice key={option.id} name={block.id} value={option.id} letter={String.fromCharCode(65 + index)} checked={answers.answer === option.id} state={choiceState(option.id)} onChange={(value) => onAnswer("answer", value)}>{option.label}</AnswerChoice>)}
      </fieldset> : <div className="flex flex-col gap-3.5 md:gap-5">{fields.map((field) => {
        const raw = answers[field.id] ?? "";
        const parsed = parseNumericAnswer(raw);
        const fieldCorrect = Number.isFinite(parsed) && Math.abs(parsed - field.answer) <= field.tolerance;
        return <NumberField key={field.id} label={field.label} unit={field.unit || undefined} value={raw} onValueChange={(value) => onAnswer(field.id, value)} disabled={checked} state={checked ? fieldCorrect ? "correct" : "incorrect" : "idle"} hint={field.unit === "%" ? "Zadej procento jako číslo." : field.unit ? `Zadej číselnou hodnotu v ${field.unit}.` : "Zadej číselnou hodnotu."} error={raw && !Number.isFinite(parsed) ? "Zadej konečné číslo." : undefined} />;
      })}</div>}
    </div>
    <QuestionFeedback id={`${block.id}-feedback`} verdict={verdict}>{verdict ? block.correctExplanation : block.incorrectExplanation}</QuestionFeedback>
  </section>;
}
