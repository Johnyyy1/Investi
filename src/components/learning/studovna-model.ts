import type { loadLearner } from "@/features/learning/load-learner";
import { getAuthoredLesson } from "@/features/lessons/registry";
import { getGuidedSteps } from "@/features/lessons/returns/guided-flow";
import type { LessonBlock } from "@/features/lessons/types";
import type { PortfolioView } from "@/features/portfolio/service";
import { roundDivide } from "@/features/portfolio/decimal";

export type LearnerSummary = Awaited<ReturnType<typeof loadLearner>>;

/** Curriculum labels shared by Studovna and Pokrok. Planned risk topics form one upcoming chapter. */
export const chapterTitle = (chapter: { slug: string; title: string }) => chapter.slug === "returns" ? "Výnosy" : chapter.title;
export const PLANNED_CHAPTER_TITLE = "Riziko";

export function blockDescription(block: LessonBlock): string | undefined {
  if ("content" in block) return block.content;
  if (block.type === "heading") return block.body;
  if (block.type === "interactiveFigure") return block.description;
  if (block.type === "workedExample") return block.conclusion;
  return undefined;
}

/** The preview is always the persisted cursor, never a later exercise. */
export function studovnaLesson(summary: Pick<LearnerSummary, "next" | "position">) {
  const lesson = getAuthoredLesson(summary.next.moduleSlug, summary.next.slug)!;
  const steps = getGuidedSteps(lesson);
  const step = steps[summary.position];
  const question = step.blocks.find((block) => block.type === "multipleChoiceQuestion");
  const recap = steps.slice(0, summary.position).flatMap((item) => item.blocks)
    .filter((block) => ["conceptCallout", "paragraph", "heading", "takeaway", "interactiveFigure"].includes(block.type))
    .filter((block) => blockDescription(block)).slice(-2)
    .map((block) => ({ title: "title" in block ? block.title : "Už znáš souvislosti", body: blockDescription(block)! }));
  return { lesson, step, question, recap };
}

/** Presentation ratios only. Money remains integer minor units from the service.
 * ETFs stay separate: their underlying asset allocation is not inferred. */
export function portfolioComposition(view: Pick<PortfolioView, "valuationComplete" | "portfolioTotalMinor" | "holdings" | "availableCashMinor">) {
  if (!view.valuationComplete || view.portfolioTotalMinor === null) return null;
  const total = BigInt(view.portfolioTotalMinor);
  if (total <= 0n || view.holdings.some((holding) => holding.marketValueMinor === null)) return null;
  const amounts = new Map<string, bigint>();
  for (const holding of view.holdings) amounts.set(holding.assetType, (amounts.get(holding.assetType) ?? 0n) + BigInt(holding.marketValueMinor!));
  amounts.set("cash", (amounts.get("cash") ?? 0n) + BigInt(view.availableCashMinor));
  const categories = [
    { id: "equity", label: "Akcie", color: "var(--color-teal)" },
    { id: "etf", label: "ETF", color: "var(--color-info-ink)" },
    { id: "bond", label: "Dluhopisy", color: "var(--color-viz-bonds)" },
    { id: "index", label: "Indexy", color: "var(--color-viz-other)" },
    { id: "cash", label: "Hotovost", color: "var(--color-viz-cash)" },
  ];
  return categories.filter(({ id }) => (amounts.get(id) ?? 0n) > 0n)
    .map((category) => ({ ...category, percent: Number(roundDivide(amounts.get(category.id)! * 1000n, total)) / 10 }));
}
