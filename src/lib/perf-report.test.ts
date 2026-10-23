import { describe, expect, it } from "vitest";

import { extractPerfLines, formatPerfTable, percentile, summarizePerf } from "./perf-report";

const perf = (fields: Record<string, unknown>) => `[investi:perf] ${JSON.stringify(fields)}`;

describe("perf log report", () => {
  it("finds perf lines in plain text, JSON Lines and JSON arrays and drops duplicates and truncated lines", () => {
    const a = perf({ segment: "page:/learn", request: "a", instanceCold: true, totalMs: 300, dbConnectionsOpened: 2 });
    const b = perf({ segment: "page:/learn", request: "b", instanceCold: false, totalMs: 5 });
    expect(extractPerfLines(`2026-10-24 ${a}\nnoise\n${b}\n${b}\n[investi:perf] {"segment":"page:/lab","tot`)).toHaveLength(2);
    expect(extractPerfLines([JSON.stringify({ message: a }), JSON.stringify({ message: b })].join("\n"))).toHaveLength(2);
    expect(extractPerfLines(JSON.stringify([{ level: "info", message: `${a}\n${b}` }]))).toHaveLength(2);
  });

  it("uses nearest-rank percentiles", () => {
    const values = Array.from({ length: 20 }, (_, index) => index + 1);
    expect(percentile(values, 50)).toBe(10);
    expect(percentile(values, 95)).toBe(19);
    expect(percentile([7], 95)).toBe(7);
  });

  it("splits segments by cold and warm instance", () => {
    const rows = summarizePerf([
      { segment: "page:/learn", request: "1", instanceCold: false, totalMs: 4, dbConnectionsOpened: 0 },
      { segment: "page:/learn", request: "2", instanceCold: false, totalMs: 8, dbConnectionsOpened: 0 },
      { segment: "page:/learn", request: "3", instanceCold: true, totalMs: 900, dbConnectionsOpened: 3 },
      { segment: "layout:(app)", request: "4", totalMs: 3 },
    ]);
    expect(rows).toEqual([
      { segment: "layout:(app)", state: "unknown", n: 1, p50: 3, p95: 3, max: 3, connectionsP50: null },
      { segment: "page:/learn", state: "cold", n: 1, p50: 900, p95: 900, max: 900, connectionsP50: 3 },
      { segment: "page:/learn", state: "warm", n: 2, p50: 4, p95: 8, max: 8, connectionsP50: 0 },
    ]);
    expect(formatPerfTable(rows)).toContain("| `page:/learn` | warm | 2 | 4 | 8 | 8 | 0 |");
  });
});
