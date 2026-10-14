import { describe, expect, it } from "vitest";
import { backtestPreview, labLessonRows, nextFoundationsLesson, sparklinePaths } from "./lab-hub-model";

describe("lab hub model", () => {
  it("links each Lab move to its published lesson with progress from the learner", () => {
    const rows = labLessonRows(new Set(["foundations-etfs-indexes"]));
    expect(rows.map(({ action, title, number, done }) => [action, title, number, done])).toEqual([
      ["Váhy portfolia", "Portfolio, váhy a diverzifikace", 7, false],
      ["Výběr fondu do mixu", "ETF a indexy", 3, true],
      ["Mix proti akciím v čase", "Výnos a složené zhodnocení", 6, false],
    ]);
    expect(rows[0].href).toBe("/learn/investing-foundations/your-first-portfolio");
  });

  it("points a locked learner at the first unfinished Foundations lesson", () => {
    expect(nextFoundationsLesson(new Set())?.href).toBe("/learn/investing-foundations/why-invest");
    expect(nextFoundationsLesson(new Set(["foundations-why-invest", "foundations-stocks"]))?.title).toBe("ETF a indexy");
  });

  it("draws both series on one scale so the higher result is the higher line", () => {
    const paths = sparklinePaths([{ label: "a", value: 100, benchmark: 100 }, { label: "b", value: 120, benchmark: 110 }], 100, 50, 0);
    expect(paths.strategy).toBe("M0.0 50.0 L100.0 0.0");
    expect(paths.benchmark).toBe("M0.0 50.0 L100.0 25.0");
    expect(paths.baseline).toBe("50.0");
  });

  it("previews the Backtesting Lab's own synthetic run without revealing final values", () => {
    const preview = backtestPreview();
    expect(preview.period).toBe("1/2020–12/2021");
    expect(preview.paths.strategy.split("L")).toHaveLength(25);
    expect(Object.keys(preview)).toEqual(["amount", "period", "paths"]);
  });
});
