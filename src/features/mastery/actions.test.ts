import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.owner }));
vi.mock("./repository", () => ({ recordSkillAttempt: mocks.record }));
import { recordSkillAttemptAction } from "./actions";

const input = { requestId: "4febc313-313b-40ba-af9a-a93534e3cabf", itemId: "foundations-stocks/mastery-position", answers: { answer: "360" }, mode: "checkpoint" as const };

describe("recordSkillAttemptAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.owner.mockResolvedValue({ id: "owner" });
    mocks.record.mockImplementation(async (_userId, { correct }) => ({ correct }));
  });

  it("evaluates the authored answer on the server", async () => {
    expect(await recordSkillAttemptAction(input)).toEqual({ ok: true, correct: true });
    expect(mocks.record).toHaveBeenLastCalledWith("owner", expect.objectContaining({ correct: true, mode: "checkpoint", item: expect.objectContaining({ skillId: "position-value" }) }));
    expect(await recordSkillAttemptAction({ ...input, answers: { answer: "450" } })).toEqual({ ok: true, correct: false });
    expect(mocks.record).toHaveBeenLastCalledWith("owner", expect.objectContaining({ correct: false }));
  });

  it("returns the stored verdict for a retried request", async () => {
    mocks.record.mockResolvedValue({ correct: false });
    expect(await recordSkillAttemptAction(input)).toEqual({ ok: true, correct: false });
  });

  it("refuses unanswered questions, unknown items, client verdicts and missing sessions", async () => {
    for (const bad of [{ ...input, answers: {} }, { ...input, itemId: "foundations-stocks/position-practice" }, { ...input, correct: true }, { ...input, mode: "review" }, { ...input, requestId: "bad" }]) {
      expect((await recordSkillAttemptAction(bad as typeof input)).ok).toBe(false);
    }
    mocks.owner.mockResolvedValue(null);
    expect((await recordSkillAttemptAction(input)).ok).toBe(false);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("keeps database details out of the message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.record.mockRejectedValue(new Error("private sql"));
    const result = await recordSkillAttemptAction(input);
    expect(result).toEqual({ ok: false, message: "Odpověď se nepodařilo uložit. Zkus to znovu." });
  });
});
