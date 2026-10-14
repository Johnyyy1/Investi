import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { cache } from "react";

/**
 * Opt-in server timing for the app routes. Off unless INVESTI_PERF_DEBUG=1, in which case every
 * helper below is a pass-through. Output is one JSON line per segment on stdout; it holds only
 * static labels, durations, counts and table names, never parameters, cookies, user ids or emails.
 */
export const perfEnabled = process.env.INVESTI_PERF_DEBUG === "1";

export type PerfKind = "auth" | "db" | "external" | "compute";

interface PerfOp { label: string; kind: PerfKind; startMs: number; ms: number }
interface PerfSegment {
  name: string;
  requestId: string;
  startedAt: number;
  ops: PerfOp[];
  counters: Map<string, number>;
  queries: Map<string, number>;
}

const storage = new AsyncLocalStorage<PerfSegment>();
/** React.cache scopes this to one RSC render, so layout and page lines of one request share an id. */
const requestId = cache(() => randomUUID().slice(0, 8));

const round = (value: number) => Math.round(value * 100) / 100;

function summarize(segment: PerfSegment, totalMs: number) {
  const byLabel = new Map<string, { kind: PerfKind; calls: number; totalMs: number; maxMs: number }>();
  for (const op of segment.ops) {
    const entry = byLabel.get(op.label) ?? { kind: op.kind, calls: 0, totalMs: 0, maxMs: 0 };
    entry.calls += 1;
    entry.totalMs += op.ms;
    entry.maxMs = Math.max(entry.maxMs, op.ms);
    byLabel.set(op.label, entry);
  }
  const queryCount = [...segment.queries.values()].reduce((sum, count) => sum + count, 0);
  const kindTotals: Record<string, number> = {};
  for (const op of segment.ops) kindTotals[op.kind] = round((kindTotals[op.kind] ?? 0) + op.ms);
  return {
    segment: segment.name,
    request: segment.requestId,
    totalMs: round(totalMs),
    // Sum of op durations by kind. Ops overlap and nest, so these are NOT additive with totalMs.
    kindTotalsMs: kindTotals,
    ops: [...byLabel].map(([label, entry]) => ({ label, kind: entry.kind, calls: entry.calls, totalMs: round(entry.totalMs), maxMs: round(entry.maxMs) })),
    // Ops invoked more than once in one segment. Candidates for deduplication, not proof of waste.
    repeatedOps: [...byLabel].filter(([, entry]) => entry.calls > 1).map(([label, entry]) => ({ label, calls: entry.calls })),
    counters: Object.fromEntries(segment.counters),
    dbQueryCount: queryCount,
    // Same SQL shape (verb + tables) issued more than once in one segment.
    repeatedQueryShapes: [...segment.queries].filter(([, count]) => count > 1).map(([shape, count]) => ({ shape, count })),
    timeline: segment.ops.map((op) => ({ label: op.label, startMs: round(op.startMs), endMs: round(op.startMs + op.ms) })),
  };
}

/** Wraps one route segment (layout or page). All perfMeasure/recordQuery calls inside are attributed to it. */
export async function perfSegment<T>(name: string, run: () => Promise<T>): Promise<T> {
  if (!perfEnabled) return run();
  const segment: PerfSegment = { name, requestId: requestId(), startedAt: performance.now(), ops: [], counters: new Map(), queries: new Map() };
  try {
    return await storage.run(segment, run);
  } finally {
    console.log(`[investi:perf] ${JSON.stringify(summarize(segment, performance.now() - segment.startedAt))}`);
  }
}

export function perfMeasure<T>(label: string, kind: PerfKind, run: () => Promise<T>): Promise<T> {
  const segment = perfEnabled ? storage.getStore() : undefined;
  if (!segment) return run();
  const start = performance.now();
  const finish = () => segment.ops.push({ label, kind, startMs: start - segment.startedAt, ms: performance.now() - start });
  return run().then(
    (value) => { finish(); return value; },
    (error: unknown) => { finish(); throw error; },
  );
}

export function perfCount(label: string) {
  const segment = perfEnabled ? storage.getStore() : undefined;
  if (segment) segment.counters.set(label, (segment.counters.get(label) ?? 0) + 1);
}

/** Drizzle logger hook. Receives parameterised SQL text only; the shape is reduced to verb + tables. */
export function recordQuery(sql: string) {
  const segment = perfEnabled ? storage.getStore() : undefined;
  if (!segment) return;
  const verb = sql.trimStart().split(/\s+/, 1)[0]?.toLowerCase() ?? "?";
  const tables = [...new Set([...sql.matchAll(/\b(?:from|into|update|join)\s+"(\w+)"/gi)].map((match) => match[1]))];
  const shape = `${verb} ${tables.join(",")}`.trim();
  segment.queries.set(shape, (segment.queries.get(shape) ?? 0) + 1);
}
