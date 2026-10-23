"use server";

import { z } from "zod";
import { lessonAnswersSchema } from "@/features/lessons/answer-contract";
import { evaluateQuestion, isQuestion } from "@/features/lessons/question-evaluation";
import { lessonSteps } from "@/features/progress/transition";
import { getCurrentUser } from "@/lib/session";
import { logUnexpectedError } from "@/lib/server-errors";
import { getSkillItem } from "./domain";
import { recordSkillAttempt } from "./repository";

const attemptSchema = z.strictObject({
  requestId: z.uuid(),
  itemId: z.string().max(200).refine((id) => getSkillItem(id) !== undefined),
  answers: lessonAnswersSchema,
  mode: z.enum(["lesson", "checkpoint"]),
});

/**
 * Records one checked answer as mastery evidence. The server re-evaluates the authored question, so the client
 * never sends "correct". Revalidates nothing: the lesson being answered must not re-render.
 */
export async function recordSkillAttemptAction(input: z.input<typeof attemptSchema>) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, message: "Relace skončila. Přihlas se znovu." };
    const { requestId, itemId, answers, mode } = attemptSchema.parse(input);
    const item = getSkillItem(itemId)!;
    const block = lessonSteps(item.lessonId).flatMap((step) => step.blocks).find((entry) => entry.id === item.blockId);
    const correct = block && isQuestion(block) ? evaluateQuestion(block, answers) : undefined;
    if (correct === undefined) return { ok: false as const, message: "Nejdřív odpověz na otázku." };
    const stored = await recordSkillAttempt(user.id, { requestId, item, correct, mode });
    return { ok: true as const, correct: stored.correct };
  } catch (error) {
    if (!(error instanceof z.ZodError)) logUnexpectedError("mastery", "record skill attempt", error);
    return { ok: false as const, message: "Odpověď se nepodařilo uložit. Zkus to znovu." };
  }
}
