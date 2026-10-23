import "server-only";
import { listLearnerArtifacts } from "@/features/artifacts/repository";
import { perfMeasure } from "@/lib/perf";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/db";
import { lessonProgress } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadGamification } from "@/features/gamification/repository";
import { loadPracticeCapitalSummary } from "@/features/rewards/repository";
import { getLearningProfile } from "@/features/onboarding/repository";
import { availableLessons } from "./catalog";

import { readLearnerProfile } from "@/features/personalization/profile";
import { recommendLearning } from "@/features/personalization/recommendation";
import { getLearnerSummary } from "./learner-summary";

export async function loadLearner() {
  const user = await getCurrentUser();
  const [rows, profile, gamification, practiceCapital, checkups] = user ? await Promise.all([
    perfMeasure("learner.lessonProgress", "db", () => db.select().from(lessonProgress).where(eq(lessonProgress.userId, user.id))),
    perfMeasure("learner.learningProfile", "db", () => getLearningProfile(user.id)),
    perfMeasure("learner.gamification", "db", () => loadGamification(user.id)),
    perfMeasure("learner.practiceCapital", "db", () => loadPracticeCapitalSummary(user.id)),
    listLearnerArtifacts(user.id, "financial_checkup"),
  ]) : [[], undefined, undefined, { earnedPracticeCapitalMinor: BigInt(0) }, []];
  const states = rows.filter((row) => row !== undefined);
  const checkup = checkups.find((artifact) => artifact.kind === "financial_checkup");
  const recommendation = recommendLearning({ financialCheckup: checkup?.kind === "financial_checkup" ? checkup.payload : undefined, profile: readLearnerProfile(profile), progress: states });
  return { user, profile, recommendation, gamification, practiceCapital, states, ...getLearnerSummary(states, availableLessons.find((lesson) => lesson.id === recommendation.nextLessonId)?.moduleSlug) };
}
