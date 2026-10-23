/** Where a skill attempt was answered. Dependency-free so the database schema can import it. */
export const attemptContexts = ["lesson", "checkpoint", "review"] as const;
export type AttemptContext = (typeof attemptContexts)[number];
