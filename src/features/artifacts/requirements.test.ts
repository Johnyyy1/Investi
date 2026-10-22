import { describe, expect, it, vi } from "vitest";
import { ArtifactRequiredError, requireArtifacts } from "./requirements";
describe("lesson artifact requirements", () => {
  it("keeps existing steps ungated", async () => {
    const read = vi.fn(); await requireArtifacts([undefined, undefined], "lesson", read); expect(read).not.toHaveBeenCalled();
  });
  it("requires an output from this lesson by default and allows explicit reuse", async () => {
    const read = vi.fn().mockResolvedValue(true);
    await requireArtifacts([{ kind: "goal_map" }, { kind: "financial_checkup", source: "any_lesson" }], "lesson", read);
    expect(read.mock.calls).toEqual([["goal_map", "lesson", undefined], ["financial_checkup", undefined, undefined]]);
  });
  it("rejects a missing or invalid persisted output", async () => {
    await expect(requireArtifacts([{ kind: "investment_plan" }], "lesson", async () => false)).rejects.toBeInstanceOf(ArtifactRequiredError);
  });
});
