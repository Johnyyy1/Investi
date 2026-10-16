export type LessonMove = { from: number; to: number; answers?: Record<string, string> };
export type LessonSaveResult = { ok: boolean; message?: string };

const fallbackMessage = "Postup se nepodařilo uložit. Zkus to znovu.";

/**
 * Saves lesson cursor moves one at a time, in click order, while the learner already sees the next step.
 * The server accepts a move only from its current cursor, so after a failed move the moves queued behind
 * it are dropped (they would be rejected) and `onFailure` hands the lesson the move to return to.
 */
export function createLessonSaveQueue({ save, onFailure, onPendingChange }: {
  save: (move: LessonMove) => Promise<LessonSaveResult>;
  onFailure: (move: LessonMove, message: string) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  let tail: Promise<boolean> = Promise.resolve(true);
  let generation = 0;
  let pending = 0;
  let saved = false;

  function settle() {
    pending -= 1;
    if (pending === 0) onPendingChange(false);
  }

  return {
    enqueue(move: LessonMove) {
      const queuedIn = generation;
      if (pending === 0) onPendingChange(true);
      pending += 1;
      tail = tail.then(async () => {
        try {
          if (queuedIn !== generation) return false;
          const result = await save(move).catch((): LessonSaveResult => ({ ok: false }));
          if (!result.ok) {
            generation += 1;
            onFailure(move, result.message ?? fallbackMessage);
            return false;
          }
          saved = true;
          return true;
        } finally { settle(); }
      });
    },
    /** Resolves once every queued move has settled: true when the last one was saved. */
    flush: () => tail,
    get pending() { return pending > 0; },
    /** Whether any move reached the server, i.e. whether overviews rendered earlier may now be stale. */
    get saved() { return saved; },
  };
}
