import { describe, expect, it } from "vitest";
import type { LearnerFacts } from "./funnel";
import { buildFunnelReport, formatFunnelReport } from "./report";

const now = new Date("2026-10-22T10:00:00.000Z");
const learner = (key: string, startedAt: string, facts: Partial<LearnerFacts> = {}): LearnerFacts => ({
  key, kind: "account", startedAt: new Date(startedAt), diagnosticAt: null, firstLessonAt: null, firstArtifactAt: null, firstLabTradeAt: null, returnedAt: null, ...facts,
});
const facts = {
  learners: [
    learner("user-secret-1", "2026-10-20T08:00:00.000Z", { diagnosticAt: new Date("2026-10-20T08:05:00.000Z"), firstLessonAt: new Date("2026-10-20T08:20:00.000Z") }),
    learner("user-secret-2", "2026-10-01T08:00:00.000Z", { kind: "guest" }),
  ],
  progress: [{ key: "user-secret-1", lessonId: "foundations-why-invest", completedAt: new Date("2026-10-20T08:20:00.000Z"), updatedAt: new Date("2026-10-20T08:20:00.000Z") }],
  visits: [{ day: "2026-10-20", views: 12 }],
};

describe("funnel report", () => {
  const report = buildFunnelReport(facts, now, { weeks: 3 });

  it("covers the last 7 and 30 days, weekly cohorts and every curriculum lesson", () => {
    expect(report.funnels.map((funnel) => funnel.days)).toEqual([7, 30]);
    expect(report.funnels[0].learners.total).toBe(1);
    expect(report.funnels[1].learners).toEqual({ total: 2, accounts: 1, guests: 1 });
    expect(report.weeklyCohorts).toHaveLength(3);
    expect(report.lessonDropOff.find((lesson) => lesson.lessonId === "foundations-why-invest")).toMatchObject({ lessonId: "foundations-why-invest", started: 1, completed: 1 });
  });

  it("never contains a learner key, in either output format", () => {
    for (const output of [JSON.stringify(report), formatFunnelReport(report)]) expect(output).not.toMatch(/user-secret/);
  });

  it("prints unavailable steps as such, with Czech percentages", () => {
    const text = formatFunnelReport(report);
    expect(text).toContain("## Posledních 7 dní (16. 10. 2026 – 22. 10. 2026) · začali: 1 (účty: 1, hosté: 0)");
    expect(text).toMatch(/Milník A\s+nedostupné/);
    expect(text).toMatch(/První mise v Labu\s+nedostupné/);
    expect(text).toMatch(/Diagnostika\s+1\s+100\s%\s+100\s%/);
    expect(text).toContain("## Odchody po lekcích");
    expect(text).toMatch(/1\.1\.1 Spoření vs\. investování\s+1\s+1\s+0\s+0/);
  });
});
