import katex from "katex";
import { describe, expect, it } from "vitest";
import { authoredLessons, getAuthoredLesson } from "@/features/lessons/registry";
import { availableLessons } from "./catalog";
import { metricExplanation, metricGlossary, metricLabLink, metricLessonLink, type MetricId } from "./metric-glossary";

const entries = Object.values(metricGlossary);

describe("metric glossary", () => {
  it("keys every entry by its own id", () => {
    for (const [key, entry] of Object.entries(metricGlossary)) expect(entry.id).toBe(key);
  });

  it("points every lesson at an authored, available lesson and labels it with that lesson's title", () => {
    for (const entry of entries) {
      if (!entry.lesson) continue;
      const { moduleSlug, lessonSlug } = entry.lesson;
      const authored = getAuthoredLesson(moduleSlug, lessonSlug);
      expect(authored, `${entry.id} → ${moduleSlug}/${lessonSlug}`).toBeDefined();
      expect(availableLessons.some((lesson) => lesson.moduleSlug === moduleSlug && lesson.slug === lessonSlug), `${entry.id} lesson available`).toBe(true);
      expect(metricLessonLink(entry.id)).toEqual({ href: `/learn/${moduleSlug}/${lessonSlug}`, label: `Lekce: ${authored!.title}` });
    }
  });

  it("links at least the returns, volatility and drawdown metrics to lessons", () => {
    const linked: MetricId[] = ["simple-return", "cumulative-return", "volatility", "max-drawdown"];
    for (const id of linked) expect(metricLessonLink(id), id).not.toBeNull();
    expect(metricLessonLink("volatility")?.href).toBe("/learn/volatility/what-is-volatility");
    expect(metricLessonLink("max-drawdown")?.href).toBe("/learn/volatility/max-drawdown");
  });

  it("leaves a metric unlinked rather than pointing at a planned module", () => {
    expect(metricGlossary.correlation.lesson).toBeNull();
    expect(metricLessonLink("correlation")).toBeNull();
  });

  it("renders every formula with KaTeX in strict mode, breakable on narrow screens", () => {
    for (const entry of entries) {
      expect(entry.formula, entry.id).not.toMatch(/\\left|\\right/);
      expect(() => katex.renderToString(entry.formula, { output: "htmlAndMathml", throwOnError: true, trust: false, strict: "error" }), entry.id).not.toThrow();
    }
  });

  it("falls back to the summary when a Lab has no convention of its own", () => {
    expect(metricExplanation("volatility", "backtest")).toContain("měsíčních výnosů");
    expect(metricExplanation("volatility", "instrument")).toContain("√252");
    expect(metricExplanation("sharpe-ratio", "instrument")).toBe(metricGlossary["sharpe-ratio"].summary);
  });

  it("sends a lesson to the metric on its instrument, or to the Lab page that shows the metric", () => {
    expect(metricLabLink("max-drawdown", "/lab/instruments/US-XNAS%3AAAPL")).toEqual({ href: "/lab/instruments/US-XNAS%3AAAPL#metric-max-drawdown", label: "Vyzkoušej v Labu: Největší propad" });
    expect(metricLabLink("max-drawdown").href).toBe("/lab/compare");
    expect(metricLabLink("sharpe-ratio", "/lab/instruments/X").href).toBe("/lab/backtesting");
  });

  it("only sends lessons to Lab routes that exist", () => {
    for (const entry of entries) expect(["/lab/compare", "/lab/backtesting"]).toContain(entry.labHref);
  });

  it("links the lessons that teach a metric back to it in the Lab", () => {
    const bridged = authoredLessons.flatMap((lesson) => lesson.blocks.flatMap((block) => block.type === "labBridge" && block.metric ? [`${lesson.moduleSlug}/${lesson.slug} → ${block.metric}`] : []));
    expect(bridged).toEqual(expect.arrayContaining(["volatility/what-is-volatility → volatility", "volatility/max-drawdown → max-drawdown", "returns/comparing-investments → simple-return"]));
  });
});
