import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), requireUnlock: vi.fn(), search: vi.fn(), execute: vi.fn(), reset: vi.fn(),
  preview: vi.fn(), view: vi.fn(), revalidate: vi.fn(), executeAllocation: vi.fn(), reviewAllocation: vi.fn(), quotes: vi.fn(),
  budget: vi.fn(), reviewTrade: vi.fn(), setProfile: vi.fn(),
}));
vi.mock("@/features/rate-limit", () => ({ enforceMarketDataBudget: mocks.budget }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/features/progression/repository", () => ({ requirePortfolioLabUnlock: mocks.requireUnlock }));
vi.mock("./environment", () => ({ portfolioMarketData: { service: { searchInstruments: mocks.search } } }));
vi.mock("./repository", () => ({ executeTrade: mocks.execute, resetActivePortfolio: mocks.reset, executeAllocation: mocks.executeAllocation, reviewAllocation: mocks.reviewAllocation, reviewTrade: mocks.reviewTrade, setBrokerFeeProfile: mocks.setProfile }));
vi.mock("./service", () => ({ loadInstrumentPreview: mocks.preview, loadPortfolioView: mocks.view, loadAllocationQuotes: mocks.quotes }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { RequestRateLimitedError } from "@/features/rate-limit/limiter";
import {
  buyPortfolioAction, loadAllocationQuotesAction, loadInstrumentPreviewAction, resetPortfolioAction, reviewPortfolioAllocationAction,
  reviewPortfolioTradeAction, setBrokerFeeProfileAction,
  savePortfolioAllocationAction, searchPortfolioInstrumentsAction, sellPortfolioAction,
} from "./actions";

const mix = { lines: [{ instrumentId: "US-XNAS:AAPL", weightBasisPoints: 9_000 }], cashWeightBasisPoints: 1_000 };

describe("Portfolio Lab server authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "locked-user" });
    mocks.requireUnlock.mockRejectedValue(new Error("locked"));
  });

  it("blocks every portfolio entry point before parsing or domain work", async () => {
    const input = { instrumentId: "US-XNAS:AAPL", quantity: "1", clientIdempotencyKey: crypto.randomUUID() };
    const results = await Promise.all([
      searchPortfolioInstrumentsAction("Apple"),
      loadInstrumentPreviewAction("US-XNAS:AAPL"),
      reviewPortfolioTradeAction({ instrumentId: input.instrumentId, quantity: input.quantity, side: "BUY" }),
      setBrokerFeeProfileAction({ profileId: "investi-standard-v1" }),
      buyPortfolioAction(input),
      sellPortfolioAction(input),
      resetPortfolioAction({ clientIdempotencyKey: crypto.randomUUID() }),
      loadAllocationQuotesAction(["US-XNAS:AAPL"]),
      reviewPortfolioAllocationAction(mix),
      savePortfolioAllocationAction({ ...mix, clientIdempotencyKey: crypto.randomUUID() }),
    ]);
    for (const result of results) expect(result).toMatchObject({ ok: false, message: "Portfolio Lab je zamčený. Dokonči Základy investování a odemkni ho." });
    expect(mocks.requireUnlock).toHaveBeenCalledTimes(10);
    expect(mocks.quotes).not.toHaveBeenCalled();
    expect(mocks.reviewAllocation).not.toHaveBeenCalled();
    expect(mocks.executeAllocation).not.toHaveBeenCalled();
    expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.reviewTrade).not.toHaveBeenCalled();
    expect(mocks.setProfile).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.view).not.toHaveBeenCalled();
    expect(mocks.budget).not.toHaveBeenCalled();
  });
});

describe("market-data budget", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "unlocked-user" });
    mocks.requireUnlock.mockResolvedValue(undefined);
  });

  it("counts each market-data read against the signed-in user", async () => {
    mocks.search.mockResolvedValue([]);
    mocks.preview.mockResolvedValue(null);
    mocks.quotes.mockResolvedValue([]);
    await searchPortfolioInstrumentsAction("Apple");
    await loadInstrumentPreviewAction("US-XNAS:AAPL");
    await loadAllocationQuotesAction(["US-XNAS:AAPL"]);
    expect(mocks.budget.mock.calls).toEqual([["unlocked-user", "search"], ["unlocked-user", "instrument-preview"], ["unlocked-user", "allocation-quotes"]]);
  });

  it("does not spend budget on input that never reaches the provider", async () => {
    expect(await searchPortfolioInstrumentsAction(" a ")).toMatchObject({ ok: false });
    expect(await loadAllocationQuotesAction([])).toMatchObject({ ok: false });
    expect(mocks.budget).not.toHaveBeenCalled();
  });

  it("refuses an over-budget read with a retry hint and never calls the provider", async () => {
    mocks.budget.mockRejectedValue(new RequestRateLimitedError({ allowed: false, retryAfterSeconds: 42, deniedScope: "market:search" }));
    const results = await Promise.all([
      searchPortfolioInstrumentsAction("Apple"),
      loadInstrumentPreviewAction("US-XNAS:AAPL"),
      loadAllocationQuotesAction(["US-XNAS:AAPL"]),
      reviewPortfolioAllocationAction(mix),
    ]);
    for (const result of results) expect(result).toMatchObject({ ok: false, message: "Tržní data načítáš příliš rychle. Zkus to znovu za 42 s." });
    expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.quotes).not.toHaveBeenCalled();
    expect(mocks.reviewAllocation).not.toHaveBeenCalled();
  });
});

describe("target mix input boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "unlocked-user" });
    mocks.requireUnlock.mockResolvedValue(undefined);
  });

  it("rejects client-supplied prices, amounts or fractional weights before any domain work", async () => {
    const key = crypto.randomUUID();
    const attempts = [
      { ...mix, clientIdempotencyKey: key, totalValueMinor: "999999" },
      { lines: [{ instrumentId: "US-XNAS:AAPL", weightBasisPoints: 9_000, price: 1 }], cashWeightBasisPoints: 1_000, clientIdempotencyKey: key },
      { lines: [{ instrumentId: "US-XNAS:AAPL", weightBasisPoints: 8_999.5 }], cashWeightBasisPoints: 1_000.5, clientIdempotencyKey: key },
      { ...mix, clientIdempotencyKey: "not-a-uuid" },
    ];
    for (const attempt of attempts) expect(await savePortfolioAllocationAction(attempt)).toMatchObject({ ok: false });
    expect(mocks.executeAllocation).not.toHaveBeenCalled();
  });

  it("passes only identities, integer weights and the idempotency key to execution", async () => {
    mocks.executeAllocation.mockResolvedValue({ allocationId: "a", tradeCount: 1, duplicate: false });
    const key = crypto.randomUUID();
    expect(await savePortfolioAllocationAction({ ...mix, clientIdempotencyKey: key })).toEqual({ ok: true, duplicate: false, tradeCount: 1 });
    expect(mocks.executeAllocation).toHaveBeenCalledWith("unlocked-user", { ...mix, clientIdempotencyKey: key });
    expect(mocks.revalidate).toHaveBeenCalledWith("/lab/portfolio");
  });
});

describe("cost authority boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "owner" });
    mocks.requireUnlock.mockResolvedValue(undefined);
  });
  it("rejects costs, tariffs and ownership supplied by the client", async () => {
    const trade = { instrumentId: "US-XNAS:AAPL", quantity: "0.25", clientIdempotencyKey: crypto.randomUUID() };
    for (const extra of [{ feeBaseMinor: "0" }, { fxMarkupBps: 0 }, { price: 1 }, { userId: "victim" }]) {
      expect(await buyPortfolioAction({ ...trade, ...extra })).toMatchObject({ ok: false });
      expect(await reviewPortfolioTradeAction({ instrumentId: trade.instrumentId, quantity: trade.quantity, side: "BUY", ...extra })).toMatchObject({ ok: false });
    }
    expect(await setBrokerFeeProfileAction({ profileId: "unknown" })).toMatchObject({ ok: false });
    expect(await setBrokerFeeProfileAction({ profileId: "investi-standard-v1", rateBps: 0 })).toMatchObject({ ok: false });
    expect(mocks.execute).not.toHaveBeenCalled(); expect(mocks.reviewTrade).not.toHaveBeenCalled(); expect(mocks.setProfile).not.toHaveBeenCalled();
  });
  it("resolves review and saved profile only for the authenticated learner", async () => {
    mocks.reviewTrade.mockResolvedValue({ feeBaseMinor: "1000" });
    expect(await reviewPortfolioTradeAction({ instrumentId: "US-XNAS:AAPL", quantity: "0.25", side: "SELL" })).toEqual({ ok: true, cost: { feeBaseMinor: "1000" } });
    expect(mocks.reviewTrade).toHaveBeenCalledWith("owner", { instrumentId: "US-XNAS:AAPL", quantity: "0.25", side: "SELL" });
    mocks.setProfile.mockResolvedValue("investi-low-fx-v1");
    expect(await setBrokerFeeProfileAction({ profileId: "investi-low-fx-v1" })).toEqual({ ok: true, feeProfileId: "investi-low-fx-v1" });
    expect(mocks.setProfile).toHaveBeenCalledWith("owner", "investi-low-fx-v1");
  });
});
