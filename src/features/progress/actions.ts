"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { completeLesson, getModuleProgress, markLessonInProgress, saveLessonProgress } from "./repository";
import { availableLessons } from "@/features/learning/catalog";
import { getStepDefinitions } from "@/features/lessons/steps";
import { serializePracticeCapitalMinor } from "@/features/rewards/presentation";
import { toLearningMomentum, type CompletionRewardPresentation } from "./contracts";
import { ArtifactRequiredError } from "@/features/artifacts/requirements";

const lessonIdSchema = z.string().refine((id) => availableLessons.some((lesson) => lesson.id === id && lesson.status === "available"));

export async function markLessonStartedAction(lessonId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Relace skončila. Přihlas se znovu a ulož postup." };
    await markLessonInProgress(user.id, lessonIdSchema.parse(lessonId));
    revalidatePath("/learn", "layout");
    revalidatePath("/progress");
    revalidatePath("/lab/portfolio");
    return { ok: true };
  } catch {
    return { ok: false, message: "Postup se nepodařilo uložit. Tvoje práce je na této stránce stále dostupná." };
  }
}

export async function completeLessonAction(lessonId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Relace skončila. Přihlas se znovu a dokonči lekci." };
    const reward = await completeLesson(user.id, lessonIdSchema.parse(lessonId));
    const completedLessons = await getModuleProgress(user.id, availableLessons.find((lesson) => lesson.id === lessonId)!.moduleId);
    revalidatePath("/learn", "layout");
    revalidatePath("/progress");
    revalidatePath("/lab", "layout");
    const presentationReward: CompletionRewardPresentation = {
      xpAwarded: reward.xpAwarded,
      totalXp: reward.totalXp,
      portfolioLabUnlocked: reward.portfolioLabUnlocked,
      portfolioLabOpen: reward.portfolioLabOpen,
      unlockCapitalAwardedMinor: serializePracticeCapitalMinor(reward.unlockCapitalAwardedMinor),
      practiceCapitalAwardedMinor: serializePracticeCapitalMinor(reward.practiceCapitalAwardedMinor),
      earnedPracticeCapitalMinor: serializePracticeCapitalMinor(reward.earnedPracticeCapitalMinor),
      learningMomentum: toLearningMomentum(reward.gamification),
      nextHref: reward.nextHref,
      nextTitle: reward.nextTitle,
      allComplete: reward.allComplete,
    };
    return { ok: true, completedLessons, reward: presentationReward };
  } catch (error) {
    return { ok: false, message: error instanceof ArtifactRequiredError ? error.message : "Dokončení se nepodařilo uložit. Zkus to znovu." };
  }
}

/**
 * Uses the existing progress row; this is a cursor, not a second progress store.
 * It deliberately revalidates nothing: any revalidation in a Server Action re-renders the page being
 * viewed (the lesson itself) into the response, so every step would re-render the whole lesson.
 * Overviews pick up the cursor on their next navigation; the lesson refreshes the router when it is left.
 */
export async function saveLessonPositionAction(lessonId: string, position: number, answers?: Record<string, string>) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Relace skončila. Přihlas se znovu a ulož postup." };
    const id = lessonIdSchema.parse(lessonId);
    const lastPosition = z.number().int().min(0).max(getStepDefinitions(id).length - 1).parse(position);
    const attempt = answers === undefined ? undefined : z.record(z.string().max(100), z.string().max(100)).refine((value) => Object.keys(value).length <= 10).parse(answers);
    await saveLessonProgress(user.id, { lessonId: id, status: "in_progress", lastPosition }, attempt);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof ArtifactRequiredError ? error.message : "Tvé místo se nepodařilo uložit. Zkus to znovu." };
  }
}
