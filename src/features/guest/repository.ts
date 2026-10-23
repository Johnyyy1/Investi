import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { learningProfile, lessonAward, lessonProgress, portfolio, progressionUnlock, skillAttempt, user } from "@/db/schema";
import { isDemoIdentity, isGuestIdentity } from "./identity";

/**
 * Moves a guest's learning into the account they just created or signed in to, then deletes the guest.
 * One transaction: either everything moves and the guest is gone, or nothing changes.
 *
 * Merge rules (the account wins):
 * - lesson receipts: the account keeps its own receipt for a lesson; a guest receipt is copied only for
 *   lessons the account has none for, with its original timestamps and policy version (one lifetime receipt).
 * - lesson progress: a guest row is copied when the account has none, or replaces an unfinished account row
 *   when the guest finished that lesson.
 * - learning profile: copied only when the account has not finished onboarding.
 * - progression unlocks: one-time grants; the account's existing grant wins.
 * - skill attempts: append-only evidence, so every guest attempt is added with its original time.
 * Guests cannot open Portfolio Lab, so there are no portfolios or trades to move.
 */
export async function claimGuestLearning(guestId: string, accountId: string) {
  if (guestId === accountId) return { claimed: false as const };
  return db.transaction(async (tx) => {
    // Same row lock lesson completion and trades take, in a fixed order so two claims cannot deadlock.
    const locked = await tx.select({ id: user.id, isAnonymous: user.isAnonymous, anonymousKind: user.anonymousKind })
      .from(user).where(inArray(user.id, [guestId, accountId])).orderBy(user.id).for("update");
    const guest = locked.find((row) => row.id === guestId);
    const account = locked.find((row) => row.id === accountId);
    // A retry after a successful claim finds no guest: nothing left to move.
    if (!guest) return { claimed: false as const };
    if (!isGuestIdentity(guest)) throw new Error("Only guest identities can be claimed.");
    if (!account || account.isAnonymous) throw new Error("A guest can only be claimed by a saved account.");
    const [guestPortfolio] = await tx.select({ id: portfolio.id }).from(portfolio).where(eq(portfolio.userId, guestId)).limit(1);
    if (guestPortfolio) throw new Error("Guest portfolios cannot be claimed.");

    await tx.execute(sql`
      insert into ${lessonAward} (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at)
      select ${accountId}, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at
      from ${lessonAward} where user_id = ${guestId}
      on conflict (user_id, lesson_id) do nothing`);
    await tx.execute(sql`
      insert into ${lessonProgress} (user_id, lesson_id, status, last_position, completed_at, updated_at)
      select ${accountId}, lesson_id, status, last_position, completed_at, updated_at
      from ${lessonProgress} where user_id = ${guestId}
      on conflict (user_id, lesson_id) do update set status = excluded.status, last_position = excluded.last_position,
        completed_at = excluded.completed_at, updated_at = excluded.updated_at
      where ${lessonProgress.status} <> 'completed' and excluded.status = 'completed'`);
    await tx.execute(sql`
      insert into ${learningProfile} (user_id, experience_level, goals, interests, daily_goal_minutes, time_zone, recommended_start,
        onboarding_step, diagnostic_result, personalized_onboarding_completed_at, onboarding_completed_at, updated_at)
      select ${accountId}, experience_level, goals, interests, daily_goal_minutes, time_zone, recommended_start,
        onboarding_step, diagnostic_result, personalized_onboarding_completed_at, onboarding_completed_at, now()
      from ${learningProfile} where user_id = ${guestId}
      on conflict (user_id) do update set experience_level = excluded.experience_level, goals = excluded.goals, interests = excluded.interests,
        daily_goal_minutes = excluded.daily_goal_minutes, time_zone = coalesce(${learningProfile.timeZone}, excluded.time_zone),
        recommended_start = excluded.recommended_start, onboarding_step = excluded.onboarding_step, diagnostic_result = excluded.diagnostic_result,
        personalized_onboarding_completed_at = excluded.personalized_onboarding_completed_at,
        onboarding_completed_at = excluded.onboarding_completed_at, updated_at = now()
      where ${learningProfile.onboardingCompletedAt} is null`);
    await tx.execute(sql`
      insert into ${progressionUnlock} (user_id, unlock_id, practice_capital_minor, reason, unlocked_at)
      select ${accountId}, unlock_id, practice_capital_minor, reason, unlocked_at
      from ${progressionUnlock} where user_id = ${guestId}
      on conflict (user_id, unlock_id) do nothing`);
    await tx.execute(sql`
      insert into ${skillAttempt} (user_id, request_id, skill_id, item_id, correct, context, attempted_at)
      select ${accountId}, request_id, skill_id, item_id, correct, context, attempted_at
      from ${skillAttempt} where user_id = ${guestId}
      on conflict (user_id, request_id) do nothing`);
    // Cascades the guest's sessions and the rows copied above.
    await tx.delete(user).where(and(eq(user.id, guestId), eq(user.isAnonymous, true)));
    return { claimed: true as const };
  });
}

/** A demo that signs up loses its sample data, exactly as when Better Auth deleted it. */
export async function deleteDemoIdentity(userId: string) {
  await db.transaction(async (tx) => {
    const [owner] = await tx.select({ isAnonymous: user.isAnonymous, anonymousKind: user.anonymousKind }).from(user).where(eq(user.id, userId)).for("update");
    if (owner && isDemoIdentity(owner)) await tx.delete(user).where(eq(user.id, userId));
  });
}
