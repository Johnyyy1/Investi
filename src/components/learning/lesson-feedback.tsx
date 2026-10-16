"use client";
import { useId, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { feedbackVariants } from "@/components/ui/feedback";
import { ArrowLeft, CheckCircle2, Info, XCircle } from "lucide-react";

export function LessonFeedback({ state, title, children, onContinue, onPrevious, actionLabel = "Pokračovat", sticky = false, autoFocusAction = false, actionPending = false, actionButtonRef }: {
  state: "correct" | "incorrect" | "informational"; title: string; children: ReactNode; onContinue?: () => void; onPrevious?: () => void; actionLabel?: string; sticky?: boolean; autoFocusAction?: boolean; actionPending?: boolean; actionButtonRef?: Ref<HTMLButtonElement>;
}) {
  const descriptionId = useId();
  const Icon = state === "correct" ? CheckCircle2 : state === "incorrect" ? XCircle : Info;
  return <section aria-label="Zpětná vazba k odpovědi" className={cn("rounded-surface px-5 py-5 sm:px-6", feedbackVariants({ state }), sticky && "sticky bottom-3 z-20 shadow-elevation-2")}>
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 gap-3"><Icon aria-hidden="true" className={cn("mt-0.5 size-6 shrink-0", state === "correct" ? "text-success-ink" : state === "incorrect" ? "text-danger-ink" : "text-info-ink")} /><div id={descriptionId} role="status" aria-live="polite"><h3 className="text-card-title font-bold">{title}</h3><div className="mt-1 max-w-xl text-small">{children}</div></div></div>
      <div className="flex flex-col-reverse gap-2 min-[420px]:flex-row sm:shrink-0">{onPrevious ? <Button disabled={actionPending} variant="ghost" onClick={onPrevious}><ArrowLeft aria-hidden="true" className="size-4" />Předchozí</Button> : null}{onContinue ? <Button buttonRef={actionButtonRef} loading={actionPending} autoFocus={autoFocusAction} aria-describedby={descriptionId} onClick={onContinue}>{actionLabel}</Button> : null}</div>
    </div>
  </section>;
}
