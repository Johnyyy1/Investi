import "server-only";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  analyticsEarlyReturn, analyticsLandingViewDay, learnerArtifact, learningProfile, lessonAward, lessonProgress, portfolio, portfolioTrade, user,
} from "@/db/schema";
import { analyticsDate, isEarlyReturnDay, type LearnerFacts, type LessonProgressFact } from "./funnel";

type Database = Pick<PostgresJsDatabase<Record<string, unknown>>, "execute">;

/** One more landing-page view on today's Prague calendar day. */
export async function recordLandingView(database: Database, now = new Date()) {
  await database.execute(sql`
    insert into ${analyticsLandingViewDay} (day, views) values (${analyticsDate(now)}, 1)
    on conflict (day) do update set views = ${analyticsLandingViewDay.views} + 1`);
}

/**
 * Records the learner's first return on calendar days 1–7 after they started. Outside that window it
 * writes nothing, so the table never grows past one row per learner. Demo identities are not learners.
 */
export async function recordEarlyReturn(database: Database, learner: { id: string; createdAt: Date }, now = new Date()) {
  if (!isEarlyReturnDay(learner.createdAt, now)) return;
  await database.execute(sql`
    insert into ${analyticsEarlyReturn} (user_id, returned_at) values (${learner.id}, ${now.toISOString()}::timestamptz)
    on conflict (user_id) do nothing`);
}

/** Saved accounts and guests; anonymous rows without a kind predate guests and are demos. */
const isLearner = sql`(not ${user.isAnonymous} or ${user.anonymousKind} = 'guest')`;

const toDate = (value: Date | string | null) => value === null ? null : new Date(value);

/**
 * Everything the funnel report needs, read from existing records. User IDs serve only as opaque keys to
 * group rows per learner; no name, e-mail or answer content is selected.
 */
export async function loadFunnelFacts(database: Database) {
  const [learners, progress, visits] = await Promise.all([
    database.execute<{ key: string; guest: boolean; started_at: string; diagnostic_at: string | null; first_lesson_at: string | null; first_artifact_at: string | null; first_lab_trade_at: string | null; returned_at: string | null }>(sql`
      select ${user.id} as key, ${user.isAnonymous} as guest, ${user.createdAt} as started_at,
        case when ${learningProfile.diagnosticResult} is not null then ${learningProfile.personalizedOnboardingCompletedAt} end as diagnostic_at,
        (select min(${lessonAward.awardedAt}) from ${lessonAward} where ${lessonAward.userId} = ${user.id}) as first_lesson_at,
        (select min(${learnerArtifact.createdAt}) from ${learnerArtifact} where ${learnerArtifact.userId} = ${user.id}) as first_artifact_at,
        (select min(${portfolioTrade.executedAt}) from ${portfolioTrade} join ${portfolio} on ${portfolio.id} = ${portfolioTrade.portfolioId}
          where ${portfolio.userId} = ${user.id}) as first_lab_trade_at,
        ${analyticsEarlyReturn.returnedAt} as returned_at
      from ${user}
      left join ${learningProfile} on ${learningProfile.userId} = ${user.id}
      left join ${analyticsEarlyReturn} on ${analyticsEarlyReturn.userId} = ${user.id}
      where ${isLearner}`),
    database.execute<{ key: string; lesson_id: string; completed_at: string | null; updated_at: string }>(sql`
      select ${lessonProgress.userId} as key, ${lessonProgress.lessonId} as lesson_id, ${lessonProgress.completedAt} as completed_at, ${lessonProgress.updatedAt} as updated_at
      from ${lessonProgress} join ${user} on ${user.id} = ${lessonProgress.userId}
      where ${isLearner}`),
    database.execute<{ day: string; views: number }>(sql`select ${analyticsLandingViewDay.day}::text as day, ${analyticsLandingViewDay.views} as views from ${analyticsLandingViewDay}`),
  ]);
  return {
    learners: [...learners].map((row): LearnerFacts => ({
      key: row.key,
      kind: row.guest ? "guest" : "account",
      startedAt: new Date(row.started_at),
      diagnosticAt: toDate(row.diagnostic_at),
      firstLessonAt: toDate(row.first_lesson_at),
      firstArtifactAt: toDate(row.first_artifact_at),
      firstLabTradeAt: toDate(row.first_lab_trade_at),
      returnedAt: toDate(row.returned_at),
    })),
    progress: [...progress].map((row): LessonProgressFact => ({ key: row.key, lessonId: row.lesson_id, completedAt: toDate(row.completed_at), updatedAt: new Date(row.updated_at) })),
    visits: [...visits].map((row) => ({ day: row.day, views: Number(row.views) })),
  };
}
