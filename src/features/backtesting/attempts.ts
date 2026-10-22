/** A tab-local educational counter, never a reward or evidence that a learner has a bias. */
export const OVERFITTING_NOTICE_AT = 5;
export type AttemptHistory = Record<string, string[]>;
export const ATTEMPTS_KEY = "investi:backtest-attempts:v1";

export function readAttempts(value: string | null): AttemptHistory {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, items]) => key.length <= 80 && Array.isArray(items) && items.every((item) => typeof item === "string")));
  } catch { return {}; }
}

export function recordAttempt(history: AttemptHistory, goal: string, specification: unknown): AttemptHistory {
  const key = JSON.stringify(specification);
  const prior = history[goal] ?? [];
  return { ...history, [goal]: prior.includes(key) ? prior : [...prior, key] };
}
