import { describe, expect, it } from "vitest";
import { adjustmentPolicies, type HistoricalPricePoint, type HistoricalSeries } from "@/features/market-data/contracts";
import { checkPercentAnswer, freezeLessonHistory, isRealHistory, lessonHistoryPlans, snapshotReturns, validateSnapshotPoints, type LessonHistoryPlan } from "./snapshot";

const plan: LessonHistoryPlan = lessonHistoryPlans.fmp;
const aapl = plan.instruments[0];
const bar = (date: string, close: number): HistoricalPricePoint => ({ date, open: close, high: close, low: close, close });

// Test-only closes; not real market data.
const quarterBars = [
  bar("2023-12-27", 101), bar("2023-12-28", 99), bar("2023-12-29", 100),
  bar("2024-03-27", 108), bar("2024-03-28", 110),
  bar("2024-06-28", 99),
  bar("2024-09-27", 120), bar("2024-09-30", 118.8),
  bar("2024-12-30", 125), bar("2024-12-31", 130.68),
];

function series(points: readonly HistoricalPricePoint[], overrides: Partial<HistoricalSeries> = {}): HistoricalSeries {
  return {
    instrumentId: aapl.instrumentId, currency: "USD", interval: "daily", timeZone: "UTC", adjustment: adjustmentPolicies["split-adjusted"], points,
    provenance: { provider: "financial-modeling-prep", dataset: "stable/historical-price-eod/full", dataKind: "historical", isDeterministic: false, isDemo: false, adjustmentMode: "split-adjusted", completeness: "complete", observedAt: "2024-12-31T00:00:00.000Z", retrievedAt: "2026-10-18T08:00:00.000Z" },
    ...overrides,
  };
}

describe("lesson history snapshot", () => {
  it("freezes the last close on or before each anchor, with provenance", () => {
    const entry = freezeLessonHistory(series(quarterBars), plan, aapl, "/lab/instruments/FMP%3ANASDAQ%3AAAPL");
    expect(entry.status).toBe("ok");
    if (entry.status !== "ok") return;
    expect(entry.snapshot.points).toEqual([
      { date: "2023-12-29", close: 100 }, { date: "2024-03-28", close: 110 }, { date: "2024-06-28", close: 99 },
      { date: "2024-09-30", close: 118.8 }, { date: "2024-12-31", close: 130.68 },
    ]);
    expect(entry.snapshot).toMatchObject({ symbol: "AAPL", currency: "USD", labHref: "/lab/instruments/FMP%3ANASDAQ%3AAAPL", provenance: { provider: "financial-modeling-prep", dataKind: "historical", adjustmentMode: "split-adjusted", completeness: "complete", retrievedAt: "2026-10-18T08:00:00.000Z" } });
    expect(isRealHistory(entry.snapshot)).toBe(true);
  });

  it("does not depend on the day it runs: the same series always freezes the same points", () => {
    const first = freezeLessonHistory(series(quarterBars), plan, aapl, null);
    const later = freezeLessonHistory(series(quarterBars, { provenance: { ...series(quarterBars).provenance, retrievedAt: "2027-05-01T00:00:00.000Z" } }), plan, aapl, null);
    expect(first.status === "ok" && first.snapshot.points).toEqual(later.status === "ok" && later.snapshot.points);
  });

  it("never fills a missing anchor: a gap longer than the lookback makes the instrument unavailable", () => {
    const withoutJune = quarterBars.filter((point) => !point.date.startsWith("2024-06"));
    expect(freezeLessonHistory(series(withoutJune), plan, aapl, null)).toMatchObject({ status: "unavailable", instrument: aapl });
  });

  it.each([
    ["unsorted", [quarterBars[1], quarterBars[0], ...quarterBars.slice(2)]],
    ["duplicate", [quarterBars[0], ...quarterBars]],
    ["zero close", quarterBars.map((point) => point.date === "2024-06-28" ? bar(point.date, 0) : point)],
    ["negative close", quarterBars.map((point) => point.date === "2024-06-28" ? bar(point.date, -1) : point)],
    ["outside the window", [bar("2023-11-30", 90), ...quarterBars]],
  ])("rejects %s source data instead of repairing it", (_, points) => {
    expect(freezeLessonHistory(series(points), plan, aapl, null).status).toBe("unavailable");
  });

  it("rejects raw or total-return history and a different instrument", () => {
    expect(freezeLessonHistory(series(quarterBars, { adjustment: adjustmentPolicies.raw }), plan, aapl, null).status).toBe("unavailable");
    expect(freezeLessonHistory(series(quarterBars, { adjustment: adjustmentPolicies["total-return"] }), plan, aapl, null).status).toBe("unavailable");
    expect(freezeLessonHistory(series(quarterBars, { instrumentId: "FMP:AMEX:SPY" }), plan, aapl, null).status).toBe("unavailable");
  });

  it("labels deterministic and synthetic snapshots as sample data, never as historical", () => {
    const synthetic = freezeLessonHistory(series(quarterBars, { provenance: { ...series(quarterBars).provenance, dataKind: "synthetic", isDeterministic: true, isDemo: true } }), plan, aapl, null);
    expect(synthetic.status === "ok" && isRealHistory(synthetic.snapshot)).toBe(false);
  });

  it("validates frozen points: order, duplicates and positive prices", () => {
    expect(validateSnapshotPoints([{ date: "2024-01-02", close: 1 }, { date: "2024-01-03", close: 2 }])).toBeNull();
    expect(validateSnapshotPoints([{ date: "2024-01-02", close: 1 }])).toBe("too-few-points");
    expect(validateSnapshotPoints([{ date: "2024-01-03", close: 1 }, { date: "2024-01-02", close: 2 }])).toBe("unsorted-date");
    expect(validateSnapshotPoints([{ date: "2024-01-02", close: 1 }, { date: "2024-01-02", close: 2 }])).toBe("duplicate-date");
    expect(validateSnapshotPoints([{ date: "2024-01-02", close: 1 }, { date: "2024-01-03", close: 0 }])).toBe("invalid-close");
    expect(validateSnapshotPoints([{ date: "2024-01-02", close: 1 }, { date: "2024-01-03", close: Number.NaN }])).toBe("invalid-close");
    expect(validateSnapshotPoints([{ date: "2024-02-30", close: 1 }, { date: "2024-03-01", close: 2 }])).toBe("invalid-date");
  });

  it("keeps every frozen plan anchor ordered and inside its request window", () => {
    for (const candidate of Object.values(lessonHistoryPlans)) {
      expect([...candidate.anchors].sort()).toEqual(candidate.anchors);
      expect(new Set(candidate.anchors).size).toBe(candidate.anchors.length);
      expect(candidate.anchors.every((anchor) => anchor >= candidate.startDate && anchor <= candidate.endDate)).toBe(true);
      expect(candidate.instruments.map((instrument) => instrument.assetType).sort()).toEqual(["equity", "etf"]);
    }
  });
});

describe("returns over a snapshot", () => {
  const points = [{ date: "2023-12-29", close: 100 }, { date: "2024-03-28", close: 110 }, { date: "2024-06-28", close: 99 }, { date: "2024-09-30", close: 118.8 }, { date: "2024-12-31", close: 130.68 }];

  it("computes each period from its own previous close and compounds them exactly", () => {
    const result = snapshotReturns(points);
    expect(result.periods.map((period) => period.returnValue)).toEqual([expect.closeTo(0.1, 12), expect.closeTo(-0.1, 12), expect.closeTo(0.2, 12), expect.closeTo(0.1, 12)]);
    expect(result.compounded).toBeCloseTo(0.3068, 12);
    expect(result.direct).toBeCloseTo(result.compounded, 12);
    expect(result.arithmeticSum).toBeCloseTo(0.3, 12);
  });

  it("handles closes with awkward decimals without rounding the stored return", () => {
    const result = snapshotReturns([{ date: "2024-01-02", close: 1.3333 }, { date: "2024-01-03", close: 0.25 }, { date: "2024-01-04", close: 0.1 }]);
    expect(result.periods[0].returnValue).toBeCloseTo(0.25 / 1.3333 - 1, 15);
    expect(result.compounded).toBeCloseTo(0.1 / 1.3333 - 1, 12);
  });

  it("checks percentage answers deterministically, with a Czech decimal comma and no blank-as-zero", () => {
    expect(checkPercentAnswer("10", 0.1)).toBe(true);
    expect(checkPercentAnswer("30,68", 0.3068)).toBe(true);
    expect(checkPercentAnswer("30,7", 0.3068)).toBe(true);
    expect(checkPercentAnswer("30", 0.3068)).toBe(false);
    expect(checkPercentAnswer("0,3068", 0.3068)).toBe(false);
    expect(checkPercentAnswer("", 0)).toBeUndefined();
    expect(checkPercentAnswer("abc", 0.1)).toBeUndefined();
  });
});
