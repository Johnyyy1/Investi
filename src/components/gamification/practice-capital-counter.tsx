"use client";
import { motion } from "motion/react";
import { useLearningDuration } from "@/components/learning/motion";
import { formatPracticeCapitalMinor } from "@/features/rewards/presentation";

export function PracticeCapitalCounter({ value }: { value: bigint }) {
  const duration = useLearningDuration("reward");
  const formatted = formatPracticeCapitalMinor(value);
  return <span aria-live="polite" aria-atomic="true" aria-label={`Cvičný kapitál: ${formatted}`} className="inline-flex min-w-0 flex-col text-small">
    <span className="text-microcopy font-semibold text-secondary">Cvičný kapitál</span>
    <motion.span aria-hidden="true" key={value.toString()} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} transition={{ duration }} className="break-words font-bold text-primary tabular-nums">{formatted}</motion.span>
  </span>;
}
