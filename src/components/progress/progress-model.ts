import { curriculumMapModel } from "@/components/learning/curriculum-map-model";
import { moduleCatalog } from "@/features/learning/catalog";
import type { LearnerState } from "@/features/learning/learner-summary";
import type { loadLearner } from "@/features/learning/load-learner";
import { getAuthoredLesson } from "@/features/lessons/registry";
import { getGuidedSteps, getStepDefinitions } from "@/features/lessons/steps";
import type { AuthoredLesson } from "@/features/lessons/types";
import { chapterTitle, PLANNED_CHAPTER_TITLE } from "@/components/learning/studovna-model";

type Summary = Awaited<ReturnType<typeof loadLearner>>;
export type ProgressSummary = Pick<Summary, "lessons" | "completed" | "next" | "position" | "stepCount" | "allComplete"> & { states: readonly LearnerState[]; recent: readonly LearnerState[] };
type Lesson = Summary["lessons"][number];
export type LessonStatus = "done" | "active" | "next" | "todo";
export type OutcomeIcon = "layers" | "receipt" | "scale";

/** Editorial milestone copy from the approved Pen board (Pokrok, stav 3). The second item
 * is narrowed to what the Foundations lessons teach: they cover bid/ask/spread, not fund fees. */
const chapterOutcomes: Record<string, { lead: string; items: { icon: OutcomeIcon; title: string; text: string }[]; bridge?: { to: string; text: string } }> = {
  "investing-foundations": {
    lead: "Teď umíš přečíst jednoduché portfolio. Ne jako seznam názvů, ale jako rozhodnutí.",
    items: [
      { icon: "layers", title: "Z čeho se skládá", text: "Poznáš akcie, dluhopisy, fondy a hotovost a víš, co od které čekat." },
      { icon: "receipt", title: "Kolik stojí koupit", text: "Víš, proč nakupuješ za ask, prodáváš za bid a co znamená spread." },
      { icon: "scale", title: "Proč se riziko rozkládá", text: "Víš, proč váhy a víc nástrojů chrání před osudem jedné firmy." },
    ],
    bridge: { to: "returns", text: "A dává smysl další otázka: jak poznat, jestli se investici daří?" },
  },
};

/** The first sentence keeps the shelf scannable; the full explanation stays in the lesson step. */
export function firstSentence(text: string) {
  const trimmed = text.trim();
  return /^.+?[.!?…](?=\s+[„"(]?[\p{Lu}\d])/su.exec(trimmed)?.[0] ?? trimmed;
}

/** Callouts are the lesson's named ideas. Lessons without one fall back to their authored summary;
 * a generic "Shrnutí" heading gives way to the summary's own first two sentences. */
function lessonIdeas(authored: AuthoredLesson) {
  const steps = getGuidedSteps(authored);
  const pick = (types: string[]) => steps.flatMap((step, index) => step.blocks.flatMap((block) =>
    types.includes(block.type) && "title" in block && "content" in block ? [{ id: block.id, title: block.title, content: block.content, step: index + 1 }] : []));
  const callouts = pick(["conceptCallout"]);
  const ideas = callouts.length ? callouts : pick(["lessonSummary", "takeaway"]).slice(0, 1);
  return ideas.map(({ content, ...idea }) => {
    const first = firstSentence(content);
    if (callouts.length || !/^Shrnutí( lekce)?$/.test(idea.title)) return { ...idea, text: first };
    return { ...idea, title: first.replace(/\.$/, ""), text: firstSentence(content.slice(first.length)) };
  });
}

const href = (lesson: Pick<Lesson, "moduleSlug" | "slug">) => `/learn/${lesson.moduleSlug}/${lesson.slug}`;
const minutes = (lessons: readonly Pick<Lesson, "estimatedMinutes">[]) => lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0);
const latest = (dates: (Date | null | undefined)[]) => dates.reduce<Date | undefined>((max, date) => date && (!max || date > max) ? date : max, undefined);

/** Read-only presentation. Completion, continuation and recommendation stay with loadLearner. */
export function progressModel(summary: ProgressSummary) {
  const stateOf = (id: string) => summary.states.find((state) => state.lessonId === id);
  const doneIds = new Set(summary.completed.map((lesson) => lesson.id));
  const current = !summary.allComplete && stateOf(summary.next.id)?.status === "in_progress";
  const statusOf = (lesson: Lesson): LessonStatus => doneIds.has(lesson.id) ? "done" : stateOf(lesson.id)?.status === "in_progress" ? "active" : !summary.allComplete && summary.next.id === lesson.id ? "next" : "todo";
  const stepOf = (lesson: Lesson) => {
    const count = getStepDefinitions(lesson.id).length;
    return { position: Math.min(Math.max(stateOf(lesson.id)?.lastPosition ?? 0, 0) + 1, count), count };
  };

  const available = moduleCatalog.filter((chapter) => chapter.status === "available");
  const chapters = available.map((chapter, index) => {
    const lessons = summary.lessons.filter((lesson) => lesson.moduleSlug === chapter.slug).map((lesson) => {
      const status = statusOf(lesson);
      return { ...lesson, href: href(lesson), status, highlighted: !summary.allComplete && lesson.id === summary.next.id, step: status === "active" ? stepOf(lesson) : undefined };
    });
    const completed = lessons.filter((lesson) => lesson.status === "done").length;
    const status = lessons.length > 0 && completed === lessons.length ? "done" as const : lessons.some((lesson) => lesson.status === "done" || lesson.status === "active") ? "started" as const : "todo" as const;
    return { slug: chapter.slug, number: String(index + 1).padStart(2, "0"), title: chapterTitle(chapter), description: chapter.description, href: `/learn/${chapter.slug}`, lessons, completed, minutes: minutes(lessons), status, current: !summary.allComplete && summary.next.moduleSlug === chapter.slug };
  });
  const plannedTopics = moduleCatalog.filter((chapter) => chapter.status === "planned").map((chapter) => chapter.title);
  const planned = plannedTopics.length ? { number: String(available.length + 1).padStart(2, "0"), title: PLANNED_CHAPTER_TITLE, topics: plannedTopics } : undefined;

  const order = (lesson: Lesson) => summary.lessons.findIndex((item) => item.id === lesson.id);
  const knowledge = summary.completed.map((lesson) => {
    const authored = getAuthoredLesson(lesson.moduleSlug, lesson.slug);
    const bridge = authored?.blocks.find((block) => block.type === "labBridge");
    return { id: lesson.id, title: lesson.title, href: href(lesson), estimatedMinutes: lesson.estimatedMinutes, completedAt: stateOf(lesson.id)?.completedAt ?? undefined, ideas: authored ? lessonIdeas(authored) : [], labBridge: bridge && "content" in bridge ? bridge.content : undefined, order: order(lesson) };
  });
  // The shelf shows the three most recent completions, oldest first; older ones wait behind a disclosure.
  const byRecency = [...knowledge].sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0) || b.order - a.order);
  const featured = byRecency.slice(0, 3).reverse();
  const shelved = byRecency.slice(3).sort((a, b) => a.order - b.order);
  const bridge = byRecency.find((lesson) => lesson.labBridge);

  const latestChapter = chapters.find((chapter) => chapter.lessons.some((lesson) => lesson.id === summary.recent[0]?.lessonId));
  const nextChapter = chapters.find((chapter) => chapter.slug === summary.next.moduleSlug);
  const milestone = !summary.allComplete && !current && latestChapter?.status === "done" && nextChapter && nextChapter !== latestChapter ? {
    chapter: latestChapter,
    completedAt: latest(latestChapter.lessons.map((lesson) => stateOf(lesson.id)?.completedAt)),
    outcome: chapterOutcomes[latestChapter.slug],
    bridge: chapterOutcomes[latestChapter.slug]?.bridge?.to === nextChapter.slug ? chapterOutcomes[latestChapter.slug]?.bridge?.text : undefined,
    nextChapter,
  } : undefined;

  const activeCount = summary.lessons.filter((lesson) => statusOf(lesson) === "active").length;
  return {
    levels: curriculumMapModel(summary), chapters, planned, knowledge, featured, shelved, milestone, current, activeCount,
    ideaCount: knowledge.reduce((sum, lesson) => sum + lesson.ideas.length, 0),
    labBridge: bridge ? { text: bridge.labBridge!, lessonTitle: bridge.title } : undefined,
    continueHref: summary.allComplete ? "/lab" : href(summary.next),
  };
}
