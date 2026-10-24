import { notFound } from "next/navigation";
import { platformTypesLesson } from "@/features/lessons/broker-and-account/platform-types";
import { factRegistry } from "@/features/facts/registry";
import { factToday } from "@/features/facts/resolve";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import { getGuidedSteps } from "@/features/lessons/steps";
import { LessonDraftPreview } from "@/components/lesson/lesson-draft-preview";

export const metadata = { title: "Typy platforem · redakční náhled", robots: { index: false, follow: false } };
export default function PlatformTypesPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { lesson, notice } = prepareLessonFacts(platformTypesLesson, factRegistry, { today: factToday(), published: false });
  return <LessonDraftPreview title={lesson.title} steps={getGuidedSteps(lesson)} notice={notice} />;
}
