import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), budget: vi.fn(), run: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/features/rate-limit", () => ({ enforceMarketDataBudget: mocks.budget }));
vi.mock("@/features/portfolio/environment", () => ({ portfolioMarketData: { provider: "deterministic", service: {} } }));
vi.mock("./run", () => ({ runHistoryBacktests: mocks.run }));
import { MarketDataError } from "@/features/market-data/errors";
import { RequestRateLimitedError } from "@/features/rate-limit/limiter";
import { runHistoryBacktestAction } from "./actions";

const input = { strategy: "buy-and-hold", benchmark: "none", rebalance: "none", amount: "10000", periods: [{ start: 2020, end: 2021 }] };

describe("backtest failure logging", () => {
  let log: MockInstance<typeof console.error>;
  beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "owner" }); log = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => log.mockRestore());

  it("logs an unexpected failure once, normalized, and keeps the learner message", async () => {
    mocks.run.mockRejectedValue(new MarketDataError("ProviderUnavailable", "Provider timed out.", { provider: "fmp" }));
    expect(await runHistoryBacktestAction(input)).toEqual({ ok: false, message: "Cenová historie teď není dostupná. Backtest jsme nespustili, zkus to za chvíli znovu." });
    expect(log.mock.calls).toEqual([["[backtest-history] run failed", { error: { name: "MarketDataError", code: "ProviderUnavailable", message: "Provider timed out.", context: { provider: "fmp" } } }]]);
  });

  it("does not log invalid settings or a rate limit", async () => {
    await runHistoryBacktestAction({ ...input, rebalance: "daily" });
    mocks.budget.mockRejectedValue(new RequestRateLimitedError({ allowed: false, retryAfterSeconds: 30, deniedScope: "market-data:backtest" }));
    await runHistoryBacktestAction(input);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
