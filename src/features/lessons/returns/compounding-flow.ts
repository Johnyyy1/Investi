import type { AuthoredLesson } from "../types";

/** Presentation order only. Explanations, examples and answers stay in the authored lesson. */
export const compoundingSteps = [
  { title: "Od jednoho období k posloupnosti", blocks: ["why-addition-fails", "recap"] },
  { title: "Předpověz výsledek", blocks: ["prediction"] },
  { title: "Počáteční hodnota se mění", blocks: ["twenty-example"] },
  { title: "Přemýšlej v růstových faktorech", blocks: ["growth-factors", "growth-callout", "growth-practice"] },
  { title: "Vynásob růstové faktory", blocks: ["cumulative-formula", "value-formula", "ending-value-practice"] },
  { title: "Prozkoumej složené zhodnocení", blocks: ["explore", "compounding-explorer", "two-gains"] },
  { title: "Propoj výnosy s cenami", blocks: ["price-series", "price-series-example", "multi-period"] },
  { title: "Zotavení po ztrátě", blocks: ["asymmetry", "recovery-explorer", "loss-practice"] },
  { title: "Ověř si porozumění", blocks: ["concept"] },
  { title: "Slož výnosy reálného instrumentu", blocks: ["real-history", "real-history-figure"] },
  { title: "Spoj si to dohromady", blocks: ["takeaway", "checkpoint"] },
] as const;

export function getCompoundingSteps(lesson: AuthoredLesson) {
  return compoundingSteps.map((step) => ({ title: step.title, blocks: step.blocks.map((id) => {
    const block = lesson.blocks.find((item) => item.id === id);
    if (!block) throw new Error(`Missing authored compounding block: ${id}`);
    return block;
  }) }));
}
