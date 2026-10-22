import { learningDate, shiftDate } from "../gamification/domain";
import { displayModules, lessonPlacements, storageModules } from "../learning/curriculum";

/**
 * Minimal product funnel towards milestone A (#355). Pure: the repository loads one row per learner from
 * existing records, these functions turn them into counts. Output is aggregate counts only; the opaque
 * learner key never leaves this module.
 *
 * Calendar days are Europe/Prague days: the product and its learners are Czech, and one shared clock keeps
 * weekly cohorts comparable whatever time zone a learner chose.
 */
export const ANALYTICS_TIME_ZONE = "Europe/Prague";
/** "Návrat do 7 dní": a visit on a later calendar day, at most this many days after the start day. */
export const EARLY_RETURN_DAYS = 7;
/** A learner with no lesson completion for this long counts as having stopped. */
export const INACTIVE_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const analyticsDate = (at: Date) => learningDate(at, ANALYTICS_TIME_ZONE);

/** True on calendar days 1–7 after the learner's start day, the only days an early return is recorded. */
export function isEarlyReturnDay(startedAt: Date, now: Date) {
  const start = analyticsDate(startedAt);
  const today = analyticsDate(now);
  return today > start && today <= shiftDate(start, EARLY_RETURN_DAYS);
}

/**
 * One learner: a saved account or a guest. Demo identities are excluded by the repository. Timestamps are
 * the first time each step happened; null means not (yet) reached.
 */
export type LearnerFacts = {
  key: string;
  kind: "account" | "guest";
  startedAt: Date;
  diagnosticAt: Date | null;
  firstLessonAt: Date | null;
  firstArtifactAt: Date | null;
  firstLabTradeAt: Date | null;
  returnedAt: Date | null;
};

export type FunnelStepId = "visit" | "start" | "diagnostic" | "first-lesson" | "first-artifact" | "milestone-a" | "first-lab-mission" | "return-7d";

/** Steps without an authoritative record yet are reported as unavailable, never as zero. */
export const funnelSteps: readonly { id: FunnelStepId; label: string; unavailable?: string }[] = [
  { id: "visit", label: "Návštěva úvodní stránky" },
  { id: "start", label: "Nový účet nebo host" },
  { id: "diagnostic", label: "Diagnostika" },
  { id: "first-lesson", label: "První dokončená lekce" },
  { id: "first-artifact", label: "První výstup lekce" },
  { id: "milestone-a", label: "Milník A", unavailable: "Splnění milníku se zatím nezaznamenává (#126)." },
  { id: "first-lab-mission", label: "První mise v Labu", unavailable: "Vedené mise v Labu zatím neexistují (#142)." },
  { id: "return-7d", label: "Návrat do 7 dní" },
];

export type FunnelStep = {
  id: FunnelStepId;
  label: string;
  /** null when the step has no data source yet. */
  count: number | null;
  /** Share of learners at the previous available step who also reached this one; null without a base. */
  fromPrevious: number | null;
  /** count ÷ learners who started in the window (for the return step: ÷ learners whose window has closed or who returned). */
  fromStart: number | null;
  note?: string;
};

export type Funnel = {
  days: number;
  from: string;
  to: string;
  learners: { total: number; accounts: number; guests: number };
  steps: FunnelStep[];
  /** Interim context until Lab missions exist; not a funnel step. */
  firstLabTrade: number;
};

const ratio = (count: number | null, base: number | null) => count === null || !base ? null : count / base;

/** Learners still inside their return window cannot have failed to return yet. */
function returnWindowOpen(learner: LearnerFacts, now: Date) {
  return analyticsDate(now) <= shiftDate(analyticsDate(learner.startedAt), EARLY_RETURN_DAYS);
}

/** Learners who started on one of the last `days` calendar days, today included. */
export function startedWithin(learners: readonly LearnerFacts[], days: number, now: Date) {
  const to = analyticsDate(now);
  const from = shiftDate(to, -(days - 1));
  return { from, to, cohort: learners.filter((learner) => { const day = analyticsDate(learner.startedAt); return day >= from && day <= to; }) };
}

/** Sums the daily landing-page views between two calendar days, both included. */
function visitsBetween(visits: readonly { day: string; views: number }[], from: string, to: string) {
  return visits.reduce((sum, row) => row.day >= from && row.day <= to ? sum + row.views : sum, 0);
}

/** Which learners have reached each learner step; the visit step counts page views, not learners. */
const reachedStep: Partial<Record<FunnelStepId, (learner: LearnerFacts) => boolean>> = {
  start: () => true,
  diagnostic: (learner) => learner.diagnosticAt !== null,
  "first-lesson": (learner) => learner.firstLessonAt !== null,
  "first-artifact": (learner) => learner.firstArtifactAt !== null,
  "return-7d": (learner) => learner.returnedAt !== null,
};

/**
 * Cohort funnel: learners who started in the window, and which steps each has reached by now. A step is
 * not required for the next one (the diagnostic can be skipped), so each step counts everyone who reached
 * it, and the conversion from the previous step is the share of learners at the previous step who also
 * reached this one. Landing views are page loads, not people: the start step's conversion from them
 * compares different units and is labelled as such.
 */
export function buildFunnel(learners: readonly LearnerFacts[], visits: readonly { day: string; views: number }[], days: number, now: Date): Funnel {
  const { from, to, cohort } = startedWithin(learners, days, now);
  const views = visitsBetween(visits, from, to);
  const open = cohort.filter((learner) => learner.returnedAt === null && returnWindowOpen(learner, now)).length;
  let previous: ((learner: LearnerFacts) => boolean) | "visit" | null = null;
  const steps = funnelSteps.map(({ id, label, unavailable }): FunnelStep => {
    if (unavailable) return { id, label, count: null, fromPrevious: null, fromStart: null, note: unavailable };
    if (id === "visit") {
      previous = "visit";
      return { id, label, count: views, fromPrevious: null, fromStart: null };
    }
    const reached = reachedStep[id]!;
    const count = cohort.filter(reached).length;
    const base: (learner: LearnerFacts) => boolean = previous === "visit" || previous === null ? () => true : previous;
    const fromPrevious = previous === "visit" ? ratio(count, views) : ratio(cohort.filter((learner) => base(learner) && reached(learner)).length, cohort.filter(base).length);
    previous = reached;
    if (id === "start") return { id, label, count, fromPrevious, fromStart: null, note: "Konverze z návštěv porovnává lidi se zobrazeními stránky." };
    if (id === "return-7d") {
      // Learners still inside their window may yet return, so the share counts only decided learners.
      return { id, label, count, fromPrevious: null, fromStart: ratio(count, cohort.length - open),
        note: `Ještě v sedmidenním okně: ${open}. Podíl počítá jen s uzavřenými okny.` };
    }
    return { id, label, count, fromPrevious, fromStart: ratio(count, cohort.length) };
  });
  return {
    days, from, to,
    learners: { total: cohort.length, accounts: cohort.filter((learner) => learner.kind === "account").length, guests: cohort.filter((learner) => learner.kind === "guest").length },
    steps,
    firstLabTrade: cohort.filter((learner) => learner.firstLabTradeAt !== null).length,
  };
}

/** Monday of the Prague calendar week that contains `day` (YYYY-MM-DD). */
export function weekStart(day: string) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftDate(day, -((weekday + 6) % 7));
}

export type WeeklyCohort = {
  week: string;
  learners: number;
  diagnostic: number;
  firstLesson: number;
  firstArtifact: number;
  returned: number;
  /** Learners whose seven-day window is still open; they may still return. */
  returnPending: number;
};

/** The last `weeks` registration weeks, newest first, including weeks nobody started in. */
export function buildWeeklyCohorts(learners: readonly LearnerFacts[], weeks: number, now: Date): WeeklyCohort[] {
  const current = weekStart(analyticsDate(now));
  return Array.from({ length: weeks }, (_, index) => {
    const week = shiftDate(current, -7 * index);
    const cohort = learners.filter((learner) => weekStart(analyticsDate(learner.startedAt)) === week);
    return {
      week,
      learners: cohort.length,
      diagnostic: cohort.filter((learner) => learner.diagnosticAt).length,
      firstLesson: cohort.filter((learner) => learner.firstLessonAt).length,
      firstArtifact: cohort.filter((learner) => learner.firstArtifactAt).length,
      returned: cohort.filter((learner) => learner.returnedAt).length,
      returnPending: cohort.filter((learner) => !learner.returnedAt && returnWindowOpen(learner, now)).length,
    };
  });
}

export type LessonProgressFact = { key: string; lessonId: string; completedAt: Date | null; updatedAt: Date };

export type LessonDropOff = {
  lessonId: string;
  displayCode: string | null;
  title: string;
  started: number;
  completed: number;
  /** Started, not completed, untouched for INACTIVE_AFTER_DAYS. */
  abandoned: number;
  /** Learners whose latest completion is this lesson and who have completed nothing since for INACTIVE_AFTER_DAYS. */
  stoppedAfter: number;
};

const lessonTitles = new Map<string, string>(storageModules.flatMap((module) => module.lessons.map((lesson) => [lesson.id, lesson.title] as const)));
const moduleOrder = new Map<string, number>(displayModules.map((module) => [module.code, module.order]));

/** Published lessons in Curriculum 2.0 display order. */
export function curriculumLessonOrder() {
  return [...lessonPlacements]
    .sort((a, b) => moduleOrder.get(a.displayModule)! - moduleOrder.get(b.displayModule)! || a.order - b.order)
    .map((placement) => ({ lessonId: placement.lessonId, displayCode: placement.displayCode, title: lessonTitles.get(placement.lessonId) ?? placement.lessonId }));
}

/**
 * Where learners stop, lesson by lesson. A row in lesson progress means the lesson was opened; a
 * completion time is the lifetime first completion. Lessons with data but no curriculum placement are
 * listed after the curriculum so nothing is silently dropped.
 */
export function buildLessonDropOff(progress: readonly LessonProgressFact[], now: Date): LessonDropOff[] {
  const inactiveBefore = now.getTime() - INACTIVE_AFTER_DAYS * DAY_MS;
  const latestCompletion = new Map<string, LessonProgressFact>();
  for (const row of progress) {
    if (!row.completedAt) continue;
    const latest = latestCompletion.get(row.key);
    if (!latest || row.completedAt > latest.completedAt!) latestCompletion.set(row.key, row);
  }
  const order = curriculumLessonOrder();
  const known = new Set(order.map((lesson) => lesson.lessonId));
  const extra = [...new Set(progress.map((row) => row.lessonId))].filter((id) => !known.has(id)).sort()
    .map((lessonId) => ({ lessonId, displayCode: null, title: lessonTitles.get(lessonId) ?? lessonId }));
  return [...order, ...extra].map((lesson) => {
    const rows = progress.filter((row) => row.lessonId === lesson.lessonId);
    return {
      ...lesson,
      started: rows.length,
      completed: rows.filter((row) => row.completedAt).length,
      abandoned: rows.filter((row) => !row.completedAt && row.updatedAt.getTime() < inactiveBefore).length,
      stoppedAfter: [...latestCompletion.values()].filter((row) => row.lessonId === lesson.lessonId && row.completedAt!.getTime() < inactiveBefore).length,
    };
  });
}
