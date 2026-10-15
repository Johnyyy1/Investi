import { learningDate, LESSON_XP, shiftDate } from "@/features/gamification/domain";
import { lessonReward } from "@/features/rewards/practice-capital";
import { lessonSteps } from "@/features/progress/transition";

/** Relative to the session's UTC calendar day, with the same content and history each time. */
export function demoSeed(now: Date) {
  const today = learningDate(now, "UTC");
  const completed = [
    ["foundations-why-invest", -3], ["foundations-stocks", -2],
    ["returns-what-is-a-return", -2], ["foundations-etfs-indexes", -1],
    ["foundations-bonds-cash", -1], ["foundations-markets", 0],
  ] as const;
  const awards = completed.map(([lessonId, offset]) => {
    const date = shiftDate(today, offset);
    // Today's seed is never in the future, including immediately after midnight.
    const awardedAt = offset === 0 ? new Date(now) : new Date(`${date}T12:00:00Z`);
    return {
      lessonId,
      xp: LESSON_XP,
      // The current policy, as for any learner: the seeded Returns lesson carries 2,000 Kč.
      ...lessonReward(lessonId),
      learningDate: date,
      timeZone: "UTC",
      awardedAt,
    };
  });
  const progress = awards.map((award) => ({ lessonId: award.lessonId, status: "completed" as const, lastPosition: lessonSteps(award.lessonId).length - 1, completedAt: award.awardedAt, updatedAt: award.awardedAt }));
  // Resume at the final question: interaction → feedback → takeaway → reward in minutes.
  const active = { lessonId: "foundations-risk-reward", status: "in_progress" as const, lastPosition: lessonSteps("foundations-risk-reward").length - 2, completedAt: null, updatedAt: now };
  return { awards, progress: [...progress, active] };
}
