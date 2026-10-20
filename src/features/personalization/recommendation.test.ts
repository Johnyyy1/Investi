import { describe, expect, it } from "vitest";
import { availableLessons, curriculumLessons } from "@/features/learning/catalog";
import { evaluateDiagnostic } from "./diagnostic";
import { defaultPreferences, readLearnerProfile, type LearnerProfile } from "./profile";
import { recommendLearning } from "./recommendation";
import { diagnosticWithCorrectCount } from "./test-fixtures";

const foundationsDone = availableLessons.filter((lesson) => lesson.moduleSlug === "investing-foundations").map((lesson) => ({ lessonId: lesson.id, status: "completed" }));
const profile: LearnerProfile = { ...defaultPreferences, diagnostic: null, personalized: false };
describe("deterministic recommendations", () => {
  it("starts new, legacy, and skipped learners with neutral Foundations", () => {
    for (const value of [undefined, profile, readLearnerProfile({ experienceLevel: "ADVANCED", goals: [], interests: [], dailyGoalMinutes: null })]) {
      expect(recommendLearning({ profile: value })).toMatchObject({ nextLessonId: "foundations-why-invest", scaffoldLevel: "standard", reasonCode: "FOUNDATIONS_START" });
    }
  });
  it.each([0, 1, 2, 3, 4, 5])("gives diagnostic evidence priority at %i/5 without bypassing Foundations", (count) => {
    for (const selfAssessedExperience of ["BEGINNER", "BASIC", "INVESTOR"] as const) {
      const input = { ...profile, selfAssessedExperience, diagnostic: evaluateDiagnostic(diagnosticWithCorrectCount(count)) };
      expect(recommendLearning({ profile: input })).toMatchObject({ nextLessonId: "foundations-why-invest", scaffoldLevel: count < 2 ? "guided" : count < 4 ? "standard" : "compact" });
    }
  });
  it("uses real completions and the normal sequence even with active Returns", () => {
    const progress = [...foundationsDone.slice(0, 2), { lessonId: "returns-simple-returns", status: "in_progress" }];
    expect(recommendLearning({ progress })).toMatchObject({ nextLessonId: "foundations-etfs-indexes", reasonCode: "FOUNDATIONS_CONTINUE" });
  });
  it.each([
    ["LONG_TERM_ETF", "ETFS", "RETURNS_FOR_ETF_PATH", "etf"],
    ["COMPANIES", "STOCKS", "RETURNS_FOR_STOCK_PATH", "stock"],
    ["PORTFOLIO", "PORTFOLIO", "RETURNS_FOR_PORTFOLIO_PATH", "portfolio"],
    ["QUANT", "DATA", "RETURNS_FOR_QUANT_PATH", "data"],
  ] as const)("uses %s after completed Foundations", (primaryGoal, interest, reasonCode, exampleContext) => {
    for (const preferences of [{ ...profile, primaryGoal }, { ...profile, interests: [interest] }]) {
      expect(recommendLearning({ profile: preferences, progress: foundationsDone })).toMatchObject({ nextLessonId: "returns-what-is-a-return", reasonCode, exampleContext });
    }
  });
  it("moves on to Volatility once Returns is finished, in curriculum order", () => {
    const returnsDone = availableLessons.filter((lesson) => lesson.moduleSlug === "returns").map((lesson) => ({ lessonId: lesson.id, status: "completed" }));
    expect(recommendLearning({ progress: [...foundationsDone, ...returnsDone] })).toMatchObject({ nextLessonId: "volatility-what-is-volatility", reasonCode: "VOLATILITY_AFTER_RETURNS" });
    // An unfinished Returns lesson still comes first, even when Volatility was started.
    const progress = [...foundationsDone, ...returnsDone.slice(1), { lessonId: "volatility-standard-deviation", status: "completed" }];
    expect(recommendLearning({ progress })).toMatchObject({ nextLessonId: "returns-what-is-a-return" });
    expect(recommendLearning({ progress: [...foundationsDone, ...returnsDone, { lessonId: "volatility-what-is-volatility", status: "completed" }] }).sessionLessonIds.every((id) => id.startsWith("volatility-"))).toBe(true);
  });
  it("follows the curriculum through Correlation and Diversification", () => {
    const doneUpTo = (...modules: string[]) => availableLessons.filter((lesson) => modules.includes(lesson.moduleSlug)).map((lesson) => ({ lessonId: lesson.id, status: "completed" }));
    expect(recommendLearning({ progress: doneUpTo("investing-foundations", "returns") })).toMatchObject({ nextLessonId: "volatility-what-is-volatility" });
    expect(recommendLearning({ progress: doneUpTo("investing-foundations", "returns").filter((state) => state.lessonId !== "returns-checkpoint") })).toMatchObject({ nextLessonId: "returns-checkpoint" });
    expect(recommendLearning({ progress: doneUpTo("investing-foundations", "returns", "volatility") })).toMatchObject({ nextLessonId: "correlation-what-is-correlation", reasonCode: "CORRELATION_AFTER_VOLATILITY" });
    expect(recommendLearning({ progress: doneUpTo("investing-foundations", "returns", "volatility", "correlation") })).toMatchObject({ nextLessonId: "diversification-concentration", reasonCode: "DIVERSIFICATION_AFTER_CORRELATION" });
    expect(recommendLearning({ progress: doneUpTo("investing-foundations", "returns", "volatility", "correlation", "diversification") })).toMatchObject({ nextLessonId: null, reasonCode: "CURRICULUM_COMPLETE" });
  });
  it("skips completed recommendations and never returns planned content", () => {
    expect(recommendLearning({ progress: [...foundationsDone, { lessonId: "returns-what-is-a-return", status: "completed" }] }).nextLessonId).toBe("returns-simple-returns");
    const complete = curriculumLessons.map((lesson) => ({ lessonId: lesson.id, status: "completed" }));
    expect(recommendLearning({ progress: complete })).toMatchObject({ nextLessonId: null, reasonCode: "CURRICULUM_COMPLETE", sessionLessonIds: [] });
    expect(recommendLearning({ curriculum: curriculumLessons.filter((lesson) => lesson.status === "planned") }).nextLessonId).toBeNull();
  });
  it("honors missing, lesson-level, and module prerequisites", () => {
    expect(recommendLearning({ curriculum: curriculumLessons.filter((lesson) => lesson.moduleSlug === "returns") }).nextLessonId).toBeNull();
    const curriculum = [{ id: "f1", moduleSlug: "investing-foundations", status: "available" as const, estimatedMinutes: 5 }, { id: "f2", moduleSlug: "investing-foundations", status: "available" as const, estimatedMinutes: 5 }];
    expect(recommendLearning({ curriculum, prerequisites: { "investing-foundations": ["unpublished"] } }).nextLessonId).toBeNull();
    expect(recommendLearning({ curriculum, prerequisites: { f1: ["f2"] } }).nextLessonId).toBe("f2");
  });
  it("recomputes context and session density after preference updates", () => {
    const first = recommendLearning({ profile: { ...profile, primaryGoal: "LONG_TERM_ETF", preferredSessionMinutes: 5 }, progress: foundationsDone });
    const second = recommendLearning({ profile: { ...profile, primaryGoal: "QUANT", preferredSessionMinutes: 30 }, progress: foundationsDone });
    expect(first.reasonCode).not.toBe(second.reasonCode);
    expect(first.sessionLessonIds).toHaveLength(1);
    expect(first.splitLessonAcrossSessions).toBe(true);
    expect(second.sessionLessonIds).toHaveLength(2);
    expect(first.nextLessonId).toBe(second.nextLessonId);
  });
  it("is deterministic and never mutates a profile, curriculum, or progress", () => {
    const input = { profile, curriculum: curriculumLessons, progress: foundationsDone };
    const before = structuredClone(input);
    expect(recommendLearning(input)).toEqual(recommendLearning(input));
    expect(input).toEqual(before);
    expect(recommendLearning(input)).not.toHaveProperty("xp");
    expect(recommendLearning(input)).not.toHaveProperty("unlocked");
  });
});
