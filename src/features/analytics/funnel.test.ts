import { describe, expect, it } from "vitest";
import { lessonPlacements } from "../learning/curriculum";
import {
  buildFunnel, buildLessonDropOff, buildWeeklyCohorts, curriculumLessonOrder, funnelSteps, isEarlyReturnDay, startedWithin, weekStart,
  type LearnerFacts, type LessonProgressFact,
} from "./funnel";

// Thursday 22 October 2026, 12:00 in Prague (CEST, UTC+2).
const now = new Date("2026-10-22T10:00:00.000Z");
const at = (iso: string) => new Date(iso);

function learner(key: string, startedAt: string, facts: Partial<Omit<LearnerFacts, "key" | "startedAt">> = {}): LearnerFacts {
  return { key, kind: "account", startedAt: at(startedAt), diagnosticAt: null, firstLessonAt: null, firstArtifactAt: null, firstLabTradeAt: null, returnedAt: null, ...facts };
}

describe("isEarlyReturnDay", () => {
  // 23:30 on 15 October in Prague.
  const started = at("2026-10-15T21:30:00.000Z");

  it("never counts the start day itself", () => {
    expect(isEarlyReturnDay(started, at("2026-10-15T21:59:00.000Z"))).toBe(false);
  });

  it("counts the next Prague calendar day even when fewer than 24 hours have passed", () => {
    expect(isEarlyReturnDay(started, at("2026-10-15T22:30:00.000Z"))).toBe(true);
  });

  it("counts day 7 and stops on day 8", () => {
    expect(isEarlyReturnDay(started, at("2026-10-22T21:59:00.000Z"))).toBe(true);
    expect(isEarlyReturnDay(started, at("2026-10-22T22:00:00.000Z"))).toBe(false);
  });

  it("uses calendar days across the end of daylight saving time", () => {
    const beforeChange = at("2026-10-24T20:00:00.000Z"); // 22:00 CEST on 24 October
    expect(isEarlyReturnDay(beforeChange, at("2026-10-31T22:59:00.000Z"))).toBe(true); // 23:59 CET on 31 October
    expect(isEarlyReturnDay(beforeChange, at("2026-10-31T23:00:00.000Z"))).toBe(false); // 00:00 on 1 November
  });
});

describe("startedWithin", () => {
  it("covers the last N Prague calendar days, today included", () => {
    const learners = [
      learner("outside", "2026-10-15T21:59:00.000Z"), // 23:59 on 15 October
      learner("first-day", "2026-10-15T22:00:00.000Z"), // 00:00 on 16 October
      learner("today", "2026-10-22T09:00:00.000Z"),
    ];
    const window = startedWithin(learners, 7, now);
    expect(window).toMatchObject({ from: "2026-10-16", to: "2026-10-22" });
    expect(window.cohort.map((row) => row.key)).toEqual(["first-day", "today"]);
  });
});

describe("buildFunnel", () => {
  const learners = [
    learner("a", "2026-10-13T08:00:00.000Z", { diagnosticAt: at("2026-10-13T08:10:00.000Z"), firstLessonAt: at("2026-10-13T08:30:00.000Z"), firstArtifactAt: at("2026-10-14T08:00:00.000Z"), returnedAt: at("2026-10-14T08:00:00.000Z"), firstLabTradeAt: at("2026-10-16T08:00:00.000Z") }),
    learner("b", "2026-10-14T08:00:00.000Z", { kind: "guest", firstLessonAt: at("2026-10-14T08:30:00.000Z") }),
    // Skipped the diagnostic but still finished a lesson: counted for the lesson step.
    learner("c", "2026-10-20T08:00:00.000Z", { firstLessonAt: at("2026-10-20T09:00:00.000Z") }),
    learner("d", "2026-10-21T08:00:00.000Z", { diagnosticAt: at("2026-10-21T08:10:00.000Z"), returnedAt: at("2026-10-22T07:00:00.000Z") }),
    learner("old", "2026-08-01T08:00:00.000Z", { diagnosticAt: at("2026-08-01T08:10:00.000Z") }),
  ];
  const visits = [{ day: "2026-10-01", views: 500 }, { day: "2026-10-16", views: 30 }, { day: "2026-10-22", views: 10 }];

  it("lists the issue's steps in order", () => {
    expect(funnelSteps.map((step) => step.id)).toEqual(["visit", "start", "diagnostic", "first-lesson", "first-artifact", "milestone-a", "first-lab-mission", "return-7d"]);
  });

  it("counts the 30-day cohort step by step, independently of order", () => {
    const funnel = buildFunnel(learners, visits, 30, now);
    expect(funnel).toMatchObject({ days: 30, from: "2026-09-23", to: "2026-10-22", learners: { total: 4, accounts: 3, guests: 1 }, firstLabTrade: 1 });
    expect(Object.fromEntries(funnel.steps.map((step) => [step.id, step.count]))).toEqual({
      visit: 540, start: 4, diagnostic: 2, "first-lesson": 3, "first-artifact": 1, "milestone-a": null, "first-lab-mission": null, "return-7d": 2,
    });
  });

  it("reports steps without a data source as unavailable, never as zero, and skips them as a base", () => {
    const steps = buildFunnel(learners, visits, 30, now).steps;
    for (const id of ["milestone-a", "first-lab-mission"]) {
      const step = steps.find((row) => row.id === id)!;
      expect(step).toMatchObject({ count: null, fromPrevious: null, fromStart: null });
      expect(step.note).toMatch(/#1(26|42)/);
    }
  });

  it("derives conversions from learners at the previous available step and from the start", () => {
    const steps = Object.fromEntries(buildFunnel(learners, visits, 30, now).steps.map((step) => [step.id, step]));
    expect(steps.visit).toMatchObject({ fromPrevious: null, fromStart: null });
    expect(steps.start.fromPrevious).toBeCloseTo(4 / 540);
    expect(steps.start.note).toMatch(/zobrazení/);
    expect(steps.diagnostic).toMatchObject({ fromPrevious: 0.5, fromStart: 0.5 });
    // Of a and d (diagnostic), only a finished a lesson; b and c skipped the diagnostic but still count here.
    expect(steps["first-lesson"]).toMatchObject({ fromPrevious: 0.5, fromStart: 0.75 });
    expect(steps["first-artifact"].fromPrevious).toBeCloseTo(1 / 3);
    expect(steps["first-artifact"].fromStart).toBe(0.25);
  });

  it("measures returns only against learners whose seven-day window has closed or who returned", () => {
    const step = buildFunnel(learners, visits, 30, now).steps.find((row) => row.id === "return-7d")!;
    // c (started 20 Oct) has not returned and is still in its window; a, b and d are decided.
    expect(step).toMatchObject({ count: 2, fromPrevious: null });
    expect(step.fromStart).toBeCloseTo(2 / 3);
    expect(step.note).toMatch(/^Ještě v sedmidenním okně: 1\./);
  });

  it("keeps the 7-day window to recent starts and visits", () => {
    const funnel = buildFunnel(learners, visits, 7, now);
    expect(funnel.learners.total).toBe(2);
    expect(funnel.steps[0].count).toBe(40);
  });

  it("has no conversion base in an empty window", () => {
    const funnel = buildFunnel([], [], 7, now);
    expect(funnel.steps.every((step) => step.fromStart === null && (step.id === "visit" || step.fromPrevious === null))).toBe(true);
    expect(funnel.steps.find((step) => step.id === "start")!.count).toBe(0);
  });
});

describe("weekly cohorts", () => {
  it("starts weeks on Monday", () => {
    expect(weekStart("2026-10-22")).toBe("2026-10-19");
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
  });

  it("lists every week newest first, empty weeks included", () => {
    const cohorts = buildWeeklyCohorts([
      learner("a", "2026-10-20T08:00:00.000Z", { diagnosticAt: at("2026-10-20T08:10:00.000Z") }),
      learner("b", "2026-10-06T08:00:00.000Z", { firstLessonAt: at("2026-10-06T09:00:00.000Z"), firstArtifactAt: at("2026-10-07T09:00:00.000Z"), returnedAt: at("2026-10-07T09:00:00.000Z") }),
      learner("c", "2026-10-11T21:30:00.000Z"), // 23:30 Sunday 11 October in Prague: still the week of 5 October
    ], 4, now);
    expect(cohorts.map((cohort) => cohort.week)).toEqual(["2026-10-19", "2026-10-12", "2026-10-05", "2026-09-28"]);
    expect(cohorts[0]).toEqual({ week: "2026-10-19", learners: 1, diagnostic: 1, firstLesson: 0, firstArtifact: 0, returned: 0, returnPending: 1 });
    expect(cohorts[1].learners).toBe(0);
    expect(cohorts[2]).toEqual({ week: "2026-10-05", learners: 2, diagnostic: 0, firstLesson: 1, firstArtifact: 1, returned: 1, returnPending: 0 });
  });
});

describe("lesson drop-off", () => {
  it("orders published lessons by Curriculum 2.0 display order with their titles", () => {
    const order = curriculumLessonOrder();
    expect(order).toHaveLength(lessonPlacements.length);
    expect(order[0]).toEqual({ lessonId: "before-investing-budget", displayCode: "0.1.1", title: "Kolik ti zbývá: rozpočet a míra úspor" });
    const codes = order.map((lesson) => lesson.displayCode);
    expect(codes.indexOf("B.1.8")).toBeLessThan(codes.indexOf("3.1.1"));
    expect(codes.at(-1)).toBe("6.2.5");
  });

  it("counts opened, completed, abandoned and stopped-after per lesson", () => {
    const row = (key: string, lessonId: string, completedAt: string | null, updatedAt: string): LessonProgressFact =>
      ({ key, lessonId, completedAt: completedAt ? at(completedAt) : null, updatedAt: at(updatedAt) });
    const progress = [
      // a stopped after the first lesson two weeks ago.
      row("a", "foundations-why-invest", "2026-10-01T08:00:00.000Z", "2026-10-01T08:00:00.000Z"),
      // b finished two lessons, the latest recently, and left a third open long ago.
      row("b", "foundations-why-invest", "2026-10-01T08:00:00.000Z", "2026-10-01T08:00:00.000Z"),
      row("b", "foundations-stocks", "2026-10-20T08:00:00.000Z", "2026-10-20T08:00:00.000Z"),
      row("b", "foundations-markets", null, "2026-10-02T08:00:00.000Z"),
      // c is still working on the second lesson.
      row("c", "foundations-stocks", null, "2026-10-21T08:00:00.000Z"),
      // A lesson outside the curriculum still shows up.
      row("c", "retired-lesson", null, "2026-10-21T08:00:00.000Z"),
    ];
    const dropOff = buildLessonDropOff(progress, now);
    const byId = Object.fromEntries(dropOff.map((lesson) => [lesson.lessonId, lesson]));
    expect(byId["foundations-why-invest"]).toMatchObject({ started: 2, completed: 2, abandoned: 0, stoppedAfter: 1 });
    expect(byId["foundations-stocks"]).toMatchObject({ started: 2, completed: 1, abandoned: 0, stoppedAfter: 0 });
    expect(byId["foundations-markets"]).toMatchObject({ started: 1, completed: 0, abandoned: 1, stoppedAfter: 0 });
    expect(byId["foundations-portfolio"]).toMatchObject({ started: 0, completed: 0, abandoned: 0, stoppedAfter: 0 });
    expect(dropOff.at(-1)).toEqual({ lessonId: "retired-lesson", displayCode: null, title: "retired-lesson", started: 1, completed: 0, abandoned: 0, stoppedAfter: 0 });
  });
});
