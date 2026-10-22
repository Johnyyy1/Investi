"use client";

import { useId, type ReactNode } from "react";
import { Circle, CircleCheck, CircleDot, CircleX, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChoiceState = "idle" | "selected" | "correct" | "incorrect" | "off";

const choiceStates: Record<ChoiceState, string> = {
  idle: "border-border-strong bg-surface hover:bg-surface-sunken",
  selected: "border-primary bg-surface-practice shadow-[inset_0_0_0_0.5px_var(--color-primary)]",
  correct: "border-primary bg-primary-soft shadow-[inset_0_0_0_0.5px_var(--color-primary)]",
  incorrect: "border-danger bg-surface shadow-[inset_0_0_0_0.5px_var(--color-danger)]",
  off: "border-divider bg-surface",
};
const choiceIcons: Record<ChoiceState, ReactNode> = {
  idle: <Circle aria-hidden="true" className="size-5 shrink-0 text-border-strong" />,
  selected: <CircleDot aria-hidden="true" className="size-5 shrink-0 text-primary" />,
  correct: <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-primary" />,
  incorrect: <CircleX aria-hidden="true" className="size-5 shrink-0 text-danger" />,
  off: <Circle aria-hidden="true" className="size-5 shrink-0 text-border" />,
};

/** Native radio stretched over the whole row, so pointer, keyboard and assistive tech all hit the real input. */
export function AnswerChoice({ name, value, letter, state, checked, onChange, children }: {
  name: string; value: string; letter?: string; state: ChoiceState; checked: boolean; onChange: (value: string) => void; children: ReactNode;
}) {
  const statusId = useId();
  const textId = useId();
  return <label className={cn("relative flex items-center gap-3.5 rounded-control border px-3.5 py-[13px] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground has-[:disabled]:cursor-default md:px-5 md:py-4", choiceStates[state])}>
    <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} aria-labelledby={textId} aria-describedby={state === "correct" || state === "incorrect" ? statusId : undefined} className="absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-control opacity-0 focus-visible:outline-none disabled:cursor-default" />
    {letter ? <span aria-hidden="true" className="w-3 shrink-0 text-[13px] font-semibold text-muted">{letter}</span> : null}
    <span id={textId} className={cn("min-w-0 flex-1 text-[15px]/[22px] md:text-base/[23px]", state === "off" ? "text-muted" : "text-foreground")}>{children}</span>
    {choiceIcons[state]}
    <span id={statusId} className="sr-only">{state === "correct" ? "Správná odpověď" : state === "incorrect" ? "Nesprávná odpověď" : ""}</span>
  </label>;
}

export type FieldState = "idle" | "correct" | "incorrect";

export function NumberField({ label, unit, value, onValueChange, disabled, state, hint, error }: {
  label: string; unit?: string; value: string; onValueChange: (value: string) => void; disabled: boolean; state: FieldState; hint: string; error?: string;
}) {
  const id = useId();
  return <div className="flex min-w-0 flex-col gap-1.5">
    <label htmlFor={id} className="text-sm/[18px] font-semibold text-foreground">{label}</label>
    <div className={cn("flex h-[52px] items-center gap-2 rounded-control border px-3.5", state === "correct" ? "border-primary bg-primary-soft shadow-[inset_0_0_0_0.5px_var(--color-primary)]" : state === "incorrect" || error ? "border-danger bg-surface shadow-[inset_0_0_0_0.5px_var(--color-danger)]" : "border-border-strong bg-surface focus-within:border-primary focus-within:shadow-[inset_0_0_0_0.5px_var(--color-primary)]")}>
      <input id={id} type="text" inputMode="decimal" autoComplete="off" value={value} disabled={disabled} onChange={(event) => onValueChange(event.target.value)} aria-invalid={state === "incorrect" || Boolean(error)} aria-describedby={`${id}-hint`} className="h-full min-w-0 flex-1 bg-transparent text-xl font-semibold tabular-nums text-foreground caret-primary focus-visible:outline-none disabled:text-foreground disabled:opacity-100" />
      {unit ? <span className="shrink-0 text-[15px] text-muted">{unit}</span> : null}
      {state === "correct" ? <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-primary" /> : state === "incorrect" ? <CircleX aria-hidden="true" className="size-5 shrink-0 text-danger" /> : null}
    </div>
    <p id={`${id}-hint`} className={cn("text-[13px]/[19px]", error ? "text-danger" : "text-muted")}>{error ?? hint}</p>
  </div>;
}

/**
 * In-card result. The live region stays mounted so the verdict is announced when it appears.
 * `misconception` names the mistaken idea behind a wrong answer ("Častá záměna: …"); `detail` adds a short count line.
 */
export function QuestionFeedback({ id, verdict, misconception, detail, children }: { id: string; verdict?: boolean; misconception?: string; detail?: string; children?: ReactNode }) {
  return <div id={id} role="status" aria-live="polite">
    {verdict === undefined ? null : <div className={cn("-mt-px flex flex-col gap-1.5 border-t px-[18px] pt-3.5 pb-4 md:px-7 md:pt-[18px] md:pb-5", verdict ? "border-primary/20 bg-primary-soft" : "border-danger/20 bg-surface")}>
      <div className="flex items-center gap-2">
        {verdict ? <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-primary" /> : <RotateCcw aria-hidden="true" className="size-5 shrink-0 text-danger" />}
        <h4 className={cn("text-[19px]/6 font-semibold tracking-[-0.3px] md:text-[21px]/[27px]", verdict ? "text-primary" : "text-danger")}>{verdict ? "Správně" : "Zkus to ještě jednou"}</h4>
      </div>
      {!verdict && (misconception || detail) ? <p className="text-[13px]/[19px] font-semibold text-secondary">{misconception ? `Častá záměna: ${misconception}` : detail}</p> : null}
      <p className="text-[15px]/[23px] text-foreground">{children}</p>
    </div>}
  </div>;
}
