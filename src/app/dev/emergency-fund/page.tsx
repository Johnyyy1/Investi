import { notFound } from "next/navigation";
import { emergencyFundLesson } from "@/features/lessons/registry";
import { factRegistry } from "@/features/facts/registry";
import { factToday } from "@/features/facts/resolve";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import { getGuidedSteps } from "@/features/lessons/steps";
import { EmergencyFundPreview } from "@/components/lesson/emergency-fund-preview";

export const metadata = { title: "Rezerva · redakční náhled", robots: { index: false, follow: false } };
export default function EmergencyFundPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { lesson, notice } = prepareLessonFacts(emergencyFundLesson, factRegistry, { today: factToday(), published: false });
  return <EmergencyFundPreview title={lesson.title} steps={getGuidedSteps(lesson)} notice={notice} />;
}
