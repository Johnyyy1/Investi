import { describe, expect, it } from "vitest";
import { artifactContentSchema } from "@/features/artifacts/schemas";
import { artifactExamples } from "@/features/artifacts/test-fixtures";
import { ipsSchema } from "./schema";
import { ipsTargetAllocation } from "./allocation";
import { decimalToBps, decimalToMinor, draftFromPlan, planFromDraft } from "./presentation";

import { exampleIps } from "./test-fixtures";

describe("IPS contracts", () => {
  it("preserves v1 plans and explicitly versions the extended payload", () => {
    for (const payload of [artifactExamples.investment_plan, exampleIps]) expect(artifactContentSchema.safeParse({ kind: "investment_plan", payload }).success).toBe(true);
    expect(ipsSchema.safeParse(artifactExamples.investment_plan).success).toBe(false);
    expect(ipsSchema.safeParse({ ...exampleIps, schemaVersion: 3 }).success).toBe(false);
  });
  it("checks exact totals, distinct positive weights and a single representation", () => {
    for (const allocation of [
      { lines: [{ instrumentId: "A", weightBps: 9999 }], cashBps: 0 },
      { lines: [{ instrumentId: "A", weightBps: 5000 }, { instrumentId: "A", weightBps: 5000 }], cashBps: 0 },
      { lines: [{ assetClass: "equity", weightBps: 5000 }, { instrumentId: "A", weightBps: 5000 }], cashBps: 0 },
      { lines: [{ instrumentId: "A", assetClass: "equity", weightBps: 10000 }], cashBps: 0 },
      { lines: [{ instrumentId: "A", weightBps: 0 }], cashBps: 10000 },
      { lines: [{ instrumentId: "A", weightBps: 9999.5 }], cashBps: 0.5 },
    ]) expect(ipsSchema.safeParse({ ...exampleIps, allocation }).success).toBe(false);
    expect(ipsSchema.safeParse({ ...exampleIps, allocation: { lines: [], cashBps: 10000 } }).success).toBe(true);
  });
  it("does not infer instruments for asset classes or cash, and reuses target-mix validation", () => {
    expect(ipsTargetAllocation(exampleIps)).toEqual({ lines: [{ instrumentId: "IE-XETR:VWCE", weightBasisPoints: 8000 }], cashWeightBasisPoints: 2000 });
    for (const allocation of [{ lines: [{ assetClass: "equity" as const, weightBps: 8000 }], cashBps: 2000 }, { lines: [], cashBps: 10000 }]) expect(() => ipsTargetAllocation({ ...exampleIps, allocation })).toThrow(/konkrétní instrumenty/);
  });
  it("requires rationale, bounded dates and mode-specific rebalancing settings", () => {
    for (const patch of [{ changeReason: " " }, { reviewMonth: 13 }, { signedAt: "yesterday" }, { contribution: { amountMinor: "100", dayOfMonth: 29 } },
      { rebalancing: { mode: "calendar" } }, { rebalancing: { mode: "band", bandBps: 0 } }, { rebalancing: { mode: "contributions", bandBps: 500 } },
      { foundation: { emergencyFund: "building", highCostDebt: "none", debtAmount: "100000" } }]) expect(ipsSchema.safeParse({ ...exampleIps, ...patch }).success).toBe(false);
  });
  it.each(["0", "1", "25", "13333", "999999999999999"])("keeps canonical minor units %s exact", (amountMinor) => {
    const payload = { ...exampleIps, contribution: { ...exampleIps.contribution, amountMinor } };
    expect(ipsSchema.parse(payload).contribution.amountMinor).toBe(amountMinor);
    expect(planFromDraft({ ...draftFromPlan(payload), reason: payload.changeReason }, payload.signedAt)).toEqual(payload);
  });
  it("parses decimal text without floating-point money and rejects ambiguous extra precision", () => {
    expect(decimalToMinor("0.1")).toBe("10"); expect(decimalToMinor("0,25")).toBe("25"); expect(decimalToMinor("1.33")).toBe("133");
    expect(decimalToBps("33.33")).toBe(3333);
    for (const bad of ["1.3333", "1e2", "-1", "", "1,000.25", "Infinity"]) expect(() => decimalToMinor(bad)).toThrow();
    for (const amountMinor of [0.1, 0.25, 1.3333, "1.33", "01", "-1"]) expect(ipsSchema.safeParse({ ...exampleIps, contribution: { ...exampleIps.contribution, amountMinor } }).success).toBe(false);
  });
});
