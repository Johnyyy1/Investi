import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), verify: vi.fn(), completed: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("./repository", () => ({ verifyMission: mocks.verify, hasCompletedMission: mocks.completed }));
vi.mock("@/lib/server-errors", () => ({ logUnexpectedError: vi.fn() }));
import { missionStatusAction, verifyMissionAction } from "./actions";
const requestId = "00000000-0000-4000-8000-000000000001";
describe("mission action authority", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "session-owner" }); mocks.verify.mockResolvedValue({ completed: true, message: "Verified" }); });
  it("takes ownership only from the session", async () => {
    await verifyMissionAction("allocation-training-v1", "foundations-portfolio", requestId, { allocation: {} });
    expect(mocks.verify).toHaveBeenCalledWith("session-owner", "allocation-training-v1", requestId, { allocation: {} });
  });
  it("refuses unauthenticated reads and writes", async () => {
    mocks.user.mockResolvedValue(null);
    expect(await verifyMissionAction("allocation-training-v1", "foundations-portfolio", requestId)).toMatchObject({ ok: false });
    expect(await missionStatusAction("allocation-training-v1", "foundations-portfolio")).toMatchObject({ ok: false });
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.completed).not.toHaveBeenCalled();
  });
  it("refuses unknown missions, cross-lesson requests and malformed retry keys", async () => {
    for (const args of [["unknown", "foundations-portfolio", requestId], ["allocation-training-v1", "foundations-stocks", requestId], ["allocation-training-v1", "foundations-portfolio", "bad"]] as const) expect(await verifyMissionAction(args[0], args[1], args[2])).toMatchObject({ ok: false });
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
