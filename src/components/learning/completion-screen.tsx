"use client";
import { motion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useLearningDuration } from "./motion";
import { formatPracticeCapitalMinor, type SerializedPracticeCapitalMinor } from "@/features/rewards/presentation";

export function CompletionScreen({ title, description, xpAwarded, practiceCapitalAwardedMinor, children, onContinue, autoFocusAction = false, actionLabel = "Pokračovat v učení" }: { title: string; description: string; xpAwarded?: number; practiceCapitalAwardedMinor?: SerializedPracticeCapitalMinor; children?: ReactNode; onContinue: () => void; autoFocusAction?: boolean; actionLabel?: string }) {
  const duration = useLearningDuration("reward");
  const formattedReward = practiceCapitalAwardedMinor === undefined ? undefined : formatPracticeCapitalMinor(practiceCapitalAwardedMinor);
  const descriptionId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Replacing a tall exercise can leave the completion title above the viewport.
    if (autoFocusAction) sectionRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [autoFocusAction]);
  return <section ref={sectionRef} className="mx-auto max-w-xl px-5 py-8 text-center sm:px-8 sm:py-10">
    <motion.div id={descriptionId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration }}>
      <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-success bg-success-soft">{formattedReward !== undefined ? <Image src="/brand/growing-coin.webp" alt="" width={96} height={96} className="size-12 object-contain" /> : <CircleCheck aria-hidden="true" className="size-9 text-success-ink" />}</div>
      <p className="mt-5 text-microcopy font-extrabold tracking-[0.08em] text-success-ink uppercase">Postup uložen</p>
      <h2 className="mt-1 text-page-title font-bold tracking-[-0.025em]">{title}</h2>
      <p className="mt-3 text-body text-secondary">{description}</p>
      {xpAwarded ? <p className="mt-4 text-emphasis font-bold text-primary" aria-label={`Získáno ${xpAwarded} XP`}>+{xpAwarded} XP</p> : null}
      {formattedReward !== undefined ? <div className="mx-auto mt-5 max-w-full rounded-surface border border-warning bg-warning-soft px-5 py-3 text-warning-ink" aria-label={`Získaný cvičný kapitál: ${formattedReward}`}><p aria-hidden="true" className="break-words text-emphasis font-extrabold tabular-nums">+{formattedReward}</p><p aria-hidden="true" className="mt-0.5 text-small font-bold">Získaný cvičný kapitál</p></div> : null}
    </motion.div>
    {children}
    <Button autoFocus={autoFocusAction} aria-describedby={descriptionId} className="mt-7 w-full" onClick={onContinue}>{actionLabel}</Button>
  </section>;
}
