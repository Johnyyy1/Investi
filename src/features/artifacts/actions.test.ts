import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), save: vi.fn(), list: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("./repository", () => ({ saveLearnerArtifact: mocks.save, listLearnerArtifacts: mocks.list, deleteLearnerArtifact: mocks.remove }));
import { deleteArtifact, listArtifacts, saveArtifact } from "./actions";
import { artifactExamples } from "./test-fixtures";
const id = "2febc313-313b-40ba-af9a-a93534e3cabf";
const input = { content: { kind: "goal_map", payload: artifactExamples.goal_map }, sourceLessonId: "foundations-why-invest", consent: true, requestId: id };
describe("artifact server action boundaries", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "owner", isAnonymous: false }); mocks.list.mockResolvedValue([]); mocks.save.mockResolvedValue({ id, version: 1 }); });
  it.each([null, { id: "guest", isAnonymous: true, anonymousKind: "guest" }])("does not persist, list or delete for %j", async (owner) => {
    mocks.user.mockResolvedValue(owner);
    for (const result of [await saveArtifact(input), await listArtifacts(), await deleteArtifact({ id })]) expect(result).toMatchObject({ ok: false });
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("derives ownership only from the session and passes validated payloads", async () => {
    expect(await saveArtifact(input)).toMatchObject({ ok: true });
    expect(mocks.save).toHaveBeenCalledWith("owner", input);
    expect(await listArtifacts({ kind: "goal_map" })).toEqual({ ok: true, artifacts: [] });
    expect(mocks.list).toHaveBeenCalledWith("owner", "goal_map");
    expect(await deleteArtifact({ id })).toEqual({ ok: true });
    expect(mocks.remove).toHaveBeenCalledWith("owner", id);
  });
  it("allows an isolated demo identity", async () => {
    mocks.user.mockResolvedValue({ id: "demo", isAnonymous: true, anonymousKind: "demo" });
    expect(await saveArtifact(input)).toMatchObject({ ok: true });
    expect(mocks.save).toHaveBeenCalledWith("demo", input);
  });
  it("rejects spoofed owner keys, invalid kinds, invalid IDs and absent consent", async () => {
    for (const patch of [{ userId: "victim" }, { consent: false }, { content: { kind: "goal_map", payload: { income: 10 } } }]) expect(await saveArtifact({ ...input, ...patch })).toMatchObject({ ok: false });
    expect(await listArtifacts({ userId: "victim" })).toMatchObject({ ok: false });
    expect(await listArtifacts({ kind: "unknown" })).toMatchObject({ ok: false });
    expect(await deleteArtifact({ id: "bad" })).toMatchObject({ ok: false });
    expect(await deleteArtifact({ id, userId: "victim" })).toMatchObject({ ok: false });
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("returns recoverable errors without private database details", async () => {
    mocks.save.mockRejectedValue(new Error("private payload connection secret")); mocks.list.mockRejectedValue(new Error("private")); mocks.remove.mockRejectedValue(new Error("private"));
    for (const result of [await saveArtifact(input), await listArtifacts(), await deleteArtifact({ id })]) { expect(result).toMatchObject({ ok: false }); expect(JSON.stringify(result)).not.toContain("private"); }
  });
});
