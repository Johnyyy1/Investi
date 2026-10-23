import { describe, expect, it } from "vitest";
import { factRegistry } from "@/features/facts/registry";
import { formatFactValue } from "@/features/facts/resolve";
import { availableLessons } from "@/features/learning/catalog";
import { authoredLessons } from "./registry";
import type { AuthoredLesson } from "./types";

const published = authoredLessons.filter((lesson) => availableLessons.some((definition) => definition.id === lesson.id));
const strings = (value: unknown): string[] => typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
// Authors and Intl write thousands with different spaces (U+0020, U+00A0, U+202F).
const spaces = (value: string) => value.replace(/\s+/g, " ");
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** US account types and agencies belong in a Czech lesson only next to an explicit US context. */
function unexplainedUsTerms(lesson: AuthoredLesson) {
  return strings(lesson.blocks).filter((text) => /401\(k\)|\bIRA\b|\bRoth\b|\bIRS\b/.test(text) && !/USA|americk/i.test(text));
}

/** A tax lesson takes changing limits and rates from the fact registry (`{{dan.…}}`), never as literals that silently go stale. */
const numericFacts = [...new Set(factRegistry.filter((fact) => typeof fact.value.amount === "number").map((fact) => spaces(formatFactValue(fact.value))))];
function literalFactValues(lesson: AuthoredLesson) {
  if (lesson.factContext?.kind !== "tax") return [];
  const text = strings(lesson.blocks).map(spaces).join("\n");
  return numericFacts.filter((value) => new RegExp(`(?<![\\d,] ?)${escape(value)}`).test(text));
}

const sample = (content: string, kind?: "tax"): AuthoredLesson => ({ id: "sample", moduleSlug: "sample", slug: "sample", title: "Vzor", eyebrow: "", position: 1, estimatedMinutes: 1, sections: [], factContext: kind && { kind }, blocks: [{ id: "p", type: "paragraph", content }] });

describe("published lesson content lint", () => {
  it("mentions US-only accounts and agencies only with a US context", () => {
    expect(published.flatMap((lesson) => unexplainedUsTerms(lesson).map((text) => `${lesson.id}: ${text}`))).toEqual([]);
    expect(unexplainedUsTerms(sample("Spoř si do IRA."))).toHaveLength(1);
    expect(unexplainedUsTerms(sample("Účty 401(k) a IRA existují jen v USA."))).toEqual([]);
  });

  it("keeps registry tax values out of tax lessons' literal text", () => {
    expect(published.flatMap((lesson) => literalFactValues(lesson).map((value) => `${lesson.id}: ${value}`))).toEqual([]);
    expect(numericFacts).toContain("100 000 Kč");
    expect(literalFactValues(sample("Osvobození platí do 100 000 Kč ročně.", "tax"))).toEqual(["100 000 Kč"]);
    expect(literalFactValues(sample("Osvobození platí do {{dan.limit_100k}} ročně.", "tax"))).toEqual([]);
    expect(literalFactValues(sample("Prodej za 1 100 000 Kč.", "tax"))).toEqual([]);
    expect(literalFactValues(sample("Osvobození platí do 100 000 Kč ročně."))).toEqual([]);
  });
});
