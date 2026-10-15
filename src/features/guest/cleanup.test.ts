import { describe, expect, it, vi } from "vitest";
import { deleteUnreachableAnonymousIdentities } from "./cleanup";

/** A fake executor that returns one prepared batch result per call; the SQL itself runs in test:anonymous-cleanup. */
function batches(...results: { kind: string; count: number }[][]) {
  const execute = vi.fn();
  for (const rows of results) execute.mockResolvedValueOnce(rows);
  execute.mockResolvedValue([]);
  return { execute } as unknown as Parameters<typeof deleteUnreachableAnonymousIdentities>[0] & { execute: typeof execute };
}

describe("deleteUnreachableAnonymousIdentities", () => {
  it("sums kinds across full batches and stops after the first short batch", async () => {
    const database = batches([{ kind: "demo", count: 1 }, { kind: "guest", count: 1 }], [{ kind: "guest", count: 1 }]);
    await expect(deleteUnreachableAnonymousIdentities(database, { batchSize: 2 })).resolves.toEqual({ removed: { demo: 1, guest: 2 }, complete: true });
    expect(database.execute).toHaveBeenCalledTimes(2);
  });

  it("reports incomplete when the batch limit is reached with full batches", async () => {
    const database = batches([{ kind: "demo", count: 2 }], [{ kind: "guest", count: 2 }], [{ kind: "guest", count: 2 }]);
    await expect(deleteUnreachableAnonymousIdentities(database, { batchSize: 2, maxBatches: 2 })).resolves.toEqual({ removed: { demo: 2, guest: 2 }, complete: false });
    expect(database.execute).toHaveBeenCalledTimes(2);
  });

  it("completes immediately when nothing is eligible", async () => {
    const database = batches([]);
    await expect(deleteUnreachableAnonymousIdentities(database)).resolves.toEqual({ removed: { demo: 0, guest: 0 }, complete: true });
    expect(database.execute).toHaveBeenCalledTimes(1);
  });
});
