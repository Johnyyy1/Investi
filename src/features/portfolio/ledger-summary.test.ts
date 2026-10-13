import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rows: vi.fn() }));
vi.mock("./repository", () => ({ loadPortfolioRows: mocks.rows }));
import { loadPortfolioLedgerSummary } from "./ledger-summary";

const openedAt = new Date("2026-09-01T08:00:00Z");
const trade = (id: string, symbol: string, side: "BUY" | "SELL", quantity: string, grossAmountBaseMinor: bigint, executedAt: string) => ({
  id, instrumentId: `i-${symbol}`, instrumentSymbol: symbol, instrumentName: symbol, instrumentAssetType: "equity", side, quantity,
  grossAmountBaseMinor, feeBaseMinor: 0n, cashDeltaBaseMinor: side === "BUY" ? -grossAmountBaseMinor : grossAmountBaseMinor, executedAt: new Date(executedAt),
});

describe("portfolio ledger summary", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reports an opened generation without trades as saved state, not as zero value", async () => {
    mocks.rows.mockResolvedValue({ portfolio: { id: "p", openedAt }, earnedPracticeCapitalMinor: 500_000n, trades: [] });
    expect(await loadPortfolioLedgerSummary("u")).toEqual({
      openedAt: openedAt.toISOString(), earnedPracticeCapitalMinor: "500000", availableCashMinor: "500000", holdingsCount: 0, tradeCount: 0, lastTrade: null,
    });
    expect(mocks.rows).toHaveBeenCalledWith("u");
  });

  it("folds fractional buys and a full sell-out from the ordered immutable ledger", async () => {
    mocks.rows.mockResolvedValue({ portfolio: { id: "p", openedAt }, earnedPracticeCapitalMinor: 500_000n, trades: [
      trade("1", "AAPL", "BUY", "0.25000000", 123_457n, "2026-09-02T09:00:00Z"),
      trade("2", "VWCE", "BUY", "1.33330000", 333_333n, "2026-09-03T09:00:00Z"),
      trade("3", "AAPL", "SELL", "0.25000000", 130_001n, "2026-09-04T09:00:00Z"),
    ] });
    const summary = await loadPortfolioLedgerSummary("u");
    expect(summary.availableCashMinor).toBe(String(500_000n - 123_457n - 333_333n + 130_001n));
    expect(summary.holdingsCount).toBe(1);
    expect(summary.tradeCount).toBe(3);
    expect(summary.lastTrade).toEqual({ side: "SELL", symbol: "AAPL", executedAt: "2026-09-04T09:00:00.000Z" });
  });

  it("propagates an unreadable ledger instead of inventing balances", async () => {
    mocks.rows.mockRejectedValue(new Error("database unavailable"));
    await expect(loadPortfolioLedgerSummary("u")).rejects.toThrow("database unavailable");
  });
});
