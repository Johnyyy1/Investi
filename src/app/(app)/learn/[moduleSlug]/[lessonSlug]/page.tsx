import { loadLearner } from "@/features/learning/load-learner";
import { notFound, redirect } from "next/navigation";
import { GuidedLesson } from "@/components/lesson/guided-lesson";
import { getModuleLessons } from "@/features/learning/catalog";
import { getAuthoredLesson } from "@/features/lessons/registry";
import { getLessonProgress, getModuleProgress } from "@/features/progress/repository";
import { getCurrentUser } from "@/lib/session";
import { serializePracticeCapitalMinor } from "@/features/rewards/presentation";
import { toLearningMomentum } from "@/features/progress/contracts";
import { getGuidedSteps } from "@/features/lessons/returns/guided-flow";
import { isGuestIdentity } from "@/features/guest/identity";

type LessonPageProps = { params: Promise<{ moduleSlug: string; lessonSlug: string }> };
export async function generateMetadata({ params }: LessonPageProps) {
  const { moduleSlug, lessonSlug } = await params;
  return { title: getAuthoredLesson(moduleSlug, lessonSlug)?.title ?? "Lekce není dostupná" };
}
export default async function LessonPage({ params }: LessonPageProps) {
  const { moduleSlug, lessonSlug } = await params;
  const lesson = getAuthoredLesson(moduleSlug, lessonSlug);
  if (!lesson) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const [progress, completedLessons, summary] = await Promise.all([
    getLessonProgress(user.id, lesson.id),
    getModuleProgress(user.id, getModuleLessons(moduleSlug)[0].moduleId),
    loadLearner(),
  ]);
  const status = progress?.status ?? "not_started";
  if (!summary.gamification) redirect("/sign-in");
  return <GuidedLesson key={lesson.id} lesson={lesson} initialStatus={status} initialPosition={Math.min(progress?.lastPosition ?? 0, getGuidedSteps(lesson).length - 1)} initialCompletedLessons={completedLessons} initialLearningMomentum={toLearningMomentum(summary.gamification)} initialEarnedPracticeCapitalMinor={serializePracticeCapitalMinor(summary.practiceCapital.earnedPracticeCapitalMinor)} nextHref={summary.allComplete ? "/lab" : `/learn/${summary.next.moduleSlug}/${summary.next.slug}`} guest={isGuestIdentity(user)} />;
}
