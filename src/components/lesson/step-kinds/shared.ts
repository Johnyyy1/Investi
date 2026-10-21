import { cn } from "@/lib/utils";

export const eyebrow = "text-[11px] font-semibold tracking-[0.9px] uppercase md:text-xs md:tracking-[1px]";
export const cardTitle = "text-[19px]/6 font-semibold tracking-[-0.3px] md:text-[22px]/7";

/** The question card surface: mastery steps sit on the calmer practice surface, like GuidedQuestion. */
export function questionCard(mastery: boolean, className?: string) {
  return cn("overflow-hidden rounded-surface border", mastery ? "border-border bg-surface-practice" : "border-border-card bg-surface shadow-elevation-1", className);
}
export const plainCard = "overflow-hidden rounded-surface border border-border-card bg-surface shadow-elevation-1";

/** Rough sentence count for writing hints only; abbreviations like "tj." can miscount, so it never validates. */
export function countSentences(text: string) {
  return text.split(/[.!?…]+(?:\s|$)/).filter((part) => part.trim().length > 1).length;
}
