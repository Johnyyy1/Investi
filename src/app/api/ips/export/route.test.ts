import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.owner }));
vi.mock("@/features/artifacts/repository", () => ({ listLearnerArtifactHistory: mocks.list }));
import { GET } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.owner.mockResolvedValue({ id: "owner" }); mocks.list.mockResolvedValue([{ version: 2 }, { version: 1 }]); });
it("exports only the session owner's full history with no-store download headers", async () => {
  const response = await GET();
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store"); expect(response.headers.get("content-disposition")).toContain("attachment;");
  expect(mocks.list).toHaveBeenCalledWith("owner", "investment_plan"); expect((await response.json()).versions).toEqual([{ version: 2 }, { version: 1 }]);
});
it.each([null, { id: "guest", isAnonymous: true, anonymousKind: "guest" }])("rejects anonymous/guest export %j", async (owner) => {
  mocks.owner.mockResolvedValue(owner); expect((await GET()).status).toBe(401); expect(mocks.list).not.toHaveBeenCalled();
});
it("returns a recoverable error without leaking data", async () => {
  mocks.list.mockRejectedValue(new Error("private")); const response = await GET(); expect(response.status).toBe(500); expect(await response.text()).not.toContain("private");
});
