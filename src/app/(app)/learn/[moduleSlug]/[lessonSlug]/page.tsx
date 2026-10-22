import { loadLearner } from "@/features/learning/load-learner";
import { notFound, redirect } from "next/navigation";
import { GuidedLesson } from "@/components/lesson/guided-lesson";
import { getModuleBySlug, getModuleLessons } from "@/features/learning/catalog";
import { getAuthoredLesson } from "@/features/lessons/registry";
import { getLessonProgress, getModuleProgress } from "@/features/progress/repository";
import { getCurrentUser } from "@/lib/session";
import { serializePracticeCapitalMinor } from "@/features/rewards/presentation";
import { toLearningMomentum } from "@/features/progress/contracts";
import { getGuidedSteps } from "@/features/lessons/steps";
import { lessonFactKeys } from "@/features/lessons/step-kinds";
import { isGuestIdentity } from "@/features/guest/identity";
import { loadLessonHistory, loadLessonRiskHistory, lessonUsesHistory, lessonUsesRiskHistory } from "@/features/lessons/real-history/load";
import { getConfiguredMarketDataProviderName, getConfiguredMarketDataService } from "@/features/market-data/environment";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import { factRegistry } from "@/features/facts/registry";
import { factToday } from "@/features/facts/resolve";

type LessonPageProps = { params: Promise<{ moduleSlug: string; lessonSlug: string }> };
export async function generateMetadata({ params }: LessonPageProps) {
  const { moduleSlug, lessonSlug } = await params;
  const authored = getAuthoredLesson(moduleSlug, lessonSlug);
  return { title: authored ? prepareLessonFacts(authored, factRegistry, { today: factToday(), published: true }).lesson.title : "Lekce není dostupná" };
}
export default async function LessonPage({ params }: LessonPageProps) {
  const { moduleSlug, lessonSlug } = await params;
  const authored = getAuthoredLesson(moduleSlug, lessonSlug);
  if (!authored) notFound();
  const { lesson, notice } = prepareLessonFacts(authored, factRegistry, { today: factToday(), published: true });
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const [progress, completedLessons, summary, history, riskHistory] = await Promise.all([
    getLessonProgress(user.id, lesson.id),
    getModuleProgress(user.id, getModuleLessons(moduleSlug)[0].moduleId),
    loadLearner(),
    lessonUsesHistory(lesson) ? loadLessonHistory(getConfiguredMarketDataService(), getConfiguredMarketDataProviderName()) : undefined,
    lessonUsesRiskHistory(lesson) ? loadLessonRiskHistory(getConfiguredMarketDataService(), getConfiguredMarketDataProviderName()) : undefined,
  ]);
  const status = progress?.status ?? "not_started";
  if (!summary.gamification) redirect("/sign-in");
  // Only this lesson's steps cross to the client; the registries of every lesson stay on the server.
  const steps = getGuidedSteps(lesson);
  return <GuidedLesson key={lesson.id} lesson={{ id: lesson.id, moduleSlug: lesson.moduleSlug, title: lesson.title, position: lesson.position, estimatedMinutes: lesson.estimatedMinutes }} moduleTitle={getModuleBySlug(moduleSlug)!.title} steps={steps} factKeys={lessonFactKeys(lesson)} factNotice={notice} initialStatus={status} initialPosition={Math.min(progress?.lastPosition ?? 0, steps.length - 1)} initialCompletedLessons={completedLessons} initialLearningMomentum={toLearningMomentum(summary.gamification)} initialEarnedPracticeCapitalMinor={serializePracticeCapitalMinor(summary.practiceCapital.earnedPracticeCapitalMinor)} nextHref={summary.allComplete ? "/lab" : `/learn/${summary.next.moduleSlug}/${summary.next.slug}`} guest={isGuestIdentity(user)} history={history} riskHistory={riskHistory} />;
}
