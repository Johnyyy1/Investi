import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cleanup: vi.fn(), env: { CRON_SECRET: undefined as string | undefined } }));
vi.mock("@/db", () => ({ db: { marker: "db" } }));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/features/guest/cleanup", () => ({ deleteUnreachableAnonymousIdentities: mocks.cleanup }));

import { GET } from "./route";

const secret = "c".repeat(40);
const call = (authorization?: string) => GET(new Request("http://localhost/api/cron/cleanup-anonymous", { headers: authorization ? { authorization } : {} }));

describe("GET /api/cron/cleanup-anonymous", () => {
  beforeEach(() => {
    mocks.cleanup.mockReset();
    mocks.env.CRON_SECRET = secret;
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("refuses requests without the bearer secret and never touches the database", async () => {
    for (const response of [await call(), await call("Bearer wrong")]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
    }
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });

  it("stays closed when CRON_SECRET is not configured", async () => {
    mocks.env.CRON_SECRET = undefined;
    expect((await call("Bearer undefined")).status).toBe(401);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });

  it("runs the shared cleanup and returns only counts", async () => {
    mocks.cleanup.mockResolvedValue({ removed: { demo: 3, guest: 2 }, complete: true });
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ removed: { demo: 3, guest: 2 }, complete: true });
    expect(mocks.cleanup).toHaveBeenCalledWith({ marker: "db" });
  });

  it("returns a generic error without database details", async () => {
    mocks.cleanup.mockRejectedValue(new Error('relation "user" does not exist'));
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "cleanup_failed" });
  });
});
