import { describe, expect, it } from "vitest";
import { calculateMaxDrawdown, calculateVolatility } from "@/features/lab/backtest";
import { FinancialInputError } from "@/features/finance/returns";
import { annualiseVolatility, deviationSteps, drawdownPath, drawdownSample, pathReturns, periodStandardDeviation, volatilityPaths } from "./model";

describe("volatility lesson model", () => {
  it("uses the Lab's sample deviation and its annualisation", () => {
    const returns = [0.012, -0.004, 0.0025, 0.1, -0.0333];
    expect(periodStandardDeviation(returns)).toBe(calculateVolatility(returns, 1));
    expect(annualiseVolatility(periodStandardDeviation(returns), "daily")).toBeCloseTo(calculateVolatility(returns, 252), 14);
    expect(annualiseVolatility(periodStandardDeviation(returns), "monthly")).toBeCloseTo(calculateVolatility(returns, 12), 14);
    expect(() => periodStandardDeviation([0.01])).toThrow(FinancialInputError);
  });

  it("shows every step of the deviation with exact decimals", () => {
    const steps = deviationSteps([0.04, -0.02, 0.03, -0.01]);
    expect(steps.mean).toBeCloseTo(0.01, 15);
    expect(steps.rows.map((row) => row.deviation)).toEqual([0.03, -0.03, 0.02, -0.02].map((value) => expect.closeTo(value, 15)));
    expect(steps.sumOfSquares).toBeCloseTo(0.0026, 15);
    expect(steps.variance).toBeCloseTo(0.0026 / 3, 15);
    expect(steps.deviation).toBeCloseTo(Math.sqrt(0.0026 / 3), 15);
    expect(steps.populationDeviation).toBeLessThan(steps.deviation);
    expect(deviationSteps([0.01, 0.01, 0.01, 0.01]).deviation).toBe(0);
  });

  it("tracks the running peak, the worst drawdown and the recovery", () => {
    const path = drawdownPath(drawdownSample.values);
    expect(path.steps.map((step) => step.peak)).toEqual([100, 108, 115, 115, 115, 115, 115, 115, 115, 115, 118, 121]);
    expect(path.maxDrawdown).toEqual({ depth: expect.closeTo(86 / 115 - 1, 15), peakIndex: 2, troughIndex: 6, recoveryIndex: 10 });
    expect(-path.maxDrawdown!.depth).toBeCloseTo(calculateMaxDrawdown(drawdownSample.values), 15);
    expect(drawdownPath([100, 101, 102]).maxDrawdown).toBeNull();
    expect(drawdownPath([100, 120, 90]).maxDrawdown?.recoveryIndex).toBeNull();
    expect(() => drawdownPath([0, 10])).toThrow(FinancialInputError);
  });

  it("keeps the two sample funds at the same start and end", () => {
    expect(volatilityPaths.calm.values.at(-1)).toBe(volatilityPaths.swing.values.at(-1));
    expect(Math.max(...pathReturns(volatilityPaths.swing.values))).toBeCloseTo(120 / 95 - 1, 15);
    expect(Math.min(...pathReturns(volatilityPaths.swing.values))).toBeCloseTo(95 / 115 - 1, 15);
    expect(periodStandardDeviation(pathReturns(volatilityPaths.swing.values))).toBeGreaterThan(10 * periodStandardDeviation(pathReturns(volatilityPaths.calm.values)));
  });
});
