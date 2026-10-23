import { checkupNextStep, checkupAdvice, type FinancialCheckup } from "@/features/lessons/before-investing/checkup-model";
import { curriculumLessons } from "@/features/learning/catalog";
import { lessonPlacements } from "@/features/learning/curriculum";
import { readDiagnostic } from "./diagnostic";
import { readLearnerProfile, type LearnerProfile } from "./profile";

export type ScaffoldLevel = "guided" | "standard" | "compact";
export type ReasonCode = "CHECKUP_READINESS" | "BUDGET_READINESS" | "FOUNDATIONS_START" | "FOUNDATIONS_CONTINUE" | "DIAGNOSTIC_REMEDIATION" | "FOUNDATIONS_COMPACT_REVIEW" | "RETURNS_AFTER_FOUNDATIONS" | "RETURNS_FOR_ETF_PATH" | "RETURNS_FOR_STOCK_PATH" | "RETURNS_FOR_PORTFOLIO_PATH" | "RETURNS_FOR_QUANT_PATH" | "VOLATILITY_AFTER_RETURNS" | "CORRELATION_AFTER_VOLATILITY" | "DIVERSIFICATION_AFTER_CORRELATION" | "CURRICULUM_COMPLETE" | "NO_AVAILABLE_LESSON";
export type RecommendationLesson = { id: string; moduleSlug: string; status: "available" | "planned"; estimatedMinutes: number };
export type CurriculumPrerequisites = Readonly<Record<string, readonly string[]>>;
/** Recommendation prerequisites only, by lesson ID from the curriculum registry. Does not confer or change access/entitlement. */
export const recommendationPrerequisites: CurriculumPrerequisites = Object.fromEntries(lessonPlacements.map((placement) => [placement.lessonId, placement.prerequisites]));
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
export function recommendLearning({ profile = readLearnerProfile(), progress = [], curriculum = curriculumLessons, prerequisites = recommendationPrerequisites, financialCheckup }: {
  financialCheckup?: FinancialCheckup;
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
  const ready = (lesson: RecommendationLesson, done: ReadonlySet<string>) => [lesson.id, lesson.moduleSlug].every((key) => (prerequisites[key] ?? []).every((id) => done.has(id)));
  const eligible = published.filter((lesson) => !completed.has(lesson.id) && ready(lesson, completed));
  // After Foundations, modules follow the registry's storage order.
  const nextModule = unfinishedFoundations.length ? "investing-foundations" : eligible.find((lesson) => lesson.moduleSlug !== "investing-foundations")?.moduleSlug;
  let next = eligible.find((lesson) => lesson.moduleSlug === nextModule);
  const readinessStep = financialCheckup && checkupNextStep(financialCheckup);
  const readinessLesson = readinessStep && readinessStep !== "continue_learning" ? (published.find((lesson) => lesson.id === checkupAdvice[readinessStep].lessonId) ?? published.find((lesson) => lesson.id === "before-investing-checkup")) : undefined;
  if (readinessLesson) next = readinessLesson;
  const contexts = { LONG_TERM_ETF: "etf", COMPANIES: "stock", PORTFOLIO: "portfolio", QUANT: "data", CONFIDENCE: "neutral" } as const;
  const exampleContext = (profile.primaryGoal && profile.primaryGoal !== "CONFIDENCE" ? contexts[profile.primaryGoal] : null)
    ?? (profile.interests.some((interest) => ["DATA", "QUANT", "BACKTESTING"].includes(interest)) ? "data" : profile.interests.includes("ETFS") ? "etf" : profile.interests.some((interest) => ["STOCKS", "FUNDAMENTALS"].includes(interest)) ? "stock" : profile.interests.includes("PORTFOLIO") ? "portfolio" : "neutral");
  let reasonCode: ReasonCode;
  if (readinessLesson) reasonCode = "CHECKUP_READINESS";
  else if (!next) reasonCode = published.length > 0 && published.every((lesson) => completed.has(lesson.id)) ? "CURRICULUM_COMPLETE" : "NO_AVAILABLE_LESSON";
  else if (next.moduleSlug === "investing-foundations") reasonCode = diagnostic?.level === "foundations_needed" ? "DIAGNOSTIC_REMEDIATION" : diagnostic?.level === "strong_foundations" ? "FOUNDATIONS_COMPACT_REVIEW" : published.some((lesson) => lesson.moduleSlug === "investing-foundations" && completed.has(lesson.id)) ? "FOUNDATIONS_CONTINUE" : "FOUNDATIONS_START";
  else if (next.moduleSlug === "before-investing") reasonCode = "BUDGET_READINESS";
  else if (next.moduleSlug === "volatility") reasonCode = "VOLATILITY_AFTER_RETURNS";
  else if (next.moduleSlug === "correlation") reasonCode = "CORRELATION_AFTER_VOLATILITY";
  else if (next.moduleSlug === "diversification") reasonCode = "DIVERSIFICATION_AFTER_CORRELATION";
  else reasonCode = ({ etf: "RETURNS_FOR_ETF_PATH", stock: "RETURNS_FOR_STOCK_PATH", portfolio: "RETURNS_FOR_PORTFOLIO_PATH", data: "RETURNS_FOR_QUANT_PATH", neutral: "RETURNS_AFTER_FOUNDATIONS" } as const)[exampleContext];
  // Planning is approximate, with at most three lessons. A long lesson may span sessions.
  // A lesson planned earlier in the session counts as done for the prerequisites of the next one.
  const sessionLessonIds: string[] = [];
  const planned = new Set(completed);
  let minutes = 0;
  for (const lesson of published.filter((candidate) => candidate.moduleSlug === nextModule && !completed.has(candidate.id))) {
    if (sessionLessonIds.length === 3) break;
    if (!ready(lesson, planned)) continue;
    if (sessionLessonIds.length && minutes + lesson.estimatedMinutes > profile.preferredSessionMinutes) break;
    sessionLessonIds.push(lesson.id); planned.add(lesson.id); minutes += lesson.estimatedMinutes;
  }
  if (readinessLesson) sessionLessonIds.splice(0, sessionLessonIds.length, readinessLesson.id);
  return { nextLessonId: next?.id ?? null, reasonCode, scaffoldLevel, exampleContext, sessionLessonIds, splitLessonAcrossSessions: Boolean(next && next.estimatedMinutes > profile.preferredSessionMinutes) };
}
