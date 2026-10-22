import { describe, expect, it } from "vitest";
import { exampleIps } from "@/features/ips/test-fixtures";
import { portfolioProcess, type ProcessInput } from "./process";

const input: ProcessInput = {
  openedAt: "2026-01-01T00:00:00.000Z", asOf: "2026-10-22T12:00:00.000Z",
  cashMinor: 20000n, totalMinor: 100000n,
  holdings: [{ instrumentId: "IE-XETR:VWCE", symbol: "VWCE", marketValueMinor: 80000n }],
  trades: [], ips: { version: 3, payload: exampleIps },
};

describe("read-only portfolio process feedback", () => {
  it("reports position concentration without inventing an ETF look-through or universal limit", () => {
    const result = portfolioProcess(input);
    expect(result.hhi).toMatchObject({ value: "10000", threshold: null, status: "information" });
    expect(result.largestPosition).toMatchObject({ value: "8000", symbol: "VWCE", threshold: null, status: "information" });
    expect(result.allocation).toMatchObject({ value: "0", threshold: "500", status: "within-plan" });
    expect(result.cash).toMatchObject({ value: "0", currentBasisPoints: "2000", targetBasisPoints: "2000", status: "within-plan" });
  });

  it("computes HHI from exact values before rounding and is independent of cash and rewards", () => {
    const holdings = [{ instrumentId: "a", symbol: "A", marketValueMinor: 10001n }, { instrumentId: "b", symbol: "B", marketValueMinor: 20002n }];
    const before = portfolioProcess({ ...input, holdings, cashMinor: 0n, totalMinor: 30003n });
    const after = portfolioProcess({ ...input, holdings, cashMinor: 200000n, totalMinor: 230003n });
    expect(before.hhi.value).toBe("5556");
    expect(after.hhi).toEqual(before.hhi);
    expect(after.costs).toEqual(before.costs);
  });

  it("counts only this generation's trailing 365 days, including both boundaries, without annualizing", () => {
    const trades = [
      { side: "BUY" as const, executedAt: new Date("2025-10-22T11:59:59.999Z"), grossAmountBaseMinor: 99999n, feeBaseMinor: 999n },
      { side: "BUY" as const, executedAt: new Date("2025-10-22T12:00:00.000Z"), grossAmountBaseMinor: 10000n, feeBaseMinor: 25n, fxMarkupBaseMinor: 11n },
      { side: "SELL" as const, executedAt: new Date(input.asOf), grossAmountBaseMinor: 3333n, feeBaseMinor: 10n, fxMarkupBaseMinor: 7n },
      { side: "SELL" as const, executedAt: new Date("2026-10-22T12:00:00.001Z"), grossAmountBaseMinor: 99999n, feeBaseMinor: 999n },
    ];
    const result = portfolioProcess({ ...input, openedAt: "2025-01-01T00:00:00.000Z", trades });
    expect(result.period.startedAt).toBe("2025-10-22T12:00:00.000Z");
    expect(result.costs).toMatchObject({ value: "53", feesMinor: "35", fxMarkupMinor: "18", status: "information", threshold: null });
    expect(result.turnover).toMatchObject({ value: "1333", grossMinor: "13333", tradeCount: 2, threshold: null });
    const young = portfolioProcess({ ...input, openedAt: "2026-10-22T11:00:00.000Z", trades });
    expect(young.period.startedAt).toBe("2026-10-22T11:00:00.000Z");
    expect(young.costs.value).toBe("17");
  });

  it("keeps ledger costs available when a quote or FX is missing; never treats missing metrics as zero", () => {
    const result = portfolioProcess({ ...input, totalMinor: null, holdings: [{ ...input.holdings[0], marketValueMinor: null }],
      trades: [{ side: "BUY", executedAt: new Date(input.asOf), grossAmountBaseMinor: 12345n, feeBaseMinor: 25n, fxMarkupBaseMinor: 7n }] });
    expect(result.costs.value).toBe("32");
    expect(result.turnover.grossMinor).toBe("12345");
    for (const metric of [result.hhi, result.largestPosition, result.turnover, result.allocation, result.cash]) {
      expect(metric).toMatchObject({ value: null, status: "unavailable", reason: "missing-valuation" });
    }
  });

  it("makes cash-only, zero-capital, missing and legacy IPS states explicit without failure grades", () => {
    const cashOnly = portfolioProcess({ ...input, cashMinor: 100000n, holdings: [], ips: null });
    expect(cashOnly.hhi).toMatchObject({ value: null, status: "unavailable", reason: "no-holdings" });
    expect(cashOnly.allocation.reason).toBe("no-ips");
    expect(cashOnly.cash).toMatchObject({ value: null, currentBasisPoints: "10000", status: "unavailable", reason: "no-ips" });
    expect(portfolioProcess({ ...input, totalMinor: 0n, cashMinor: 0n, holdings: [] }).cash.reason).toBe("no-capital");
    expect(portfolioProcess({ ...input, ips: { version: 1, payload: {} } }).allocation.reason).toBe("legacy-ips");
  });

  it("checks the learner's exact band inclusively before display rounding, and includes unheld targets and unplanned holdings", () => {
    const atBand = portfolioProcess({ ...input, cashMinor: 25000n, holdings: [{ ...input.holdings[0], marketValueMinor: 75000n }] });
    expect(atBand.allocation).toMatchObject({ value: "500", status: "within-plan" });
    expect(atBand.cash).toMatchObject({ value: "500", status: "within-plan" });
    const justOutside = portfolioProcess({ ...input, cashMinor: 25001n, holdings: [{ ...input.holdings[0], marketValueMinor: 74999n }] });
    expect(justOutside.allocation).toMatchObject({ value: "500", status: "outside-plan" });
    expect(justOutside.cash.status).toBe("outside-plan");
    const unplanned = portfolioProcess({ ...input, holdings: [{ instrumentId: "a", symbol: "A", marketValueMinor: 80000n }] });
    expect(unplanned.allocation.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "IE-XETR:VWCE", currentBasisPoints: "0", targetBasisPoints: "8000", deviationBasisPoints: "-8000" }),
      expect.objectContaining({ key: "a", currentBasisPoints: "8000", targetBasisPoints: "0", deviationBasisPoints: "8000" }),
    ]));
  });

  it("does not grade calendar or contribution plans against a made-up band; excess cash is not a return loss", () => {
    for (const rebalancing of [{ mode: "calendar" as const, month: 10 }, { mode: "contributions" as const }]) {
      const result = portfolioProcess({ ...input, cashMinor: 30000n, holdings: [{ ...input.holdings[0], marketValueMinor: 70000n }],
        ips: { version: 4, payload: { ...exampleIps, rebalancing } } });
      expect(result.allocation).toMatchObject({ status: "information", threshold: null, value: "1000" });
      expect(result.cash).toMatchObject({ status: "information", value: "1000", threshold: null });
    }
    expect(portfolioProcess({ ...input, cashMinor: 15000n, holdings: [{ ...input.holdings[0], marketValueMinor: 85000n }] }).cash.value).toBe("0");
  });

  it("requires explicit instruments for allocation comparison and never guesses an ETF's asset class", () => {
    const result = portfolioProcess({ ...input, ips: { version: 4, payload: { ...exampleIps, allocation: { lines: [{ assetClass: "equity", weightBps: 8000 }], cashBps: 2000 } } } });
    expect(result.allocation).toMatchObject({ status: "unavailable", reason: "asset-class-target" });
    expect(result.cash).toMatchObject({ status: "within-plan", value: "0" });
  });
});
