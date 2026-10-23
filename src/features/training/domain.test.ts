import { describe, expect, it } from "vitest";
import { exampleIps } from "@/features/ips/test-fixtures";
import { BROKER_FEE_PROFILES, DEFAULT_FEE_PROFILE } from "@/features/portfolio/costs";
import { decimalToPriceUnits, parseQuantity } from "@/features/portfolio/decimal";
import { evaluateTraining, maxBuyAmountMinor, replayTraining, TrainingActionError, trainingPlanFromIps, type TrainingAction, type TrainingSetup } from "./domain";
import { modelSeries, trainingScenarios } from "./scenarios";

const series = modelSeries();
const setup = (overrides: Partial<TrainingSetup["plan"]> = {}): TrainingSetup => ({
  dates: series.points.map(({ date }) => date), prices: series.points.map(({ price }) => decimalToPriceUnits(price)),
  initialCapitalMinor: 10_000_000n, feeProfile: DEFAULT_FEE_PROFILE, plan: { ...trainingPlanFromIps(exampleIps, 2), ...overrides },
});
const advance: TrainingAction = { kind: "advance" };
const advances = (count: number) => Array.from({ length: count }, () => advance);

describe("training scenarios", () => {
  it("models a 30 % fall within six months, then a recovery, on exact month-end dates", () => {
    expect(series.points).toHaveLength(25);
    expect(series.points[6].price).toBe("70");
    expect(series.points.slice(0, 3).map(({ date }) => date)).toEqual(["2000-01-31", "2000-02-29", "2000-03-31"]);
    expect(new Set(trainingScenarios.map(({ id }) => id)).size).toBe(trainingScenarios.length);
  });
});

describe("replayTraining", () => {
  it("snapshots only the structured IPS rules", () => {
    expect(trainingPlanFromIps(exampleIps, 2)).toEqual({ ipsVersion: 2, contributionMinor: "250025", targetInvestedBps: 8000, rebalancing: { mode: "band", bandBps: 500 }, drawdownAction: "keep_plan" });
  });

  it("adds the IPS contribution every simulated month as cash, never as return", () => {
    const state = replayTraining(setup(), advances(3));
    expect(state.month).toBe(3);
    expect(state.cashMinor).toBe(10_000_000n + 3n * 250_025n);
    expect(state.contributedMinor).toBe(state.cashMinor);
    expect(state.contributions.map(({ month, valueBeforeMinor }) => [month, valueBeforeMinor])).toEqual([[1, 10_000_000n], [2, 10_250_025n], [3, 10_500_050n]]);
    const result = evaluateTraining(setup(), state);
    expect(result.gainMinor).toBe(0n);
    expect(result.twr).toMatchObject({ status: "available", basisPoints: "0" });
  });

  it("is deterministic: the same actions give the same state and evaluation", () => {
    const actions: TrainingAction[] = [{ kind: "buy", amountMinor: 8_000_000n }, ...advances(6), { kind: "sell", quantityUnits: parseQuantity("10.5") }, ...advances(18)];
    const first = replayTraining(setup(), actions), second = replayTraining(setup(), actions.map((action) => ({ ...action })));
    expect(second).toEqual(first);
    expect(evaluateTraining(setup(), second)).toEqual(evaluateTraining(setup(), first));
    expect(first.finished).toBe(true);
  });

  it("buys whole 8 dp units for at most the chosen amount and charges the profile fee on top", () => {
    const state = replayTraining(setup(), [{ kind: "buy", amountMinor: 13_333n }]);
    const [trade] = state.trades;
    // 133,33 Kč at an index of 100 Kč is 1.3333 units; the minimum fee is 10 Kč.
    expect(trade).toMatchObject({ quantityUnits: 133_330_000n, grossMinor: 13_333n, feeMinor: 1_000n });
    expect(state.cashMinor).toBe(10_000_000n - 13_333n - 1_000n);
    expect(state.valueMinor).toBe(state.cashMinor + 13_333n);
  });

  it("finds the largest amount whose gross plus fee fits in cash", () => {
    for (const feeProfile of BROKER_FEE_PROFILES) {
      const base = { ...setup(), feeProfile };
      const max = maxBuyAmountMinor(base, { month: 0, cashMinor: 10_000_000n });
      expect(replayTraining(base, [{ kind: "buy", amountMinor: max }]).cashMinor).toBeGreaterThanOrEqual(0n);
      expect(() => replayTraining(base, [{ kind: "buy", amountMinor: max + 1n }])).toThrow(TrainingActionError);
    }
    expect(maxBuyAmountMinor(setup(), { month: 0, cashMinor: 1_000n })).toBe(0n);
  });

  it("refuses overspending, overselling, empty orders and actions after the end", () => {
    expect(() => replayTraining(setup(), [{ kind: "buy", amountMinor: 10_000_000n }])).toThrow(expect.objectContaining({ code: "InsufficientCash" }));
    expect(() => replayTraining(setup(), [{ kind: "sell", quantityUnits: 1n }])).toThrow(expect.objectContaining({ code: "Oversell" }));
    expect(() => replayTraining(setup(), [{ kind: "buy", amountMinor: 0n }])).toThrow(expect.objectContaining({ code: "InvalidAmount" }));
    expect(() => replayTraining(setup(), [{ kind: "buy", amountMinor: 100_000n }, { kind: "sell", quantityUnits: 1n }])).toThrow(expect.objectContaining({ code: "InvalidAmount" }));
    expect(() => replayTraining(setup(), advances(25))).toThrow(expect.objectContaining({ code: "Finished" }));
  });
});

describe("evaluateTraining", () => {
  const panicSell = (plan: Partial<TrainingSetup["plan"]> = {}) => {
    const base = setup(plan);
    const bought = replayTraining(base, [{ kind: "buy", amountMinor: 8_000_000n }, ...advances(6)]);
    return { base, state: replayTraining(base, [{ kind: "buy", amountMinor: 8_000_000n }, ...advances(6), { kind: "sell", quantityUnits: bought.quantityUnits }, ...advances(18)]) };
  };

  it("marks a sale in the trough as outside a band plan, and reports costs, turnover and both returns", () => {
    const { base, state } = panicSell();
    const result = evaluateTraining(base, state);
    expect(state.trades.map(({ planStatus }) => planStatus)).toEqual([null, "outside-plan"]);
    expect(result.sellsOutsidePlan).toBe(1);
    expect(result.feesMinor).toBe(8_000n + state.trades[1].feeMinor);
    expect(result.indexMaxDrawdownBps).toBe(3000n);
    expect(result.allocation).toEqual({ investedBps: 0n, targetInvestedBps: 8000, status: "outside-plan" });
    expect(result.twr.status).toBe("available");
    expect(result.mwr.status).toBe("available");
    expect(result.gainMinor).toBe(result.endingMinor - result.contributedMinor);
  });

  it("allows a sale only when the rule permits it", () => {
    // Fully invested against an 80 % target: above a 5-point band, so selling back to target is within the plan.
    const base = setup();
    const all = maxBuyAmountMinor(base, { month: 0, cashMinor: 10_000_000n });
    const state = replayTraining(base, [{ kind: "buy", amountMinor: all }, { kind: "sell", quantityUnits: parseQuantity("1") }]);
    expect(state.trades[1].planStatus).toBe("within-plan");
    // The same sale in a contributions-only plan is outside it; a calendar plan allows it only in its month.
    expect(replayTraining(setup({ rebalancing: { mode: "contributions" } }), [{ kind: "buy", amountMinor: all }, { kind: "sell", quantityUnits: parseQuantity("1") }]).trades[1].planStatus).toBe("outside-plan");
    expect(replayTraining(setup({ rebalancing: { mode: "calendar", month: 1 } }), [{ kind: "buy", amountMinor: all }, { kind: "sell", quantityUnits: parseQuantity("1") }]).trades[1].planStatus).toBe("within-plan");
    expect(replayTraining(setup({ rebalancing: { mode: "calendar", month: 2 } }), [{ kind: "buy", amountMinor: all }, { kind: "sell", quantityUnits: parseQuantity("1") }]).trades[1].planStatus).toBe("outside-plan");
  });

  it("keeps an unused contribution plan valid: with no contributions MWR equals the single-period return", () => {
    const base = setup({ contributionMinor: "0" });
    const state = replayTraining(base, [{ kind: "buy", amountMinor: 5_000_000n }, ...advances(24)]);
    const result = evaluateTraining(base, state);
    expect(state.contributions).toEqual([]);
    expect(result.twr.status === "available" && result.mwr.status === "available" && result.twr.basisPoints === result.mwr.basisPoints).toBe(true);
  });
});
