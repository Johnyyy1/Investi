// Aggregates `[investi:perf]` lines (src/lib/perf.ts) from a log export into P50/P95/max per segment,
// split by cold and warm instance. Pure: scripts/report-perf.mts reads the files.

const MARKER = "[investi:perf] ";

export interface PerfLine { segment: string; request: string; instanceCold?: boolean; totalMs: number; dbConnectionsOpened?: number }
export interface PerfRow { segment: string; state: "cold" | "warm" | "unknown"; n: number; p50: number; p95: number; max: number; connectionsP50: number | null }

/** Finds perf lines in plain text, JSON Lines, or a JSON array of log entries (any string field, e.g. `message`). */
export function extractPerfLines(text: string): PerfLine[] {
  const found = new Map<string, PerfLine>();
  const scan = (value: string) => {
    for (const line of value.split("\n")) {
      const at = line.indexOf(MARKER);
      if (at === -1) continue;
      try {
        const entry = JSON.parse(line.slice(at + MARKER.length)) as PerfLine;
        // Overlapping exports repeat lines; one request logs each segment once.
        if (typeof entry.segment === "string" && typeof entry.totalMs === "number") found.set(`${entry.request}|${entry.segment}`, entry);
      } catch {
        // Truncated by the log pipeline: skip it rather than guess.
      }
    }
  };
  const walk = (value: unknown): void => {
    if (typeof value === "string") scan(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  const parse = (value: string) => { try { return JSON.parse(value) as unknown; } catch { return undefined; } };
  const whole = parse(text);
  if (whole !== undefined) walk(whole);
  else for (const line of text.split("\n")) { const entry = parse(line); if (entry === undefined) scan(line); else walk(entry); }
  return [...found.values()];
}

/** Nearest-rank percentile of an ascending list. */
export function percentile(sorted: number[], p: number) {
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

export function summarizePerf(lines: PerfLine[]): PerfRow[] {
  const groups = new Map<string, PerfLine[]>();
  for (const line of lines) {
    const state = line.instanceCold === undefined ? "unknown" : line.instanceCold ? "cold" : "warm";
    const key = `${line.segment}\t${state}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return [...groups].map(([key, group]) => {
    const [segment, state] = key.split("\t") as [string, PerfRow["state"]];
    const totals = group.map((line) => line.totalMs).sort((a, b) => a - b);
    const connections = group.flatMap((line) => line.dbConnectionsOpened ?? []).sort((a, b) => a - b);
    return { segment, state, n: totals.length, p50: percentile(totals, 50), p95: percentile(totals, 95), max: totals.at(-1)!, connectionsP50: connections.length ? percentile(connections, 50) : null };
  }).sort((a, b) => a.segment.localeCompare(b.segment) || a.state.localeCompare(b.state));
}

export function formatPerfTable(rows: PerfRow[]) {
  const header = "| Segment | Instance | n | P50 ms | P95 ms | Max ms | New DB connections (P50) |\n| --- | --- | --- | --- | --- | --- | --- |";
  return [header, ...rows.map((row) => `| \`${row.segment}\` | ${row.state} | ${row.n} | ${Math.round(row.p50)} | ${Math.round(row.p95)} | ${Math.round(row.max)} | ${row.connectionsP50 ?? "–"} |`)].join("\n");
}
