import { describe, expect, it } from "vitest";
import { factRegistry } from "./registry";
import { calendarDate, factReviewState, factToday, formatFactValue, resolveFact, validateFactRegistry } from "./resolve";
import { prepareLessonFacts } from "./lesson-facts";
import { checkPublishedFacts } from "./check-published";
import { authoredLessons } from "@/features/lessons/registry";
import { curriculumLessons } from "@/features/learning/catalog";
import type { AuthoredLesson } from "@/features/lessons/types";
import type { FactVersion } from "./types";

const today = "2026-10-21";
const verified: FactVersion = { ...factRegistry.find((fact) => fact.key === "dan.oznameni_5m")!, key: "test.limit", value: { amount: 100000, unit: "Kč" }, checkedAt: "2026-09-01", verifiedAt: "2026-09-01", nextReviewAt: "2026-10-01" };
const second: FactVersion = { ...verified, key: "test.rate", value: { amount: 0.25, unit: "%" }, verifiedAt: "2026-08-01" };
const registry = [verified, second];
function lesson(text = "Limit je {{test.limit}}."): AuthoredLesson {
  return { id: "fixture", slug: "fixture", moduleSlug: "fixture", title: "Ukázka", eyebrow: "", position: 1, estimatedMinutes: 1, sections: [], blocks: [{ id: "intro", type: "paragraph", content: text }] };
}

describe("dated fact registry", () => {
  it("has all 27 requested keys with complete, nonoverlapping versions", () => {
    expect(() => validateFactRegistry(factRegistry)).not.toThrow();
    expect([...new Set(factRegistry.map((fact) => fact.key))].sort()).toEqual([
      "dan.casovy_test_cp", "dan.limit_100k", "dan.strop_40m", "dan.hranice_priznani", "dan.oznameni_5m", "dan.lhuty_priznani", "dan.sazby_dpfo", "dan.dividendy_cz", "dan.dividendy_zahranicni", "dan.w8ben", "dan.jednotny_kurz", "dan.evidence_dukazni_bremeno", "dan.urok_srazka", "dps.statni_prispevek", "dps.odpocet", "dip.podminky", "zam.prispevek", "gfo.nahrada", "esma.cfd", "makro.inflace", "makro.repo", "cnb.jerrs", "eu.priips_ucits", "eu.mifid_vhodnost", "krypto.dane", "spiva.2025", "morningstar.gap",
    ].sort());
  });
  it("resolves the historical 2025 cap and the distinct 2026 rule", () => {
    expect(resolveFact("dan.strop_40m", "2025-12-31", factRegistry).value.amount).toBe(40000000);
    expect(resolveFact("dan.strop_40m", "2026-01-01", factRegistry).value.amount).toMatch(/zrušen/);
    expect(() => resolveFact("dan.jednotny_kurz", today, factRegistry)).toThrow(/applicable version/);
    expect(() => resolveFact("dan.strop_40m", "2024-12-31", factRegistry)).toThrow();
  });
  it("rejects overlaps, duplicate versions and invalid calendar dates", () => {
    expect(() => validateFactRegistry([verified, { ...verified, version: "another" }])).toThrow(/Overlapping/);
    expect(() => validateFactRegistry([verified, verified])).toThrow(/Duplicate/);
    expect(() => calendarDate("2026-02-30")).toThrow();
    expect(() => calendarDate("2026-10-21T00:00:00Z")).toThrow();
  });
  it("does not invent a successful verification date", () => {
    for (const fact of factRegistry.filter((fact) => fact.verificationStatus === "unverified")) expect(fact.verifiedAt).toBeNull();
    expect(() => validateFactRegistry([{ ...verified, verificationStatus: "unverified" }])).toThrow(/mismatch/);
  });
  it("formats Czech numbers, fractional percentages, zero and text", () => {
    expect(formatFactValue(verified.value).replaceAll("\u00a0", " ")).toBe("100 000 Kč");
    expect(formatFactValue(second.value)).toBe("0,25 %");
    expect(formatFactValue({ amount: 0, unit: "Kč" })).toBe("0 Kč");
    expect(formatFactValue({ amount: "Zrušeno", unit: "" })).toBe("Zrušeno");
  });
  it("flags review after the deadline and warns from day 60, using an explicit clock", () => {
    expect(factToday(new Date("2026-10-20T22:30:00Z"))).toBe("2026-10-21");
    expect(factReviewState(verified, "2026-10-01")).toEqual({ overdueDays: 0, overdue: false, stale: false });
    expect(factReviewState(verified, "2026-10-02").overdue).toBe(true);
    expect(factReviewState(verified, "2026-11-29").stale).toBe(false);
    expect(factReviewState(verified, "2026-11-30")).toEqual({ overdueDays: 60, overdue: true, stale: true });
  });
});

describe("lesson fact tokens and publication gate", () => {
  it("fails unknown, malformed and structural tokens, even in drafts", () => {
    expect(() => prepareLessonFacts(lesson("{{no.such_fact}}"), registry, { today, published: false })).toThrow(/Unknown/);
    for (const text of ["{{test.limit}", "{{test limit}}", "test.limit}}", "{{{{test.limit}}}}"] ) expect(() => prepareLessonFacts(lesson(text), registry, { today, published: false })).toThrow(/Malformed/);
    expect(() => prepareLessonFacts({ ...lesson(), id: "{{test.limit}}" }, registry, { today, published: true })).toThrow(/structural/);
  });
  it("rejects unverified and unresolved facts in published lessons but permits an editorial draft", () => {
    const unverified: FactVersion = { ...verified, verificationStatus: "unverified", verifiedAt: null };
    expect(() => prepareLessonFacts(lesson(), [unverified], { today, published: true })).toThrow(/Unverified/);
    expect(prepareLessonFacts(lesson(), [unverified], { today, published: false }).notice).toBeUndefined();
    expect(() => prepareLessonFacts(lesson(), [{ ...verified, publicationBlockedBy: "#134" }], { today, published: true })).toThrow(/blocked/);
    expect(() => prepareLessonFacts(lesson(), [{ ...verified, verifiedAt: "2027-01-01" }], { today, published: true })).toThrow(/Future/);
  });
  it("uses the oldest verified reference, deduplicates warnings and never rewrites the authored source", () => {
    const raw = lesson("{{test.limit}} a {{test.rate}}; {{test.limit}}.");
    const prepared = prepareLessonFacts(raw, registry, { today: "2026-11-30", published: true });
    expect(prepared.notice).toEqual({ verifiedAt: "2026-08-01", staleFacts: [verified.label, second.label] });
    expect(prepared.facts).toHaveLength(2);
    expect(raw.blocks[0]).toMatchObject({ content: "{{test.limit}} a {{test.rate}}; {{test.limit}}." });
  });
  it("resolves all display fields, including questions, worked steps and hidden feedback, preserving grading and IDs", () => {
    const raw = lesson();
    raw.blocks.push({ id: "question", type: "multipleChoiceQuestion", prompt: "{{test.limit}}?", options: [{ id: "a", label: "{{test.rate}}" }], correctOptionId: "a", correctExplanation: "{{test.limit}}", incorrectExplanation: "{{test.rate}}" });
    raw.blocks.push({ id: "example", type: "workedExample", title: "{{test.limit}}", steps: [{ label: "{{test.rate}}", value: "{{test.limit}}" }], conclusion: "{{test.rate}}" });
    const prepared = prepareLessonFacts(raw, registry, { today, published: true });
    expect(JSON.stringify(prepared.lesson)).not.toContain("{{");
    expect(prepared.lesson.blocks[1]).toMatchObject({ id: "question", correctOptionId: "a", options: [{ id: "a", label: "0,25 %" }] });
    const hiddenUnknown = { ...raw, blocks: [{ ...raw.blocks[1], incorrectExplanation: "{{unknown.fact}}" }] };
    expect(() => prepareLessonFacts(hiddenUnknown, registry, { today, published: true })).toThrow(/Unknown/);
  });
  it("uses the scenario date for applicability and today's date for freshness", () => {
    const raw = { ...lesson("{{dan.strop_40m}}"), factContext: { asOf: "2025-12-31" } };
    const prepared = prepareLessonFacts(raw, factRegistry, { today: "2027-03-16", published: true });
    expect(prepared.facts[0].version).toBe("2025");
    expect(prepared.notice?.staleFacts).toHaveLength(1);
  });
  it("requires dated references for explicitly declared tax lessons and leaves ordinary lessons without a notice", () => {
    expect(() => prepareLessonFacts({ ...lesson("Bez faktů"), factContext: { kind: "tax" } }, registry, { today, published: true })).toThrow(/needs dated/);
    expect(prepareLessonFacts(lesson("Bez faktů"), registry, { today, published: true }).notice).toBeUndefined();
  });
  it("preserves TeX braces and rejects fact tokens inside TeX", () => {
    const raw = lesson("Text");
    raw.blocks.push({ id: "math", type: "formula", expression: "\\frac{V_t}{V_0}", latex: "R=\\frac{V_t}{V_0}", variables: [{ symbol: "V_0", description: "Hodnota" }] });
    expect(prepareLessonFacts(raw, registry, { today, published: true }).lesson).toEqual(raw);
    raw.blocks[1] = { id: "math", type: "formula", expression: "{{test.limit}}", variables: [] };
    expect(() => prepareLessonFacts(raw, registry, { today, published: true })).toThrow(/structural/);
  });
  it("checks every published lesson in CI and fails publication of an unverified draft", () => {
    expect(() => checkPublishedFacts(factRegistry, authoredLessons, curriculumLessons, today)).not.toThrow();
    const draft = lesson("{{dan.w8ben}}");
    expect(() => checkPublishedFacts(factRegistry, [draft], [{ id: draft.id, status: "planned" }], today)).not.toThrow();
    expect(() => checkPublishedFacts(factRegistry, [draft], [{ id: draft.id, status: "available" }], today)).toThrow(/Unverified/);
    expect(() => checkPublishedFacts(factRegistry, [], [{ id: "missing", status: "available" }], today)).toThrow(/no authored/);
    const notice = { ...lesson(""), id: "notice", blocks: [{ id: "facts", type: "factNotice" as const, factKeys: ["dan.casovy_test_cp" as const] }] };
    expect(() => checkPublishedFacts(factRegistry, [notice], [{ id: notice.id, status: "planned" }], today)).not.toThrow();
    expect(() => checkPublishedFacts(factRegistry, [notice], [{ id: notice.id, status: "available" }], today)).toThrow(/Unverified/);
  });
});
