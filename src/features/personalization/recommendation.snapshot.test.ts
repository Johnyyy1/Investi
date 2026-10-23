import { describe, expect, it } from "vitest";
import { availableLessons } from "@/features/learning/catalog";
import { evaluateDiagnostic } from "./diagnostic";
import { defaultPreferences, type LearnerProfile } from "./profile";
import { recommendLearning } from "./recommendation";
import { diagnosticWithCorrectCount } from "./test-fixtures";

// Freeze the pre-0.1.1 inventory: this snapshot protects legacy sequencing, not catalog size.
const legacyCurriculum = availableLessons.filter((lesson) => lesson.moduleSlug !== "before-investing");

/** Deterministic pseudo-random subsets, so the snapshot covers out-of-order progress too. */
function* seededSubsets(count: number) {
  let seed = 118;
  for (let index = 0; index < count; index += 1) {
    yield legacyCurriculum.filter(() => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31 < 0.6;
    });
  }
}

const profiles: Record<string, LearnerProfile> = {
  default: { ...defaultPreferences, diagnostic: null, personalized: false },
  etf5: { ...defaultPreferences, primaryGoal: "LONG_TERM_ETF", preferredSessionMinutes: 5, diagnostic: null, personalized: true },
  quant30: { ...defaultPreferences, primaryGoal: "QUANT", preferredSessionMinutes: 30, diagnostic: evaluateDiagnostic(diagnosticWithCorrectCount(5)), personalized: true },
};

describe("recommendations for existing learners", () => {
  it("stay unchanged across completed, partial, and out-of-order progress", () => {
    const ids = legacyCurriculum.map((lesson) => lesson.id);
    const completedSets = [
      ...ids.map((_, index) => ids.slice(0, index)),
      ...ids.map((id) => ids.filter((other) => other !== id)),
      ...[...seededSubsets(60)].map((lessons) => lessons.map((lesson) => lesson.id)),
      ids,
    ];
    const lines = completedSets.flatMap((completed) => {
      const mask = ids.map((id) => (completed.includes(id) ? "1" : "0")).join("");
      const progress = completed.map((lessonId) => ({ lessonId, status: "completed" }));
      return Object.entries(profiles).map(([name, profile]) => {
        const result = recommendLearning({ profile, progress, curriculum: legacyCurriculum });
        return `${mask} ${name}: ${result.nextLessonId} ${result.reasonCode} ${result.scaffoldLevel} ${result.exampleContext} [${result.sessionLessonIds.join(",")}]${result.splitLessonAcrossSessions ? " split" : ""}`;
      });
    });
    expect(lines).toMatchSnapshot();
  });
});
