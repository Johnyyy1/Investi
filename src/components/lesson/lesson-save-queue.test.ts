import { describe, expect, it, vi } from "vitest";
import { createLessonSaveQueue, type LessonMove, type LessonSaveResult } from "./lesson-save-queue";

function deferred() {
  let resolve!: (result: LessonSaveResult) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<LessonSaveResult>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup() {
  const calls: { move: LessonMove; result: ReturnType<typeof deferred> }[] = [];
  const events: string[] = [];
  const queue = createLessonSaveQueue({
    save: (move) => { const result = deferred(); calls.push({ move, result }); return result.promise; },
    onFailure: (move, message) => events.push(`failed ${move.from}->${move.to}: ${message}`),
    onPendingChange: (pending) => events.push(pending ? "pending" : "idle"),
  });
  return { queue, calls, events };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createLessonSaveQueue", () => {
  it("saves moves one at a time in click order", async () => {
    const { queue, calls, events } = setup();
    queue.enqueue({ from: 0, to: 1 });
    queue.enqueue({ from: 1, to: 2, answers: { q: "a" } });
    await tick();
    expect(calls.map((call) => call.move.to)).toEqual([1]);
    expect(queue.saved).toBe(false);
    calls[0].result.resolve({ ok: true });
    await tick();
    expect(calls.map((call) => call.move)).toEqual([{ from: 0, to: 1 }, { from: 1, to: 2, answers: { q: "a" } }]);
    expect(queue.saved).toBe(true);
    expect(queue.pending).toBe(true);
    calls[1].result.resolve({ ok: true });
    await expect(queue.flush()).resolves.toBe(true);
    expect(events).toEqual(["pending", "idle"]);
    expect(queue.pending).toBe(false);
  });

  it("reports the first failure once and drops the moves queued behind it", async () => {
    const { queue, calls, events } = setup();
    queue.enqueue({ from: 0, to: 1 });
    queue.enqueue({ from: 1, to: 2 });
    queue.enqueue({ from: 2, to: 3 });
    await tick();
    calls[0].result.resolve({ ok: false, message: "Relace skončila." });
    await expect(queue.flush()).resolves.toBe(false);
    expect(calls).toHaveLength(1);
    expect(events).toEqual(["pending", "failed 0->1: Relace skončila.", "idle"]);
    expect(queue.saved).toBe(false);
  });

  it("treats a thrown save as a failure with a generic message", async () => {
    const { queue, calls, events } = setup();
    queue.enqueue({ from: 2, to: 3 });
    await tick();
    calls[0].result.reject(new Error("network"));
    await expect(queue.flush()).resolves.toBe(false);
    expect(events).toContain("failed 2->3: Postup se nepodařilo uložit. Zkus to znovu.");
  });

  it("accepts a retry after a failure", async () => {
    const { queue, calls } = setup();
    queue.enqueue({ from: 0, to: 1 });
    await tick();
    calls[0].result.resolve({ ok: false });
    await queue.flush();
    queue.enqueue({ from: 0, to: 1 });
    await tick();
    calls[1].result.resolve({ ok: true });
    await expect(queue.flush()).resolves.toBe(true);
  });

  it("flushes immediately when nothing is queued", async () => {
    const onPendingChange = vi.fn();
    const queue = createLessonSaveQueue({ save: vi.fn(), onFailure: vi.fn(), onPendingChange });
    await expect(queue.flush()).resolves.toBe(true);
    expect(onPendingChange).not.toHaveBeenCalled();
  });
});
