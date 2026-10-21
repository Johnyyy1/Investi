import { describe, expect, it } from "vitest";
import { allocationBasisPoints, foldTrades, valuePortfolio, type LedgerTrade } from "./domain";

const buy = (quantity: string, grossAmountBaseMinor: bigint, instrumentId = "US-XNAS:AAPL"): LedgerTrade => ({
  instrumentId, instrumentSymbol: instrumentId.endsWith("AAPL") ? "AAPL" : "VWCE", instrumentName: "Fixture", instrumentAssetType: "equity",
  side: "BUY", quantity, grossAmountBaseMinor, feeBaseMinor: 0n, cashDeltaBaseMinor: -grossAmountBaseMinor,
});
const sell = (quantity: string, grossAmountBaseMinor: bigint, instrumentId = "US-XNAS:AAPL"): LedgerTrade => ({
  ...buy(quantity, grossAmountBaseMinor, instrumentId), side: "SELL", cashDeltaBaseMinor: grossAmountBaseMinor,
});

describe("immutable trade folding", () => {
  it("folds a simple buy and multiple buys into an exact weighted average", () => {
    const result = foldTrades(1_000_000n, [buy("0.25", 250_00n), buy("0.75", 90_000n)]);
    expect(result.cashMinor).toBe(885_000n);
    expect(result.holdings[0]).toMatchObject({ quantityUnits: 100_000_000n, costBasisMinor: 115_000n, averageCostBaseMinor: 115_000n });
  });

  it("allocates cost basis on partial and full sells and records realized gain/loss", () => {
    const partial = foldTrades(500_000n, [buy("1.3333", 133_330n), sell("0.3333", 39_996n)]);
    expect(partial.holdings[0]).toMatchObject({ quantityUnits: 100_000_000n, costBasisMinor: 100_000n, realizedGainLossMinor: 6_666n });
    expect(partial.realizedGainLossMinor).toBe(6_666n);
    const full = foldTrades(500_000n, [buy("0.1", 10_001n), sell("0.1", 10_501n)]);
    expect(full.holdings).toEqual([]);
    expect(full.realizedGainLossMinor).toBe(500n);
  });

  it("rejects an oversold ledger", () => {
    expect(() => foldTrades(0n, [buy("0.1", 100n), sell("0.10000001", 100n)])).toThrow(/oversells/);
  });
});

describe("portfolio accounting", () => {
  it("keeps buy costs in basis, sell costs in realized P&L and later contributions out of returns", () => {
    const bought = { ...buy("0.25", 25_125n), referenceGrossAmountBaseMinor: 25_000n, feeBaseMinor: 1_000n, cashDeltaBaseMinor: -26_125n };
    const sold = { ...sell("0.1", 9_950n), referenceGrossAmountBaseMinor: 10_000n, feeBaseMinor: 1_000n, cashDeltaBaseMinor: 8_950n };
    const folded = foldTrades(200_000n, [bought, sold]);
    expect(folded).toMatchObject({ cashMinor: 182_825n, realizedGainLossMinor: -1_500n });
    expect(folded.holdings[0]).toMatchObject({ costBasisMinor: 15_675n, referenceCostBasisMinor: 15_000n });
    const valuation = [{ instrumentId: bought.instrumentId, marketValueMinor: 15_000n, quoteObservedAt: null }];
    expect(valuePortfolio(200_000n, folded, valuation).investmentGainLossMinor).toBe(-2_175n);
    expect(valuePortfolio(400_000n, foldTrades(400_000n, [bought, sold]), valuation).investmentGainLossMinor).toBe(-2_175n);
  });

  it("treats later rewards as contributions, not performance", () => {
    const trades = [buy("1", 100_000n)];
    const before = foldTrades(1_200_000n, trades);
    const after = foldTrades(1_400_000n, trades);
    const valuation = [{ instrumentId: "US-XNAS:AAPL", marketValueMinor: 105_000n, quoteObservedAt: "2026-01-16T16:00:00.000Z" }];
    expect(valuePortfolio(1_200_000n, before, valuation).investmentGainLossMinor).toBe(5_000n);
    expect(after.cashMinor - before.cashMinor).toBe(200_000n);
    expect(valuePortfolio(1_400_000n, after, valuation).investmentGainLossMinor).toBe(5_000n);
  });

  it("marks missing quotes or FX as incomplete instead of zero", () => {
    const folded = foldTrades(500_000n, [buy("1", 100_000n)]);
    const result = valuePortfolio(500_000n, folded, [{ instrumentId: "US-XNAS:AAPL", marketValueMinor: null, quoteObservedAt: null, unavailableReason: "fx" }]);
    expect(result).toMatchObject({ complete: false, holdingsMarketValueMinor: null, portfolioTotalMinor: null, investmentGainLossMinor: null });
  });

  it("uses invested holdings value as the allocation denominator", () => {
    expect(allocationBasisPoints(25_000n, 100_000n)).toBe(2_500n);
  });
});
