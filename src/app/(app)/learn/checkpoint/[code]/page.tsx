import { notFound, redirect } from "next/navigation";
import { MixedCheckpoint } from "@/components/lesson/mixed-checkpoint";
import { availableLessons } from "@/features/learning/catalog";
import { displayModules } from "@/features/learning/curriculum";
import { isQuestion, type QuestionBlock } from "@/features/lessons/question-evaluation";
import { isCheckpointModule, mixedCheckpoint } from "@/features/mastery/domain";
import { lessonSteps } from "@/features/progress/transition";
import { getCurrentUser } from "@/lib/session";

type CheckpointPageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: CheckpointPageProps) {
  const { code } = await params;
  return { title: isCheckpointModule(code) ? `Smíšený checkpoint · ${displayModules.find((entry) => entry.code === code)!.title}` : "Checkpoint není dostupný" };
}

export default async function CheckpointPage({ params }: CheckpointPageProps) {
  const { code } = await params;
  if (!isCheckpointModule(code)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // A new draw each UTC day and the same one on reload; the server accepts any item of this module's bank.
  const items = mixedCheckpoint(code, `${user.id}:${new Date().toISOString().slice(0, 10)}`).map((item) => ({
    itemId: item.id,
    lessonTitle: availableLessons.find((lesson) => lesson.id === item.lessonId)!.title,
    block: lessonSteps(item.lessonId).flatMap((step) => step.blocks).find((block): block is QuestionBlock => block.id === item.blockId && isQuestion(block))!,
  }));
  return <MixedCheckpoint code={code} title={displayModules.find((entry) => entry.code === code)!.title} items={items} />;
}
