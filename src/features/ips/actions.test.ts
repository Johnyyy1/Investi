import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), unlock: vi.fn(), budget: vi.fn(), apply: vi.fn(), search: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.owner }));
vi.mock("@/features/progression/repository", () => ({ requirePortfolioLabUnlock: mocks.unlock }));
vi.mock("@/features/rate-limit", () => ({ enforceMarketDataBudget: mocks.budget }));
vi.mock("@/features/portfolio/environment", () => ({ portfolioMarketData: { service: { searchInstruments: mocks.search } } }));
vi.mock("./repository", () => ({ applyIpsTarget: mocks.apply }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { applyIpsTargetAction, searchIpsInstrumentsAction } from "./actions";
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
    mocks.apply.mockClear(); mocks.unlock.mockRejectedValue(new Error("private"));
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
