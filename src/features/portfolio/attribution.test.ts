import { describe, expect, it } from "vitest";
import { attributeHolding, foldQuoteCost, impliedPurchaseFxUnits } from "./attribution";
import { foldTrades, valuePortfolio, type LedgerTrade } from "./domain";
import { fxToDecimal, fxUnitsFromNumber, grossBaseMinor, parseQuantity, priceUnitsFromNumber } from "./decimal";

function trade(side: "BUY" | "SELL", quantity: string, price: number, fx: number, instrumentId = "US-XNAS:AAPL"): LedgerTrade & { unitPrice: string } {
  const gross = grossBaseMinor(parseQuantity(quantity), priceUnitsFromNumber(price), fxUnitsFromNumber(fx));
  return {
    instrumentId, instrumentSymbol: "AAPL", instrumentName: "Apple", instrumentAssetType: "equity", side, quantity,
    unitPrice: price.toFixed(8), grossAmountBaseMinor: gross, feeBaseMinor: 0n, cashDeltaBaseMinor: side === "BUY" ? -gross : gross,
  };
}

function attribute(trades: ReturnType<typeof trade>[], price: number, fx: number, contributed = 1_000_000n, currency = "USD") {
  const folded = foldTrades(contributed, trades);
  const quoteCost = foldQuoteCost(trades);
  const holdings = folded.holdings.map((holding) => {
    const priceUnits = priceUnitsFromNumber(price);
    const marketValueMinor = grossBaseMinor(holding.quantityUnits, priceUnits, fxUnitsFromNumber(fx));
    return { ...holding, marketValueMinor, ...attributeHolding({
      quoteCurrency: currency, quantityUnits: holding.quantityUnits, costBasisMinor: holding.costBasisMinor,
      costQuoteUnits: quoteCost.get(holding.instrumentId)!.costQuoteUnits, marketValueMinor, priceUnits,
    }, "CZK") };
  });
  const valued = valuePortfolio(contributed, folded, holdings.map((holding) => ({ instrumentId: holding.instrumentId, marketValueMinor: holding.marketValueMinor, quoteObservedAt: null })));
  return { folded, holdings, gain: valued.investmentGainLossMinor! };
}

describe("price and FX attribution", () => {
  it("separates a price rise from a weaker dollar and sums exactly to the gain", () => {
    const { holdings, gain } = attribute([trade("BUY", "1.3333", 100, 23.4)], 104, 23.1);
    const [holding] = holdings;
    expect(holding.priceEffectMinor).toBeGreaterThan(0n);
    expect(holding.fxEffectMinor).toBeLessThan(0n);
    expect(holding.priceEffectMinor + holding.fxEffectMinor).toBe(gain);
    // 1.3333 × 4 USD × 23.40 = 124.80 Kč from price; 1.3333 × 104 × −0.30 = −41.60 Kč from FX.
    expect(holding.priceEffectMinor).toBe(12_480n);
    expect(holding.fxEffectMinor).toBe(-4_160n);
  });

  it("keeps base-currency holdings free of FX effect", () => {
    const { holdings, gain } = attribute([trade("BUY", "0.25", 100.6, 1, "CZ-XPRA:CZGB35")], 101, 1, 1_000_000n, "CZK");
    expect(holdings[0].fxEffectMinor).toBe(0n);
    expect(holdings[0].priceEffectMinor).toBe(gain);
  });

  it("follows weighted-average cost through buys at different rates and a partial sell", () => {
    const trades = [trade("BUY", "0.1", 114, 22.75), trade("BUY", "0.25", 120, 23.054321), trade("SELL", "0.15", 118, 23)];
    const { folded, holdings, gain } = attribute(trades, 121, 22.9);
    const [holding] = holdings;
    expect(holding.quantityUnits).toBe(parseQuantity("0.2"));
    expect(folded.realizedGainLossMinor + holding.priceEffectMinor + holding.fxEffectMinor).toBe(gain);
    const quoteCost = foldQuoteCost(trades).get("US-XNAS:AAPL")!;
    const implied = impliedPurchaseFxUnits(holding.costBasisMinor, quoteCost.costQuoteUnits)!;
    expect(Number(fxToDecimal(implied))).toBeGreaterThan(22.75);
    expect(Number(fxToDecimal(implied))).toBeLessThan(23.054321);
  });

  it("treats a later reward as contribution: the attribution and gain do not move", () => {
    const before = attribute([trade("BUY", "1", 100, 23.4)], 102, 23.2, 1_000_000n);
    const after = attribute([trade("BUY", "1", 100, 23.4)], 102, 23.2, 1_200_000n);
    expect(after.gain).toBe(before.gain);
    expect(after.holdings[0]).toMatchObject({ priceEffectMinor: before.holdings[0].priceEffectMinor, fxEffectMinor: before.holdings[0].fxEffectMinor });
  });

  it("rejects an oversold ledger like the base fold", () => {
    expect(() => foldQuoteCost([trade("BUY", "0.1", 1, 1), trade("SELL", "0.2", 1, 1)])).toThrow(/oversells/);
  });
});
