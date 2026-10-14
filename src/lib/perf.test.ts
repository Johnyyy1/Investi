import { afterEach, describe, expect, it, vi } from "vitest";

async function loadPerf(enabled: boolean) {
  vi.resetModules();
  if (enabled) vi.stubEnv("INVESTI_PERF_DEBUG", "1");
  else vi.stubEnv("INVESTI_PERF_DEBUG", "");
  return import("./perf");
}

const lines = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map(([line]) => String(line)).filter((line) => line.startsWith("[investi:perf] "));

describe("perf instrumentation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is a silent pass-through unless INVESTI_PERF_DEBUG=1", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { perfEnabled, perfSegment, perfMeasure, perfCount, recordQuery } = await loadPerf(false);
    expect(perfEnabled).toBe(false);
    const value = await perfSegment("page:/x", () => perfMeasure("op", "db", async () => { perfCount("c"); recordQuery('select * from "user"'); return 7; }));
    expect(value).toBe(7);
    expect(lines(log)).toEqual([]);
  });

  it("reports ops, repeated ops, counters and query shapes for one segment without parameters", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { perfEnabled, perfSegment, perfMeasure, perfCount, recordQuery } = await loadPerf(true);
    expect(perfEnabled).toBe(true);
    await perfSegment("page:/x", async () => {
      await Promise.all([perfMeasure("a", "db", async () => recordQuery('select "id" from "user" where "user"."id" = $1')), perfMeasure("a", "db", async () => recordQuery('select "id" from "user" where "user"."id" = $1'))]);
      await perfMeasure("ext", "external", async () => perfCount("market.cache.miss.quote"));
      recordQuery('insert into "session" ("id") values ($1)');
    });
    const [entry] = lines(log).map((line: string) => JSON.parse(line.slice("[investi:perf] ".length)));
    expect(entry.segment).toBe("page:/x");
    expect(entry.dbQueryCount).toBe(3);
    expect(entry.repeatedOps).toEqual([{ label: "a", calls: 2 }]);
    expect(entry.repeatedQueryShapes).toEqual([{ shape: "select user", count: 2 }]);
    expect(entry.counters).toEqual({ "market.cache.miss.quote": 1 });
    expect(entry.ops.map((op: { label: string }) => op.label).sort()).toEqual(["a", "ext"]);
    expect(JSON.stringify(entry)).not.toContain("$1");
  });

  it("still logs the segment and rethrows when the work fails", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { perfSegment, perfMeasure } = await loadPerf(true);
    await expect(perfSegment("page:/x", () => perfMeasure("boom", "compute", async () => { throw new Error("nope"); }))).rejects.toThrow("nope");
    expect(lines(log)).toHaveLength(1);
  });
});
