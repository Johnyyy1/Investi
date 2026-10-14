import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudyPlan } from "@/components/personalization/study-plan";
import { defaultPreferences, readLearnerProfile } from "./profile";
import { diagnosticWithCorrectCount } from "./test-fixtures";
import { recommendLearning } from "./recommendation";
import { availableLessons } from "@/features/learning/catalog";

function plan(correct: number, minutes: 5 | 30, states: { lessonId: string; status: string }[] = []) {
  const profile = readLearnerProfile({ goals: ["QUANT"], interests: ["DATA"], experienceLevel: defaultPreferences.selfAssessedExperience, dailyGoalMinutes: minutes, diagnosticResult: diagnosticWithCorrectCount(correct), personalizedOnboardingCompletedAt: new Date() });
  const recommendation = recommendLearning({ profile, progress: states });
  return { recommendation, html: renderToStaticMarkup(createElement(StudyPlan, { profile, recommendation, states })) };
}

describe("saved study plan", () => {
  it("reflects authoritative guidance and session length without bypassing Foundations", () => {
    const guided = plan(0, 5);
    const compact = plan(5, 30);
    expect(guided.recommendation.sessionLessonIds).toHaveLength(1);
    expect(compact.recommendation.sessionLessonIds).toHaveLength(3);
    expect(guided.html).toContain("Klidně od základů");
    // The five-minute first lesson fits a five-minute session; longer lessons still split (see the Returns case).
    expect(guided.recommendation.splitLessonAcrossSessions).toBe(false);
    expect(guided.html).toContain("vlastním tempem");
    expect(compact.html).toContain("Svižné zopakování");
    for (const { html } of [guided, compact]) {
      expect(html).toContain("/learn/investing-foundations/why-invest");
      expect(html).toContain("Přibližně 5 min");
      expect(html).toContain("daty, statistikou a backtestingem");
      expect(html).not.toMatch(/Můžeš přeskočit|correctCount|correctAnswer/);
    }
  });
  it("shows completed lessons and the real next unfinished Returns lesson", () => {
    const states = availableLessons.filter((lesson) => lesson.moduleSlug === "investing-foundations" || lesson.id === "returns-what-is-a-return").map((lesson) => ({ lessonId: lesson.id, status: "completed" }));
    const { recommendation, html } = plan(5, 30, states);
    expect(recommendation.nextLessonId).toBe("returns-simple-returns");
    expect(html).toContain("Hotovo");
    expect(html).toContain("/learn/returns/simple-returns");
    expect(html).toContain("14 min");
    expect(recommendation.splitLessonAcrossSessions).toBe(false);
  });
  it("handles complete and unavailable curricula without an invented lesson", () => {
    const completed = plan(5, 30, availableLessons.map((lesson) => ({ lessonId: lesson.id, status: "completed" })));
    expect(completed.html).toContain("Všechny lekce máš hotové");
    expect(completed.html).not.toContain("Začít doporučenou lekci");
    const html = renderToStaticMarkup(createElement(StudyPlan, { profile: readLearnerProfile(), recommendation: recommendLearning({ curriculum: [] }), states: [] }));
    expect(html).toContain("Doporučení není dostupné");
    expect(html).toContain("/learn#curriculum");
  });
});
