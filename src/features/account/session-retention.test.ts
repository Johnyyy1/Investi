import { describe, expect, it, vi } from "vitest";
import { deleteExpiredSessions } from "./session-retention";

/** A fake executor returning one prepared batch count per call; the SQL itself runs in test:account-deletion. */
function batches(...counts: number[]) {
  const execute = vi.fn();
  for (const count of counts) execute.mockResolvedValueOnce([{ count }]);
  execute.mockResolvedValue([{ count: 0 }]);
  return { execute } as unknown as Parameters<typeof deleteExpiredSessions>[0] & { execute: typeof execute };
}

describe("deleteExpiredSessions", () => {
  it("sums full batches and stops after the first short batch", async () => {
    const database = batches(2, 2, 1);
    await expect(deleteExpiredSessions(database, { batchSize: 2 })).resolves.toEqual({ removed: 5, complete: true });
    expect(database.execute).toHaveBeenCalledTimes(3);
  });

  it("reports incomplete when the batch limit is reached", async () => {
    const database = batches(2, 2, 2);
    await expect(deleteExpiredSessions(database, { batchSize: 2, maxBatches: 2 })).resolves.toEqual({ removed: 4, complete: false });
    expect(database.execute).toHaveBeenCalledTimes(2);
  });

  it("completes immediately when nothing is old enough", async () => {
    const database = batches(0);
    await expect(deleteExpiredSessions(database)).resolves.toEqual({ removed: 0, complete: true });
  });
});
