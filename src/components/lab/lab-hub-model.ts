import { foundationsLessons } from "@/features/lessons/foundations/manifest";
import { buildBacktestResult, formatBacktestMoney, type ComparisonPoint } from "./backtest-model";

/** Presentation rules for the /lab hub (Pen "Investi / Lab hub — 1440px" iByrw and "— 390px" YZnok).
 * Lesson facts come from the manifest and the learner's progress; the Backtesting preview is the
 * same synthetic sample the Backtesting Lab runs, so no number on the hub is invented. */

const FOUNDATIONS_PATH = "/learn/investing-foundations";
const published = foundationsLessons.filter((lesson) => lesson.status === "available");

/** Which lesson explains which Lab move. Lab works without them; rows only point at the explanation. */
const lessonLinks = [
  { action: "Váhy portfolia", lessonId: "foundations-portfolio" },
  { action: "Výběr fondu do mixu", lessonId: "foundations-etfs-indexes" },
  { action: "Mix proti akciím v čase", lessonId: "foundations-risk-reward" },
] as const;

export type LessonLinkRow = { action: string; title: string; href: string; number: number; minutes: number; done: boolean };

export function labLessonRows(completedLessonIds: ReadonlySet<string>): LessonLinkRow[] {
  return lessonLinks.flatMap(({ action, lessonId }) => {
    const index = published.findIndex((lesson) => lesson.id === lessonId);
    if (index < 0) return [];
    const lesson = published[index];
    return [{ action, title: lesson.title, href: `${FOUNDATIONS_PATH}/${lesson.slug}`, number: index + 1, minutes: lesson.estimatedMinutes, done: completedLessonIds.has(lesson.id) }];
  });
}

/** The first published Foundations lesson not yet completed, for the locked Portfolio Lab card. */
export function nextFoundationsLesson(completedLessonIds: ReadonlySet<string>) {
  const lesson = published.find(({ id }) => !completedLessonIds.has(id));
  return lesson ? { title: lesson.title, href: `${FOUNDATIONS_PATH}/${lesson.slug}`, minutes: lesson.estimatedMinutes } : null;
}

/** Two polylines in one shared value scale, so the gap between the paths is the gap between the results. */
export function sparklinePaths(points: readonly ComparisonPoint[], width = 532, height = 72, inset = 4) {
  const values = points.flatMap(({ value, benchmark }) => [value, benchmark]);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = (index: number) => points.length > 1 ? (index / (points.length - 1)) * width : 0;
  const y = (value: number) => inset + (1 - (value - min) / span) * (height - inset * 2);
  const path = (key: "value" | "benchmark") => points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(point[key]).toFixed(1)}`).join(" ");
  return { strategy: path("value"), benchmark: path("benchmark"), baseline: y(points[0]?.value ?? min).toFixed(1) };
}

const PREVIEW_AMOUNT = "10000";

/** A fixed preview of one Backtesting Lab experiment: Mix 60/30/10 against the stock sample in 2020–2021.
 * Final values stay in the Lab, after the learner's own prediction (Pen state 1 shows no values). */
export function backtestPreview() {
  const result = buildBacktestResult({ strategy: "mixed", start: 2020, end: 2021, amount: PREVIEW_AMOUNT });
  return { amount: formatBacktestMoney(result.amount), period: "1/2020–12/2021", paths: sparklinePaths(result.points) };
}
