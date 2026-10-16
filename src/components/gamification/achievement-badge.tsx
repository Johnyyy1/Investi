"use client";
import { motion } from "motion/react";
import { LockKeyhole, Trophy } from "lucide-react";
import { useLearningDuration } from "@/components/learning/motion";

export function AchievementBadge({ title, description, unlocked }: { title: string; description: string; unlocked: boolean }) {
  const duration = useLearningDuration("reward");
  const Icon = unlocked ? Trophy : LockKeyhole;
  return <div className="flex items-start gap-3">
    <motion.span initial={false} animate={{ opacity: unlocked ? 1 : 0.8 }} transition={{ duration }} className={`flex size-12 shrink-0 items-center justify-center rounded-control ${unlocked ? "bg-warning-soft text-warning-ink" : "bg-surface-muted text-secondary"}`}><Icon className="size-5" aria-hidden="true" /></motion.span>
    <div><p className="text-small font-semibold">{title} <span className="font-normal text-secondary">· {unlocked ? "Unlocked" : "Locked"}</span></p><p className="mt-1 text-small text-secondary">{description}</p></div>
  </div>;
}
