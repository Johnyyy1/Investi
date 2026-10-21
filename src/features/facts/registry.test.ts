import { describe, expect, it } from "vitest";
import { factsState, formatFactDate, getFact } from "./registry";

describe("fact registry", () => {
  it("keeps every fact dated, sourced and owned", () => {
    for (const key of ["cz.tax.securities.time_test", "cz.tax.securities.value_test"] as const) {
      const fact = getFact(key);
      expect(fact.key).toBe(key);
      expect(fact.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fact.nextReviewAt > fact.verifiedAt).toBe(true);
      expect(fact.source.url).toMatch(/^https:\/\//);
      expect(fact.owner).not.toBe("");
    }
  });

  it("derives the lesson date from the oldest check and keeps pending visible", () => {
    const state = factsState(["cz.tax.securities.time_test", "cz.tax.securities.value_test"])!;
    expect(state.asOf).toBe("2026-10-20");
    expect(state.pending).toBe(true);
    expect(state.sources).toHaveLength(1);
    expect(factsState([])).toBeUndefined();
  });

  it("formats dates the Czech way", () => {
    expect(formatFactDate("2026-01-05")).toBe("5. 1. 2026");
  });
});
