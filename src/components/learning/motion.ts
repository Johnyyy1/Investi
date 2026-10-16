"use client";
import { useReducedMotion } from "motion/react";

/** Seconds for Motion. Matching semantic CSS durations live in styles/tokens.css. */
export const learningMotion = { fast: 0.18, normal: 0.27, reward: 0.4 } as const;
export function useLearningDuration(speed: keyof typeof learningMotion = "normal") {
  return useReducedMotion() ? 0 : learningMotion[speed];
}
