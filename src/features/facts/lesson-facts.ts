import type { AuthoredLesson } from "@/features/lessons/types";
import { calendarDate, factReviewState, formatFactValue, resolveFact } from "./resolve";
import type { FactVersion, LessonFactNotice } from "./types";

const displayFields = new Set(["title", "eyebrow", "label", "content", "body", "introduction", "value", "conclusion", "description", "prompt", "correctExplanation", "incorrectExplanation", "unit"]);

/** Resolve the entire display payload, including questions/feedback, before it crosses into the client. */
export function prepareLessonFacts(lesson: AuthoredLesson, registry: readonly FactVersion[], options: { today: string; published: boolean }) {
  const today = calendarDate(options.today);
  const asOf = calendarDate(lesson.factContext?.asOf ?? today);
  const used = new Map<string, FactVersion>();
  function visit(value: unknown, field = ""): unknown {
    if (typeof value === "string") {
      // TeX groups legitimately contain adjacent braces. Only a namespaced token
      // opening is meaningful here; formatted Czech prose is not valid TeX.
      if (["latex", "expression", "symbol"].includes(field) && !/\{\{\s*[a-z][a-z0-9_]*\./.test(value)) return value;
      if (!value.includes("{{") && !value.includes("}}")) return value;
      if (!displayFields.has(field)) throw new Error(`Fact token in structural field ${lesson.id}.${field}`);
      // Check syntax before substitution; no unresolved or malformed delimiters reach a lesson.
      const pattern = /\{\{\s*([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)\s*\}\}/g;
      const remainder = value.replace(pattern, "");
      if (remainder.includes("{{") || remainder.includes("}}")) throw new Error(`Malformed fact token in ${lesson.id}.${field}`);
      return value.replace(pattern, (_, key: string) => {
        const fact = resolveFact(key, asOf, registry);
        if (options.published && (fact.verificationStatus === "unverified" || fact.publicationBlockedBy)) throw new Error(`Unverified or blocked fact in published lesson ${lesson.id}: ${key}`);
        if (fact.verifiedAt && fact.verifiedAt > today) throw new Error(`Future verification in ${lesson.id}: ${key}`);
        used.set(key, fact);
        return formatFactValue(fact.value);
      });
    }
    if (Array.isArray(value)) return value.map((item) => visit(item, field));
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item, key)]));
    return value;
  }
  const resolved = visit(lesson) as AuthoredLesson;
  const facts = [...used.values()];
  const verified = facts.flatMap((fact) => fact.verifiedAt ? [fact.verifiedAt] : []).sort();
  if (options.published && lesson.factContext?.kind === "tax" && !facts.length) throw new Error(`Tax lesson ${lesson.id} needs dated fact references`);
  const notice: LessonFactNotice | undefined = facts.length && verified.length === facts.length ? {
    verifiedAt: verified[0],
    staleFacts: facts.filter((fact) => factReviewState(fact, today).stale).map((fact) => fact.label),
  } : undefined;
  return { lesson: resolved, facts, notice };
}
