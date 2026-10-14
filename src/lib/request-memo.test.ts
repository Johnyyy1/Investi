import { afterEach, describe, expect, it, vi } from "vitest";

// React's server build, whose `cache` is what Server Components get. Each simulated request below
// gets its own cache map, the way React Flight resolves `getCacheForType` per render request.
// @ts-expect-error -- untyped CommonJS build; only `cache` and the server internals are used.
vi.mock("react", async () => await import("next/dist/compiled/react/cjs/react.react-server.production.js"));

type Dispatcher = { getCacheForType: <T>(create: () => T) => T };
type Internals = { A: Dispatcher | null };

async function setup(perf = false) {
  vi.resetModules();
  vi.stubEnv("INVESTI_PERF_DEBUG", perf ? "1" : "");
  const react = (await import("react")) as unknown as { __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: Internals };
  const internals = react.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { requestMemo } = await import("./request-memo");
  const perfModule = await import("./perf");
  /** Runs `body` as one render request with a fresh cache scope. */
  async function inRequest<T>(body: () => Promise<T>) {
    const caches = new Map<unknown, unknown>();
    const previous = internals.A;
    internals.A = { getCacheForType: <C>(create: () => C) => { if (!caches.has(create)) caches.set(create, create()); return caches.get(create) as C; } };
    try { return await body(); } finally { internals.A = previous; }
  }
  return { requestMemo, inRequest, perf: perfModule };
}

describe("requestMemo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reads once per argument list within one request, including concurrent callers", async () => {
    const { requestMemo, inRequest } = await setup();
    const read = vi.fn(async (userId: string) => ({ userId }));
    const memo = requestMemo("profile", read);
    await inRequest(async () => {
      const [a, b, c] = await Promise.all([memo("user-a"), memo("user-a"), memo("user-b")]);
      expect(a).toBe(b);
      expect(a).toEqual({ userId: "user-a" });
      expect(c).toEqual({ userId: "user-b" });
    });
    expect(read.mock.calls).toEqual([["user-a"], ["user-b"]]);
  });

  it("runs a lazy thenable (like a Drizzle query) once for all awaiting callers", async () => {
    const { requestMemo, inRequest } = await setup();
    let executions = 0;
    // Drizzle's QueryPromise executes its SQL inside `then`, once per call.
    const lazyQuery = (userId: string): PromiseLike<string> => ({
      then: (resolve, reject) => { executions += 1; return Promise.resolve(userId).then(resolve, reject); },
    });
    const memo = requestMemo("lazy", lazyQuery);
    await inRequest(async () => {
      await Promise.all([memo("a"), memo("a")]);
      await memo("a");
    });
    expect(executions).toBe(1);
  });

  it("never shares a result between requests", async () => {
    const { requestMemo, inRequest } = await setup();
    let version = 0;
    const memo = requestMemo("status", async (userId: string) => ({ userId, version: ++version }));
    const first = await inRequest(() => memo("user-a"));
    const second = await inRequest(() => memo("user-a"));
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
  });

  it("does not memoize outside a render, as in Server Actions and scripts", async () => {
    const { requestMemo } = await setup();
    const read = vi.fn(async (userId: string) => userId);
    const memo = requestMemo("session", read);
    await memo("user-a");
    await memo("user-a");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("shares a rejection only within its request", async () => {
    const { requestMemo, inRequest } = await setup();
    const read = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue("ok");
    const memo = requestMemo("flaky", read as (id: string) => Promise<string>);
    await inRequest(async () => {
      await expect(memo("x")).rejects.toThrow("down");
      await expect(memo("x")).rejects.toThrow("down");
    });
    await expect(inRequest(() => memo("x"))).resolves.toBe("ok");
  });

  it("counts calls and misses in the active perf segment", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { requestMemo, inRequest, perf } = await setup(true);
    const memo = requestMemo("profile", async (userId: string) => userId);
    await inRequest(() => perf.perfSegment("page:/x", async () => { await memo("a"); await memo("a"); }));
    const entry = JSON.parse(String(log.mock.calls.map(([line]) => line).find((line) => String(line).startsWith("[investi:perf] "))).slice("[investi:perf] ".length));
    expect(entry.counters).toEqual({ "memo.call.profile": 2, "memo.miss.profile": 1 });
  });
});
