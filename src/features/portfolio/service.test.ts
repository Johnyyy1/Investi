import { beforeEach, describe, expect, it, vi } from "vitest";
import { adjustmentPolicies } from "@/features/market-data/contracts";

const mocks = vi.hoisted(() => ({ rows: vi.fn(), observe: vi.fn(), history: vi.fn(), fx: vi.fn(), plans: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/artifacts/repository", () => ({ listLearnerArtifacts: mocks.plans }));
vi.mock("./repository", () => ({
  getOrCreateActivePortfolio: vi.fn().mockResolvedValue({ id: "p" }), loadLedgerRows: mocks.rows,
  loadLatestAllocation: vi.fn().mockResolvedValue(null), readBrokerFeeProfile: vi.fn().mockResolvedValue({ id: "investi-standard-v1" }),
}));
vi.mock("./environment", () => ({ portfolioMarketData: { provider: "test", service: { getHistoricalPrices: mocks.history, getFxRate: mocks.fx } } }));
vi.mock("./market-data", () => ({ observePortfolioHoldingValue: mocks.observe, observeHoldingClassification: vi.fn().mockResolvedValue({ instrumentId: "X", sector: null, country: null }), marketDataMode: () => "market" }));
import { loadPortfolioView } from "./service";

const openedAt = new Date("2026-01-01T12:00:00.000Z");
const readAt = new Date("2026-02-01T12:00:00.000Z");
const trade = { id: "buy", instrumentId: "X", instrumentSymbol: "X", instrumentName: "X", instrumentAssetType: "equity", side: "BUY", quantity: "1", unitPrice: "1000", quoteCurrency: "CZK", fxRateToBase: "1", grossAmountBaseMinor: 100_000n, feeBaseMinor: 0n, cashDeltaBaseMinor: -100_000n, executedAt: new Date("2026-01-02T12:00:00.000Z") };
const base = { portfolio: { id: "p", baseCurrency: "CZK", openedAt, openingCapitalMinor: 500_000n }, earnedPracticeCapitalMinor: 500_000n, trades: [trade], contributions: [{ at: new Date("2025-12-01"), amountMinor: 500_000n }], readAt };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.plans.mockResolvedValue([]);
  mocks.rows.mockResolvedValue(base);
  mocks.observe.mockResolvedValue({ instrumentId: "X", marketValueMinor: 110_000n, currentPrice: "1100", currentPriceCurrency: "CZK", quoteObservedAt: readAt.toISOString() });
  mocks.history.mockResolvedValue({ instrumentId: "X", currency: "CZK", adjustment: adjustmentPolicies.raw, points: [{ date: "2026-01-31", close: 1100 }], provenance: { completeness: "complete" } });
  mocks.fx.mockResolvedValue({ baseCurrency: "CZK", quoteCurrency: "CZK", rate: 1, referenceDate: "2026-01-31", provenance: { completeness: "complete" } });
});

describe("portfolio performance view", () => {
  it("loads the owned latest IPS and the complete generation ledger for process feedback", async () => {
    const view = await loadPortfolioView("u");
    expect(mocks.plans).toHaveBeenCalledWith("u", "investment_plan");
    expect(view.process.ipsVersion).toBeNull();
    expect(view.process.turnover).toMatchObject({ tradeCount: 1, grossMinor: "100000" });
    expect(view.process.costs.value).toBe("0");
    expect(view.process.period.endedAt).toBe(readAt.toISOString());
  });
  it("#106: a reward leaves Kč gain and TWR unchanged when prices do not move", async () => {
    const before = await loadPortfolioView("u");
    mocks.rows.mockResolvedValue({ ...base, earnedPracticeCapitalMinor: 700_000n, contributions: [...base.contributions, { at: readAt, amountMinor: 200_000n }] });
    const after = await loadPortfolioView("u");
    expect(before.investmentGainLossMinor).toBe("10000");
    expect(after.investmentGainLossMinor).toBe(before.investmentGainLossMinor);
    expect(after.availableCashMinor).toBe("600000");
    expect(after.performance.twr).toEqual(before.performance.twr);
    expect(after.performance.twr).toMatchObject({ basisPoints: "200" });
    expect(after).not.toHaveProperty("investmentGainLossBasisPoints");
  });

  it.each([[20_001n, "1"], [19_999n, "-1"], [20_003n, "2"], [19_997n, "-2"]])("rounds holding return on cost %s centrally", async (value, expected) => {
    mocks.rows.mockResolvedValue({ ...base, trades: [{ ...trade, unitPrice: "200", grossAmountBaseMinor: 20_000n, cashDeltaBaseMinor: -20_000n }] });
    mocks.observe.mockResolvedValue({ instrumentId: "X", marketValueMinor: value, currentPrice: "200", currentPriceCurrency: "CZK", quoteObservedAt: readAt.toISOString() });
    expect((await loadPortfolioView("u")).holdings[0].gainLossBasisPoints).toBe(expected);
  });
});
