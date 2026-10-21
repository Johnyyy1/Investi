import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), consume: vi.fn(), read: vi.fn() }));
vi.mock("@/db", () => ({ db: { marker: "db" } }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/features/rate-limit", () => ({ rateLimiter: { consume: mocks.consume } }));
vi.mock("@/features/account/export", async (original) => ({ ...await original<typeof import("@/features/account/export")>(), readAccountExportRows: mocks.read }));

import { GET } from "./route";

const call = () => GET(new Request("http://localhost/api/account/export", { headers: { cookie: "better-auth.session_token=x" } }));
const at = new Date("2026-10-16T08:30:00.000Z");
const owner = { id: "u1", name: "Klára", email: "klara@example.com", emailVerified: true, image: null, isAnonymous: false, anonymousKind: null, createdAt: at, updatedAt: at };
const emptyRows = { owner, accounts: [], sessions: [], profile: null, progress: [], awards: [], unlocks: [], portfolios: [], artifacts: [], trades: [], allocations: [], lines: [] };

describe("GET /api/account/export", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.consume.mockResolvedValue({ allowed: true, retryAfterSeconds: null, deniedScope: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("refuses a request without a session and reads nothing", async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("exports only the session owner's data as a no-store download", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u1" }, session: {} });
    mocks.read.mockResolvedValue(emptyRows);
    const response = await call();
    expect(response.status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith({ marker: "db" }, "u1");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="investi-moje-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect((await response.json()).user).toMatchObject({ id: "u1", email: "klara@example.com" });
  });

  it("is rate limited per user", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u1" }, session: {} });
    mocks.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 120, deniedScope: "account:export" });
    const response = await call();
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(mocks.consume).toHaveBeenCalledWith([expect.objectContaining({ scope: "account:export", subject: "u1" })]);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("returns a generic error without database details", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u1" }, session: {} });
    mocks.read.mockRejectedValue(new Error('relation "portfolio" does not exist'));
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "export_failed" });
  });
});
