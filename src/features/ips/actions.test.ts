import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), unlock: vi.fn(), budget: vi.fn(), apply: vi.fn(), search: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.owner }));
vi.mock("@/features/progression/repository", () => ({ requirePortfolioLabUnlock: mocks.unlock }));
vi.mock("@/features/rate-limit", () => ({ enforceMarketDataBudget: mocks.budget }));
vi.mock("@/features/portfolio/environment", () => ({ portfolioMarketData: { service: { searchInstruments: mocks.search } } }));
vi.mock("./repository", () => ({ applyIpsTarget: mocks.apply }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { applyIpsTargetAction, searchIpsInstrumentsAction } from "./actions";
import { MarketDataError } from "@/features/market-data/errors";
import { PortfolioInputError } from "@/features/portfolio/decimal";
import { PortfolioLabLockedError } from "@/features/progression/errors";
import { RequestRateLimitedError } from "@/features/rate-limit/limiter";
const input = { artifactId: "2febc313-313b-40ba-af9a-a93534e3cabf", portfolioId: "3febc313-313b-40ba-af9a-a93534e3cabf", requestId: "4febc313-313b-40ba-af9a-a93534e3cabf" };
describe("IPS boundaries", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.owner.mockResolvedValue({ id: "owner", isAnonymous: false }); mocks.apply.mockResolvedValue({ duplicate: false, allocationId: "mix" }); mocks.search.mockResolvedValue([]); });
  it.each([null, { id: "guest", isAnonymous: true, anonymousKind: "guest" }])("refuses missing and guest sessions %j", async (owner) => {
    mocks.owner.mockResolvedValue(owner);
    expect((await applyIpsTargetAction(input)).ok).toBe(false); expect((await searchIpsInstrumentsAction("test")).ok).toBe(false);
    expect(mocks.apply).not.toHaveBeenCalled(); expect(mocks.search).not.toHaveBeenCalled();
  });
  it("requires recorded Lab access for targets and derives ownership from session", async () => {
    expect((await applyIpsTargetAction(input)).ok).toBe(true);
    expect(mocks.unlock).toHaveBeenCalledWith("owner"); expect(mocks.apply).toHaveBeenCalledWith("owner", input);
    mocks.apply.mockClear(); mocks.unlock.mockRejectedValue(new PortfolioLabLockedError("locked"));
    expect((await applyIpsTargetAction(input)).ok).toBe(false); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("rejects client-authored weights, execution data, ownership, generation omissions and malformed identities", async () => {
    for (const patch of [{ userId: "victim" }, { lines: [] }, { price: 1 }, { portfolioId: undefined }, { requestId: "bad" }]) expect((await applyIpsTargetAction({ ...input, ...patch })).ok).toBe(false);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("permits discovery before unlock, rate limits it and offers only supported instrument types", async () => {
    mocks.search.mockResolvedValue(["equity", "etf", "bond", "cash", "index", null].map((assetType) => ({ instrumentId: String(assetType), assetType })));
    const result = await searchIpsInstrumentsAction("  fund  ");
    expect(result.results.map((r) => r.assetType)).toEqual(["equity", "etf", "bond"]);
    expect(mocks.search).toHaveBeenCalledWith("fund"); expect(mocks.budget).toHaveBeenCalledWith("owner", "search"); expect(mocks.unlock).not.toHaveBeenCalled();
    expect((await searchIpsInstrumentsAction("a")).ok).toBe(false);
  });
  it("keeps provider and database details out of errors", async () => {
    mocks.apply.mockRejectedValue(new Error("private provider secret")); mocks.search.mockRejectedValue(new Error("private"));
    for (const result of [await applyIpsTargetAction(input), await searchIpsInstrumentsAction("fund")]) { expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("private"); }
  });
});

describe("IPS failure logging", () => {
  let log: MockInstance<typeof console.error>;
  beforeEach(() => { vi.resetAllMocks(); mocks.owner.mockResolvedValue({ id: "owner", isAnonymous: false }); log = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => log.mockRestore());

  it("logs an unexpected failure once per action and keeps the learner message", async () => {
    mocks.apply.mockRejectedValue(new Error("connection terminated")); mocks.search.mockRejectedValue(new MarketDataError("ProviderUnavailable", "Provider timed out."));
    expect(await applyIpsTargetAction(input)).toEqual({ ok: false, message: "Cílový mix se nepodařilo uložit. Ověř odemčení Labu a dostupnost nástrojů a zkus to znovu." });
    expect(await searchIpsInstrumentsAction("fund")).toEqual({ ok: false, results: [], message: "Hledání se nepodařilo. Zkus jiný název nebo to zkus později." });
    expect(log.mock.calls.map(([entry]) => entry)).toEqual(["[ips] apply target failed", "[ips] search instruments failed"]);
  });

  it("does not log a locked Lab, a changed plan, rate limits or a too-short query", async () => {
    mocks.unlock.mockRejectedValueOnce(new PortfolioLabLockedError("locked"));
    await applyIpsTargetAction(input);
    mocks.apply.mockRejectedValueOnce(new PortfolioInputError("PortfolioChanged", "Portfolio se mezitím změnilo."));
    await applyIpsTargetAction(input);
    mocks.budget.mockRejectedValue(new RequestRateLimitedError({ allowed: false, retryAfterSeconds: 30, deniedScope: "market-data:search" }));
    await applyIpsTargetAction(input);
    await searchIpsInstrumentsAction("fund");
    await searchIpsInstrumentsAction("a");
    expect(log).not.toHaveBeenCalled();
  });
});
