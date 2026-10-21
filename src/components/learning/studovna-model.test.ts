import { describe, expect, it } from "vitest";
import { availableLessons } from "@/features/learning/catalog";
import { getGuidedSteps } from "@/features/lessons/steps";
import { getAuthoredLesson } from "@/features/lessons/registry";
import { portfolioComposition, studovnaLesson } from "./studovna-model";
import type { PortfolioView } from "@/features/portfolio/service";

describe("Studovna persisted lesson preview", () => {
  it("previews the exact saved step across the entire published catalog", () => {
    for (const next of availableLessons) {
      const authored = getAuthoredLesson(next.moduleSlug, next.slug)!;
      const steps = getGuidedSteps(authored);
      steps.forEach((step, position) => {
        const preview = studovnaLesson({ next, position });
        expect(preview.step).toEqual(step);
        expect(preview.question).toEqual(step.blocks.find((block) => block.type === "multipleChoiceQuestion"));
      });
    }
  });
  it("does not show a later question in place of an unfinished concept step", () => {
    const next = availableLessons.find((lesson) => lesson.id === "foundations-markets")!;
    expect(studovnaLesson({ next, position: 1 }).question).toBeUndefined();
    expect(studovnaLesson({ next, position: 2 }).question?.id).toBe("buy-side");
  });
});

const holding = (assetType: string, marketValueMinor: string | null) => ({ assetType, marketValueMinor }) as PortfolioView["holdings"][number];
const view = (overrides = {}) => ({ valuationComplete: true, portfolioTotalMinor: "100000", availableCashMinor: "10000", holdings: [holding("equity", "60000"), holding("etf", "30000")], ...overrides });

describe("Studovna portfolio presentation", () => {
  it("uses exact service values and keeps ETFs separate from their unknown underlying mix", () => {
    expect(portfolioComposition(view())?.map(({ label, percent }) => [label, percent])).toEqual([["Akcie", 60], ["ETF", 30], ["Hotovost", 10]]);
  });
  it("preserves precision for large money amounts and rounds display percentages centrally", () => {
    expect(portfolioComposition(view({ portfolioTotalMinor: "10000000000000000000", availableCashMinor: "7500000000000000000", holdings: [holding("equity", "2500000000000000000")] }))?.map(({ percent }) => percent)).toEqual([25, 75]);
    expect(portfolioComposition(view({ portfolioTotalMinor: "3", availableCashMinor: "2", holdings: [holding("equity", "1")] }))?.map(({ percent }) => percent)).toEqual([33.3, 66.7]);
  });
  it("never turns missing valuations into zero or a fabricated allocation", () => {
    expect(portfolioComposition(view({ valuationComplete: false }))).toBeNull();
    expect(portfolioComposition(view({ portfolioTotalMinor: null }))).toBeNull();
    expect(portfolioComposition(view({ holdings: [holding("equity", null)] }))).toBeNull();
    expect(portfolioComposition(view({ portfolioTotalMinor: "0", availableCashMinor: "0", holdings: [] }))).toBeNull();
  });
});
