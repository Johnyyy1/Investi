import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestError } from "./instrumentation";

const request = { path: "/reset-password?token=secret-reset-token", method: "POST", headers: { cookie: "session=secret-cookie" } };
const context = { routerKind: "App Router", routePath: "/reset-password", routeType: "action", renderSource: "server-rendering", revalidateReason: undefined, renderType: "dynamic" } as const;

describe("onRequestError", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it("logs the route and a normalized error, never the path, query or headers", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await onRequestError(Object.assign(new Error("boom for learner@example.com"), { digest: "123" }), request, context);
    expect(log.mock.calls).toEqual([["[request-error] action /reset-password failed", { method: "POST", error: { name: "Error", message: "boom for [e-mail]", digest: "123" } }]]);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|token=/);
  });
});
