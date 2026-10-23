import { describe, expect, it } from "vitest";
import { presentTaxView, pragueYear, taxLots, taxRecordCsv, yearSaleProceedsMinor, type TaxLotTrade } from "./tax-lots";

let sequence = 0;
function trade(side: "BUY" | "SELL", quantity: string, grossAmountBaseMinor: bigint, executedAt: string, feeBaseMinor = 0n, instrumentId = "etf"): TaxLotTrade {
  return { id: `t${++sequence}`, instrumentId, instrumentSymbol: instrumentId.toUpperCase(), side, quantity, grossAmountBaseMinor, feeBaseMinor, executedAt: new Date(executedAt) };
}

describe("taxLots (FIFO assumption)", () => {
  it("matches sells to the oldest lots across several sales and keeps remaining lots", () => {
    const buyA = trade("BUY", "2", 20_000n, "2024-01-10T10:00:00Z", 1_000n);
    const buyB = trade("BUY", "3", 45_000n, "2025-03-01T10:00:00Z", 1_000n);
    const sell1 = trade("SELL", "1", 13_000n, "2026-02-01T10:00:00Z", 500n);
    const sell2 = trade("SELL", "2", 30_000n, "2026-05-01T10:00:00Z", 500n);
    const { lots, sales } = taxLots([buyA, buyB, sell1, sell2]);

    expect(sales[0].matches).toEqual([{ lotTradeId: buyA.id, acquiredAt: buyA.executedAt, quantityUnits: 100_000_000n, costMinor: 10_500n }]);
    expect(sales[1].matches.map(({ lotTradeId, quantityUnits, costMinor }) => [lotTradeId, quantityUnits, costMinor])).toEqual([
      [buyA.id, 100_000_000n, 10_500n],
      [buyB.id, 100_000_000n, 15_333n],
    ]);
    expect(sales[1].proceedsMinor).toBe(30_000n);
    expect(sales[1].feeMinor).toBe(500n);
    expect(lots).toEqual([{ tradeId: buyB.id, instrumentId: "etf", symbol: "ETF", acquiredAt: buyB.executedAt, remainingUnits: 200_000_000n, remainingCostMinor: 30_667n }]);
  });

  it("allocates fractional partial sales exactly, with no rounding leak once a lot is consumed", () => {
    const buy = trade("BUY", "1.3333", 10_001n, "2025-01-02T09:00:00Z", 3n);
    const sells = [trade("SELL", "0.1", 900n, "2025-06-01T09:00:00Z"), trade("SELL", "0.25", 2_100n, "2025-07-01T09:00:00Z"), trade("SELL", "0.9833", 9_000n, "2025-08-01T09:00:00Z")];
    const { lots, sales } = taxLots([buy, ...sells]);
    const allocated = sales.flatMap(({ matches }) => matches).reduce((sum, { costMinor }) => sum + costMinor, 0n);
    expect(sales.map(({ matches }) => matches[0].costMinor)).toEqual([750n, 1_876n, 7_378n]);
    expect(allocated).toBe(10_004n);
    expect(lots).toEqual([]);
  });

  it("keeps instruments in separate queues and refuses an oversell", () => {
    const { sales } = taxLots([
      trade("BUY", "1", 1_000n, "2025-01-01T09:00:00Z", 0n, "a"),
      trade("BUY", "1", 2_000n, "2025-01-02T09:00:00Z", 0n, "b"),
      trade("SELL", "1", 2_500n, "2025-02-01T09:00:00Z", 0n, "b"),
    ]);
    expect(sales[0].matches[0].costMinor).toBe(2_000n);
    expect(() => taxLots([trade("BUY", "1", 1_000n, "2025-01-01T09:00:00Z"), trade("SELL", "1.00000001", 1_000n, "2025-02-01T09:00:00Z")])).toThrow(/oversells/);
  });
});

describe("yearSaleProceedsMinor", () => {
  it("sums gross proceeds (not gain) per Prague calendar year across several sales", () => {
    const { sales } = taxLots([
      trade("BUY", "10", 100_000n, "2025-01-01T09:00:00Z"),
      trade("SELL", "1", 12_345n, "2025-06-01T09:00:00Z", 1_000n),
      // 23:30 UTC on 31 Dec is already New Year in Prague.
      trade("SELL", "1", 11_000n, "2025-12-31T23:30:00Z"),
      trade("SELL", "1", 9_000n, "2026-03-01T09:00:00Z"),
    ]);
    expect(pragueYear(new Date("2025-12-31T23:30:00Z"))).toBe(2026);
    expect(yearSaleProceedsMinor(sales, 2025)).toBe(12_345n);
    expect(yearSaleProceedsMinor(sales, 2026)).toBe(20_000n);
    expect(yearSaleProceedsMinor(sales, 2024)).toBe(0n);
  });
});

describe("presentTaxView", () => {
  const trades = [trade("BUY", "2", 50_000n, "2026-01-05T09:00:00Z", 1_000n), trade("SELL", "1", 30_000n, "2026-06-01T09:00:00Z", 500n)];

  it("compares this year's proceeds with the verified limit and keeps the remaining tranche", () => {
    const view = presentTaxView(trades, new Date("2026-10-23T10:00:00Z"));
    expect(view).toMatchObject({ year: 2026, proceedsMinor: "30000", saleCount: 1, limitMinor: "10000000", limitVerifiedAt: "2026-10-22" });
    expect(view.lots).toEqual([{ tradeId: trades[0].id, symbol: "ETF", acquiredAt: "2026-01-05T09:00:00.000Z", quantity: "1", costMinor: "25500" }]);
  });

  it("shows no limit for a year without a verified fact version instead of reusing another year's rule", () => {
    expect(presentTaxView(trades, new Date("2027-02-01T10:00:00Z"))).toMatchObject({ year: 2027, proceedsMinor: "0", limitMinor: null, limitVerifiedAt: null });
  });
});

describe("taxRecordCsv", () => {
  it("writes every record field, FIFO lots on sales, decimal commas and no formula injection", () => {
    const base = { unitPrice: "100.50000000", quoteCurrency: "USD", fxRateToBase: "23.456789012345", referenceFxRateToBase: "23.340000000000", fxRateProvider: "frankfurter", fxReferenceDate: "2026-01-02", fxRateIsDeterministic: false, marketDataIsDeterministic: false, feeProfileId: "investi-standard-v1" };
    const buy = { ...trade("BUY", "1.25000000", 294_000n, "2026-01-05T09:00:00Z", 1_000n), ...base, instrumentName: "=HYPERLINK(\"x\")", fxMarkupBaseMinor: 1_470n, cashDeltaBaseMinor: -295_000n };
    const sell = { ...trade("SELL", "0.25000000", 60_000n, "2026-06-01T09:00:00Z", 1_000n), ...base, instrumentName: "=HYPERLINK(\"x\")", fxMarkupBaseMinor: 300n, cashDeltaBaseMinor: 59_000n };
    const [preamble, header, buyRow, sellRow] = taxRecordCsv([buy, sell], new Date("2026-10-23T10:00:00Z")).replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(preamble).toContain("stav k 2026-10-23");
    expect(preamble).toContain("FIFO je předpoklad");
    expect(header.split(";")).toHaveLength(19);
    expect(buyRow.split(";")).toEqual(expect.arrayContaining(["2026-01-05 10:00", "Nákup", "1,25", "100,5", "USD", "23,456789012345", "23,34", "frankfurter", "2026-01-02", "10,00", "14,70", "2940,00", "-2950,00", `nová tranše ${buy.id}`, "tržní data"]));
    expect(buyRow).toContain(`"'=HYPERLINK(""x"")"`);
    expect(sellRow).toContain(`${buy.id} (2026-01-05) × 0,25`);
    expect(sellRow).toContain(";Prodej;0,25;");
  });
});
