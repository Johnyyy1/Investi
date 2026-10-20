import { curriculumLessons } from "@/features/learning/catalog";
import { foundationsLessons } from "@/features/lessons/foundations/manifest";
import { readDiagnostic } from "./diagnostic";
import { readLearnerProfile, type LearnerProfile } from "./profile";

export type ScaffoldLevel = "guided" | "standard" | "compact";
export type ReasonCode = "FOUNDATIONS_START" | "FOUNDATIONS_CONTINUE" | "DIAGNOSTIC_REMEDIATION" | "FOUNDATIONS_COMPACT_REVIEW" | "RETURNS_AFTER_FOUNDATIONS" | "RETURNS_FOR_ETF_PATH" | "RETURNS_FOR_STOCK_PATH" | "RETURNS_FOR_PORTFOLIO_PATH" | "RETURNS_FOR_QUANT_PATH" | "VOLATILITY_AFTER_RETURNS" | "CORRELATION_AFTER_VOLATILITY" | "DIVERSIFICATION_AFTER_CORRELATION" | "CURRICULUM_COMPLETE" | "NO_AVAILABLE_LESSON";
export type RecommendationLesson = { id: string; moduleSlug: string; status: "available" | "planned"; estimatedMinutes: number };
export type CurriculumPrerequisites = Readonly<Record<string, readonly string[]>>;
/** Recommendation prerequisites only. Does not confer or change access/entitlement. */
export const recommendationPrerequisites: CurriculumPrerequisites = {
  returns: foundationsLessons.filter((lesson) => lesson.status === "available").map((lesson) => lesson.id),
};
export type LearningRecommendation = {
  nextLessonId: string | null;
  reasonCode: ReasonCode;
  scaffoldLevel: ScaffoldLevel;
  exampleContext: "neutral" | "etf" | "stock" | "portfolio" | "data";
  sessionLessonIds: string[];
  splitLessonAcrossSessions: boolean;
};

/** Pure advice about the next learning step. No writes, reward math, or access decisions.
 * Curriculum order is authoritative; unavailable prerequisites fail closed. */
export function recommendLearning({ profile = readLearnerProfile(), progress = [], curriculum = curriculumLessons, prerequisites = recommendationPrerequisites }: {
  profile?: LearnerProfile;
  progress?: readonly { lessonId: string; status: string }[];
  curriculum?: readonly RecommendationLesson[];
  prerequisites?: CurriculumPrerequisites;
} = {}): LearningRecommendation {
  const diagnostic = readDiagnostic(profile.diagnostic);
  const scaffoldLevel: ScaffoldLevel = diagnostic?.level === "foundations_needed" ? "guided" : diagnostic?.level === "strong_foundations" ? "compact" : "standard";
  const completed = new Set(progress.filter((state) => state.status === "completed").map((state) => state.lessonId));
  const published = curriculum.filter((lesson) => lesson.status === "available");
  const unfinishedFoundations = published.filter((lesson) => lesson.moduleSlug === "investing-foundations" && !completed.has(lesson.id));
  const eligible = published.filter((lesson) => !completed.has(lesson.id) && (prerequisites[lesson.id] ?? []).every((id) => completed.has(id)) && (prerequisites[lesson.moduleSlug] ?? []).every((id) => completed.has(id)));
  // After Foundations, modules follow curriculum order: Returns, Volatility, Correlation, Diversification.
  const nextModule = unfinishedFoundations.length ? "investing-foundations" : eligible.find((lesson) => lesson.moduleSlug !== "investing-foundations")?.moduleSlug;
  const candidates = eligible.filter((lesson) => lesson.moduleSlug === nextModule);
  const next = candidates[0];
  const contexts = { LONG_TERM_ETF: "etf", COMPANIES: "stock", PORTFOLIO: "portfolio", QUANT: "data", CONFIDENCE: "neutral" } as const;
  const exampleContext = (profile.primaryGoal && profile.primaryGoal !== "CONFIDENCE" ? contexts[profile.primaryGoal] : null)
    ?? (profile.interests.some((interest) => ["DATA", "QUANT", "BACKTESTING"].includes(interest)) ? "data" : profile.interests.includes("ETFS") ? "etf" : profile.interests.some((interest) => ["STOCKS", "FUNDAMENTALS"].includes(interest)) ? "stock" : profile.interests.includes("PORTFOLIO") ? "portfolio" : "neutral");
  let reasonCode: ReasonCode;
  if (!next) reasonCode = published.length > 0 && published.every((lesson) => completed.has(lesson.id)) ? "CURRICULUM_COMPLETE" : "NO_AVAILABLE_LESSON";
  else if (next.moduleSlug === "investing-foundations") reasonCode = diagnostic?.level === "foundations_needed" ? "DIAGNOSTIC_REMEDIATION" : diagnostic?.level === "strong_foundations" ? "FOUNDATIONS_COMPACT_REVIEW" : published.some((lesson) => lesson.moduleSlug === "investing-foundations" && completed.has(lesson.id)) ? "FOUNDATIONS_CONTINUE" : "FOUNDATIONS_START";
  else if (next.moduleSlug === "volatility") reasonCode = "VOLATILITY_AFTER_RETURNS";
  else if (next.moduleSlug === "correlation") reasonCode = "CORRELATION_AFTER_VOLATILITY";
  else if (next.moduleSlug === "diversification") reasonCode = "DIVERSIFICATION_AFTER_CORRELATION";
  else reasonCode = ({ etf: "RETURNS_FOR_ETF_PATH", stock: "RETURNS_FOR_STOCK_PATH", portfolio: "RETURNS_FOR_PORTFOLIO_PATH", data: "RETURNS_FOR_QUANT_PATH", neutral: "RETURNS_AFTER_FOUNDATIONS" } as const)[exampleContext];
  // Planning is approximate, with at most three lessons. A long lesson may span sessions.
  const sessionLessonIds: string[] = [];
  let minutes = 0;
  for (const lesson of candidates.slice(0, 3)) {
    if (sessionLessonIds.length && minutes + lesson.estimatedMinutes > profile.preferredSessionMinutes) break;
    sessionLessonIds.push(lesson.id); minutes += lesson.estimatedMinutes;
  }
  return { nextLessonId: next?.id ?? null, reasonCode, scaffoldLevel, exampleContext, sessionLessonIds, splitLessonAcrossSessions: Boolean(next && next.estimatedMinutes > profile.preferredSessionMinutes) };
}
