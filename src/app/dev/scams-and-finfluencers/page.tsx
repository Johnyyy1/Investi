import { notFound } from "next/navigation";
import { scamsAndFinfluencersLesson } from "@/features/lessons/before-investing/scams-and-finfluencers";
import { factRegistry } from "@/features/facts/registry";
import { factToday } from "@/features/facts/resolve";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import { getGuidedSteps } from "@/features/lessons/steps";
import { EditorialLessonPreview } from "@/components/lesson/editorial-lesson-preview";

export const metadata = { title: "Podvody · redakční náhled", robots: { index: false, follow: false } };
export default function ScamsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { lesson, notice } = prepareLessonFacts(scamsAndFinfluencersLesson, factRegistry, { today: factToday(), published: false });
  return <EditorialLessonPreview title={lesson.title} steps={getGuidedSteps(lesson)} notice={notice} />;
}
