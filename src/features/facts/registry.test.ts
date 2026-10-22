import { describe, expect, it } from "vitest";
import { factsState, getFact, isFactPending } from "./registry";

describe("fact registry facade for factNotice", () => {
  it("resolves the version that applies on the given day", () => {
    expect(getFact("dan.strop_40m", "2025-12-31").value.amount).toBe(40000000);
    expect(getFact("dan.strop_40m", "2026-01-01").value.amount).toMatch(/zrušen/);
  });

  it("derives the lesson date from the oldest check and keeps unverified or blocked facts pending", () => {
    expect(isFactPending(getFact("dan.casovy_test_cp", "2026-10-21"))).toBe(true);
    expect(isFactPending(getFact("dan.limit_100k", "2026-10-22"))).toBe(false);
    expect(isFactPending(getFact("dan.oznameni_5m", "2026-10-21"))).toBe(false);
    const state = factsState(["dan.casovy_test_cp", "dan.limit_100k"], "2026-10-22")!;
    expect(state.asOf).toBe("2026-10-22");
    expect(state.pending).toBe(true);
    expect(state.sources).toHaveLength(3);
    expect(factsState(["dan.oznameni_5m"], "2026-10-21")!.pending).toBe(false);
    expect(factsState([], "2026-10-21")).toBeUndefined();
  });
});
