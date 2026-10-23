import { describe, expect, it } from "vitest";
import { checkIpsPurchase, checkScenario, type ScenarioDecision } from "./checks";
import { exampleIps } from "@/features/ips/test-fixtures";
import { requireMissions } from "./requirements";
import { getMission } from "./registry";

export const decision: ScenarioDecision = { allocation: { svet: 80, tech: 0, cip: 0, energie: 0, banka: 0, leky: 0 }, prediction: "fail" };
describe("server mission criteria", () => {
  it("grades explainable diversification rules independently of prediction and returns", () => {
    expect(checkScenario(decision)).toMatchObject({ completed: true, rules: expect.arrayContaining([expect.objectContaining({ id: "cash", percent: 20, pass: true })]) });
    expect(checkScenario({ ...decision, prediction: "pass" }).completed).toBe(true);
    expect(checkScenario({ ...decision, allocation: { ...decision.allocation, svet: 0, tech: 100 } }).completed).toBe(false);
    expect(checkScenario({ ...decision, allocation: { ...decision.allocation, svet: 0 } }).completed).toBe(false);
  });
  it.each([
    { ...decision, completed: true }, { ...decision, allocation: { ...decision.allocation, svet: 101 } },
    { ...decision, allocation: { ...decision.allocation, svet: -10 } }, { ...decision, allocation: { ...decision.allocation, svet: 0.1 } },
    { ...decision, allocation: { ...decision.allocation, tech: 30 } }, { ...decision, allocation: { ...decision.allocation, invented: 0 } },
    { ...decision, allocation: {} }, { ...decision, prediction: undefined },
  ])("rejects forged, incomplete or invalid decisions %#", (input) => expect(() => checkScenario(input)).toThrow());
  it("requires a real ETF BUY after the saved plan with an exact instrument identity", () => {
    const at = new Date("2026-10-23T10:00:00Z");
    const trade = { id: "t", instrumentId: "IE-XETR:VWCE", side: "BUY", instrumentAssetType: "etf", executedAt: at };
    expect(checkIpsPurchase(exampleIps, at, [trade])?.id).toBe("t");
    for (const wrong of [{ ...trade, side: "SELL" }, { ...trade, instrumentAssetType: "equity" }, { ...trade, instrumentId: "US:VWCE" }, { ...trade, executedAt: new Date(at.getTime() - 1) }]) expect(checkIpsPurchase(exampleIps, at, [wrong])).toBeUndefined();
    expect(checkIpsPurchase({ ...exampleIps, allocation: { lines: [{ assetClass: "equity", weightBps: 8000 }], cashBps: 2000 } }, at, [trade])).toBeUndefined();
    expect(checkIpsPurchase({}, at, [trade])).toBeUndefined();
  });
  it("binds requirements to the registered lesson and server evidence", async () => {
    expect(() => getMission("constructor")).toThrow();
    await expect(requireMissions(["allocation-training-v1"], "foundations-portfolio", async () => false)).rejects.toThrow("Nejdřív splň misi");
    await expect(requireMissions(["allocation-training-v1"], "foundations-portfolio", async () => true)).resolves.toBeUndefined();
    await expect(requireMissions(["allocation-training-v1"], "foundations-stocks", async () => true)).rejects.toThrow();
    await expect(requireMissions([], "foundations-stocks", async () => false)).resolves.toBeUndefined();
  });
});
