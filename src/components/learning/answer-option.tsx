"use client";

import { useId, type ReactNode } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";

export type AnswerState = "idle" | "selected" | "correct" | "incorrect" | "disabled";
const states: Record<AnswerState, string> = {
  idle: "border-border-strong bg-surface",
  selected: "border-primary-hover bg-primary-soft",
  correct: "border-success-ink bg-success-soft",
  incorrect: "border-danger-ink bg-danger-soft",
  disabled: "border-border bg-background text-secondary",
};
export function AnswerOption({ name, value, type = "radio", state = "idle", checked, disabled = false, onChange, children, shortcut }: {
  name: string; value: string; type?: "radio" | "checkbox"; state?: AnswerState; checked?: boolean; disabled?: boolean;
  onChange?: (value: string) => void; children: ReactNode; shortcut?: string;
}) {
  const id = useId();
  const unavailable = disabled || state === "disabled";
  return <label className={cn("relative flex min-h-14 cursor-pointer items-center gap-3 rounded-control border-2 px-4 py-3 text-body transition-colors duration-[var(--motion-micro)] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-primary", states[state], unavailable && "cursor-default")}>
    <input className="size-4 shrink-0 accent-primary" type={type} name={name} value={value} checked={checked ?? state === "selected"} disabled={unavailable} onChange={() => onChange?.(value)} aria-describedby={state === "correct" || state === "incorrect" ? id : undefined} />
    <span className="min-w-0 flex-1">{children}</span>
    {shortcut ? <span aria-hidden="true" className="text-microcopy text-secondary">{shortcut}</span> : null}
    {state === "correct" ? <CircleCheck className="size-5 shrink-0 text-success-ink" aria-hidden="true" /> : null}
    {state === "incorrect" ? <CircleX className="size-5 shrink-0 text-danger-ink" aria-hidden="true" /> : null}
    <span id={id} className="sr-only">{state === "correct" ? "Správná odpověď" : state === "incorrect" ? "Nesprávná odpověď" : ""}</span>
  </label>;
}
