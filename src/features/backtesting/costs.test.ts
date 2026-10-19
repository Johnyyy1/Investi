import { describe, expect, it } from "vitest";
import { FinancialInputError } from "@/features/finance/returns";
import { calculateBacktestMetrics } from "@/features/lab/backtest";
import { costImpact, noTrading, parseCostRate, parseFixedFee, tradeToTargets } from "./costs";

describe("trading to target weights", () => {
  it("buys at the start and pays a share of the traded value out of the amount", () => {
    const summary = noTrading();
    // 1 % of what is bought: 100 = bought + 0.01 × bought, so 100 ÷ 1.01 is invested.
    const book = tradeToTargets({ sleeves: [0], cash: 100 }, [10_000], 0, { rateBps: 100, fixedFee: 0 }, summary);
    expect(book.sleeves[0]).toBeCloseTo(100 / 1.01, 12);
    expect(book.cash).toBe(0);
    expect(summary).toEqual({ trades: 1, turnover: book.sleeves[0], costs: 100 - book.sleeves[0] });
    expect(summary.costs).toBeCloseTo(0.01 * summary.turnover, 12);
  });
  it("leaves the book exactly at the target weights of what is left after costs", () => {
    const summary = noTrading();
    const book = tradeToTargets({ sleeves: [70, 10], cash: 20 }, [4_000, 4_000], 2_000, { rateBps: 25, fixedFee: 0.5 }, summary);
    const value = book.sleeves[0] + book.sleeves[1] + book.cash;
    expect(book.sleeves[0] / value).toBeCloseTo(0.4, 12);
    expect(book.sleeves[1] / value).toBeCloseTo(0.4, 12);
    expect(book.cash / value).toBeCloseTo(0.2, 12);
    // Money is conserved: what left the book is exactly the rate on the traded value plus one fee per trade.
    expect(summary.trades).toBe(2);
    expect(100 - value).toBeCloseTo(summary.costs, 12);
    expect(summary.costs).toBeCloseTo(0.0025 * summary.turnover + 2 * 0.5, 12);
  });
  it("sells everything for cash at a cost of the rate plus the flat fee", () => {
    const summary = noTrading();
    const book = tradeToTargets({ sleeves: [200], cash: 0 }, [0], 10_000, { rateBps: 10, fixedFee: 1 }, summary);
    expect(book.sleeves).toEqual([0]);
    expect(book.cash).toBeCloseTo(200 - 0.2 - 1, 12);
    expect(summary).toMatchObject({ trades: 1, turnover: 200 });
  });
  it("trades nothing and pays nothing when the book already sits at its targets", () => {
    const summary = noTrading();
    const book = tradeToTargets({ sleeves: [60], cash: 40 }, [6_000], 4_000, { rateBps: 200, fixedFee: 1_000 }, summary);
    expect(book).toEqual({ sleeves: [60], cash: 40 });
    expect(summary).toEqual({ trades: 0, turnover: 0, costs: 0 });
  });
  it("with zero costs rebalances exactly as without a cost model", () => {
    const summary = noTrading();
    const value = 0.1 + 0.2 + 1.3333;
    const book = tradeToTargets({ sleeves: [0.1, 0.2], cash: 1.3333 }, [6_000, 3_000], 1_000, { rateBps: 0, fixedFee: 0 }, summary);
    expect(book).toEqual({ sleeves: [value * 0.6, value * 0.3], cash: value * 0.1 });
    expect(summary.costs).toBe(0);
    expect(summary.trades).toBe(2);
  });
  it("refuses costs that would use up the whole portfolio, rather than going negative", () => {
    expect(() => tradeToTargets({ sleeves: [0], cash: 5 }, [10_000], 0, { rateBps: 0, fixedFee: 5 }, noTrading())).toThrow(FinancialInputError);
  });
});

describe("cost inputs", () => {
  it.each([["0", 0], ["0,1", 10], ["0.1", 10], ["0,25", 25], ["0.25", 25], [" 1 ", 100], ["0,05", 5], ["2", 200], ["2,00", 200]])("reads %s %% as %i basis points", (value, bps) => {
    expect(parseCostRate(value)).toBe(bps);
  });
  it.each(["", "abc", "-0,1", "0,125", "1e-3", "2,01", "3", "0,1 %"])("refuses the rate %j", (value) => {
    expect(() => parseCostRate(value)).toThrow(FinancialInputError);
  });
  it.each([["0", 0], ["1,50", 1.5], ["4.95", 4.95], ["1000", 1_000]])("reads the flat fee %s as %d", (value, fee) => {
    expect(parseFixedFee(value)).toBe(fee);
  });
  it.each(["", "-1", "1,505", "1000,01", "abc"])("refuses the flat fee %j", (value) => {
    expect(() => parseFixedFee(value)).toThrow(FinancialInputError);
  });
});

describe("cost impact", () => {
  it("is the difference with costs minus without, for money, returns and the Sharpe ratio", () => {
    const returns = Array.from({ length: 12 }, (_, index) => index % 2 ? -0.01 : 0.02);
    const without = calculateBacktestMetrics(100, returns);
    const withCosts = calculateBacktestMetrics(99.9, returns);
    const impact = costImpact(withCosts, without);
    expect(impact.finalValue).toBeCloseTo(-0.001 * without.finalValue, 12);
    expect(impact.totalReturn).toBeCloseTo(withCosts.totalReturn - without.totalReturn, 15);
    expect(impact.cagr).toBeCloseTo(0, 15);
    expect(impact.sharpeRatio).toBe(0);
  });
  it("has no Sharpe impact when either ratio is undefined", () => {
    const flat = calculateBacktestMetrics(100, Array(12).fill(0));
    expect(costImpact(flat, flat).sharpeRatio).toBeNull();
  });
});
