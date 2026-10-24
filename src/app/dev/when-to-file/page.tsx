import { notFound } from "next/navigation";
import { whenToFileLesson } from "@/features/lessons/czech-taxes/when-to-file";
import { factRegistry } from "@/features/facts/registry";
import { factToday } from "@/features/facts/resolve";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import { getGuidedSteps } from "@/features/lessons/steps";
import { LessonDraftPreview } from "@/components/lesson/lesson-draft-preview";

export const metadata = { title: "Kdy podat přiznání · redakční náhled", robots: { index: false, follow: false } };
export default function WhenToFilePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { lesson, notice } = prepareLessonFacts(whenToFileLesson, factRegistry, { today: factToday(), published: false });
  return <LessonDraftPreview title={lesson.title} steps={getGuidedSteps(lesson)} notice={notice} />;
}
