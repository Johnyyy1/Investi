import { describe, expect, it } from "vitest";
import { DEFAULT_FEE_PROFILE } from "./costs";
import { planAllocation, quantityUnitsForAmount, validateAllocation } from "./allocation";
import { fxUnitsFromNumber, grossBaseMinor, parseQuantity, PortfolioInputError, priceUnitsFromNumber } from "./decimal";

const observation = (price: number, fx = 1) => ({ priceUnits: priceUnitsFromNumber(price), fxUnits: fxUnitsFromNumber(fx) });
const observations = new Map([
  ["US-XNAS:AAPL", observation(114, 22.75)],
  ["US-XNAS:MSFT", observation(212, 22.75)],
  ["IE-XETR:VWCE", observation(124, 24.9)],
  ["CZ-XPRA:CZGB35", observation(100.6)],
]);
const line = (instrumentId: string, percent: number) => ({ instrumentId, weightBasisPoints: percent * 100 });

describe("target mix validation", () => {
  it("accepts weights that sum to exactly 100 % including cash", () => {
    expect(validateAllocation({ lines: [line("US-XNAS:AAPL", 60), line("CZ-XPRA:CZGB35", 30)], cashWeightBasisPoints: 1_000 }).lines).toHaveLength(2);
  });

  it.each([
    [{ lines: [line("US-XNAS:AAPL", 60), line("CZ-XPRA:CZGB35", 25)], cashWeightBasisPoints: 0 }, /100 %/],
    [{ lines: [line("US-XNAS:AAPL", 80), line("CZ-XPRA:CZGB35", 30)], cashWeightBasisPoints: 0 }, /100 %/],
    [{ lines: [], cashWeightBasisPoints: 10_000 }, /alespoň jeden/],
    [{ lines: [line("US-XNAS:AAPL", 50), line("US-XNAS:AAPL", 50)], cashWeightBasisPoints: 0 }, /jen jednou/],
    [{ lines: [line("US-XNAS:AAPL", 100), { instrumentId: "US-XNAS:MSFT", weightBasisPoints: 0 }], cashWeightBasisPoints: 0 }, /větší než 0/],
    [{ lines: [{ instrumentId: "US-XNAS:AAPL", weightBasisPoints: 99.5 }], cashWeightBasisPoints: 0.5 }, /hotovosti/],
  ])("rejects an invalid mix %#", (input, message) => {
    expect(() => validateAllocation(input)).toThrow(message);
  });
});

describe("amount to quantity", () => {
  it("floors to 8 dp so the executed value never exceeds the amount", () => {
    for (const [amount, price, fx] of [[400_000n, 114, 22.75], [133_333n, 1.3333, 1], [25n, 0.1, 24.9], [99_999n, 0.25, 23.054321]] as const) {
      const { priceUnits, fxUnits } = observation(price, fx);
      const units = quantityUnitsForAmount(amount, priceUnits, fxUnits);
      expect(grossBaseMinor(units, priceUnits, fxUnits)).toBeLessThanOrEqual(amount);
      expect(grossBaseMinor(units + 1n, priceUnits, fxUnits)).toBeGreaterThanOrEqual(amount - 1n);
    }
  });

  it("returns zero for amounts too small for one minor unit of quantity", () => {
    expect(quantityUnitsForAmount(0n, 1n, 1n)).toBe(0n);
  });
});

describe("mix planning", () => {
  it("budgets commission and FX into every buy while preserving the cash target", () => {
    const plan = planAllocation({ cashMinor: 200_000n, holdings: [],
      observations: new Map([["A", { ...observation(1.3333, 23.054321), quoteCurrency: "USD" }], ["B", { ...observation(0.25), quoteCurrency: "CZK" }]]),
      allocation: { lines: [line("A", 50), line("B", 40)], cashWeightBasisPoints: 1_000 }, feeProfile: DEFAULT_FEE_PROFILE });
    expect(plan.trades).toHaveLength(2);
    expect(plan.trades.every((trade) => trade.feeBaseMinor > 0n)).toBe(true);
    expect(plan.resultingCashMinor).toBeGreaterThanOrEqual(20_000n);
    expect(plan.resultingCashMinor).toBe(200_000n + plan.trades.reduce((sum, trade) => sum + trade.cashDeltaBaseMinor, 0n));
  });

  it("refuses a sale whose minimum commission would overdraw cash", () => {
    expect(() => planAllocation({ cashMinor: 0n, holdings: [{ instrumentId: "A", quantityUnits: parseQuantity("0.1") }],
      observations: new Map([["A", { ...observation(0.25), quoteCurrency: "CZK" }], ["B", { ...observation(1), quoteCurrency: "CZK" }]]),
      allocation: { lines: [line("B", 100)], cashWeightBasisPoints: 0 }, feeProfile: DEFAULT_FEE_PROFILE })).toThrow(/včetně nákladů/);
  });

  it("splits fresh cash by weight and keeps the cash weight and every rounding remainder as cash", () => {
    const plan = planAllocation({
      cashMinor: 700_000n,
      holdings: [],
      observations,
      allocation: { lines: [line("IE-XETR:VWCE", 40), line("US-XNAS:MSFT", 20), line("CZ-XPRA:CZGB35", 30)], cashWeightBasisPoints: 1_000 },
    });
    expect(plan.totalValueMinor).toBe(700_000n);
    expect(plan.trades.map(({ instrumentId, side }) => [instrumentId, side])).toEqual([["IE-XETR:VWCE", "BUY"], ["US-XNAS:MSFT", "BUY"], ["CZ-XPRA:CZGB35", "BUY"]]);
    for (const trade of plan.trades) {
      const target = plan.positions.find(({ instrumentId }) => instrumentId === trade.instrumentId)!.targetValueMinor;
      expect(trade.grossMinor).toBeLessThanOrEqual(target);
      expect(target - trade.grossMinor).toBeLessThan(10n);
    }
    const spent = plan.trades.reduce((sum, trade) => sum + trade.grossMinor, 0n);
    expect(plan.resultingCashMinor).toBe(700_000n - spent);
    expect(plan.resultingCashMinor).toBeGreaterThanOrEqual(70_000n);
    expect(plan.targetCashMinor).toBe(70_000n);
  });

  it("sells first, sells a position that left the mix in full and never spends more than it has", () => {
    const aapl = parseQuantity("2.5");
    const plan = planAllocation({
      cashMinor: 1_000n,
      holdings: [{ instrumentId: "US-XNAS:AAPL", quantityUnits: aapl }],
      observations,
      allocation: { lines: [line("CZ-XPRA:CZGB35", 100)], cashWeightBasisPoints: 0 },
    });
    expect(plan.trades[0]).toMatchObject({ instrumentId: "US-XNAS:AAPL", side: "SELL", quantityUnits: aapl });
    expect(plan.trades[1]).toMatchObject({ instrumentId: "CZ-XPRA:CZGB35", side: "BUY" });
    expect(plan.resultingCashMinor).toBeGreaterThanOrEqual(0n);
    expect(plan.positions.find(({ instrumentId }) => instrumentId === "US-XNAS:AAPL")).toMatchObject({ weightBasisPoints: null, resultingQuantityUnits: 0n });
  });

  it("rebalances drift back to target and leaves sub-1 Kč differences alone", () => {
    const total = 1_000_000n;
    const czgbUnits = quantityUnitsForAmount(600_000n, observation(100.6).priceUnits, observation(100.6).fxUnits);
    const czgbValue = grossBaseMinor(czgbUnits, observation(100.6).priceUnits, observation(100.6).fxUnits);
    const plan = planAllocation({
      cashMinor: total - czgbValue,
      holdings: [{ instrumentId: "CZ-XPRA:CZGB35", quantityUnits: czgbUnits }],
      observations,
      allocation: { lines: [line("CZ-XPRA:CZGB35", 50)], cashWeightBasisPoints: 5_000 },
    });
    expect(plan.trades).toHaveLength(1);
    expect(plan.trades[0].side).toBe("SELL");
    expect(plan.positions[0].resultingValueMinor).toBeLessThanOrEqual(500_000n + 101n);
    const unchanged = planAllocation({
      cashMinor: total - czgbValue,
      holdings: [{ instrumentId: "CZ-XPRA:CZGB35", quantityUnits: czgbUnits }],
      observations,
      allocation: { lines: [line("CZ-XPRA:CZGB35", 60)], cashWeightBasisPoints: 4_000 },
    });
    expect(unchanged.trades).toEqual([]);
  });

  it("caps buys at available cash when rounding leaves less than the targets add up to", () => {
    const plan = planAllocation({
      cashMinor: 301n,
      holdings: [],
      observations: new Map([["A", observation(0.25)], ["B", observation(1.3333)], ["C", observation(0.1)]]),
      allocation: { lines: [line("A", 34), line("B", 33), line("C", 33)], cashWeightBasisPoints: 0 },
      minimumTradeMinor: 1n,
    });
    expect(plan.trades.reduce((sum, trade) => sum + trade.grossMinor, 0n)).toBeLessThanOrEqual(301n);
    expect(plan.resultingCashMinor).toBeGreaterThanOrEqual(0n);
  });

  it("refuses to plan without an observation instead of treating the price as zero", () => {
    expect(() => planAllocation({
      cashMinor: 100_000n,
      holdings: [{ instrumentId: "FMP:NASDAQ:NVDA", quantityUnits: parseQuantity("1") }],
      observations,
      allocation: { lines: [line("US-XNAS:AAPL", 100)], cashWeightBasisPoints: 0 },
    })).toThrow(PortfolioInputError);
  });

  it("refuses an empty portfolio", () => {
    expect(() => planAllocation({ cashMinor: 0n, holdings: [], observations, allocation: { lines: [line("US-XNAS:AAPL", 100)], cashWeightBasisPoints: 0 } })).toThrow(/kapitál/);
  });
});
