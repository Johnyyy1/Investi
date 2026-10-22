"use client";

import { Select } from "@/components/ui/form-controls";
import type { ExerciseBlock } from "@/features/lessons/types";
import { AnswerChoice, NumberField, type ChoiceState } from "./lesson-answer";

/** Native controls expose every operation without drag-and-drop or spatial-only instructions. */
export function GuidedExercise({ block, answers, verdict, onAnswer }: {
  block: ExerciseBlock; answers: Record<string, string>; verdict?: boolean; onAnswer: (id: string, value: string) => void;
}) {
  const disabled = verdict !== undefined;
  const state = (id: string): ChoiceState => answers.answer !== id ? disabled ? "off" : "idle" : disabled ? verdict ? "correct" : "incorrect" : "selected";
  if (block.type === "categorizeQuestion" || block.type === "orderQuestion") return <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
    <legend className="mb-3 text-sm text-secondary">{block.type === "categorizeQuestion" ? "Vyber kategorii pro každou položku." : "Vyber položky od první po poslední. Každou použij právě jednou."}</legend>
    {block.items.map((item, index) => {
      const key = block.type === "categorizeQuestion" ? item.id : String(index);
      return <label key={key} className="flex min-w-0 flex-col gap-2 text-base text-foreground">
        <span>{block.type === "categorizeQuestion" ? item.label : `${index + 1}. místo`}</span>
        <Select value={answers[key] ?? ""} onChange={(event) => onAnswer(key, event.target.value)}>
          <option value="">Vyber {block.type === "categorizeQuestion" ? "kategorii" : "položku"}</option>
          {(block.type === "categorizeQuestion" ? block.categories : block.items).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </Select>
      </label>;
    })}
  </fieldset>;
  if (block.type === "documentSearchQuestion" && block.target.type === "numeric") return <div className="space-y-5">
    <section aria-label={block.document.title} className="space-y-3 border-b border-divider pb-5"><h4 className="font-semibold">{block.document.title}</h4><dl className="space-y-3">{block.document.regions.map((region) => <div key={region.id}><dt className="font-semibold">{region.label}</dt><dd className="whitespace-pre-line text-secondary">{region.content}</dd></div>)}</dl></section>
    <NumberField label="Hodnota z dokumentu" unit={block.target.unit} value={answers.answer ?? ""} disabled={disabled} state={disabled ? verdict ? "correct" : "incorrect" : "idle"} hint="Najdi údaj v dokumentu a zadej číselnou hodnotu." onValueChange={(value) => onAnswer("answer", value)} />
  </div>;
  const options = block.type === "findErrorQuestion" ? block.steps : block.document.regions;
  return <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-3">
    <legend className="mb-3 text-sm text-secondary">{block.type === "findErrorQuestion" ? "Označ krok, který obsahuje chybu." : block.document.title}</legend>
    {options.map((option, index) => <AnswerChoice key={option.id} name={block.id} value={option.id} letter={String.fromCharCode(65 + index)} state={state(option.id)} checked={answers.answer === option.id} onChange={(value) => onAnswer("answer", value)}>
      <span className="block">{option.label}</span>{"content" in option && <span className="mt-1 block whitespace-pre-line text-secondary">{String(option.content)}</span>}
    </AnswerChoice>)}
  </fieldset>;
}
