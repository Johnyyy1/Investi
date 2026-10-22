import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consume: vi.fn(), record: vi.fn() }));
vi.mock("@/db", () => ({ db: { marker: "db" } }));
vi.mock("@/lib/auth", () => ({ auth: { options: { advanced: { ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } } } } }));
vi.mock("@/features/rate-limit", () => ({ rateLimiter: { consume: mocks.consume } }));
vi.mock("@/features/analytics/repository", () => ({ recordLandingView: mocks.record }));

import { POST } from "./route";

const beacon = (headers: Record<string, string> = { "sec-fetch-site": "same-origin", "x-forwarded-for": "203.0.113.7" }) =>
  POST(new Request("http://localhost/api/analytics/visit", { method: "POST", headers }));

describe("POST /api/analytics/visit", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.consume.mockResolvedValue({ allowed: true, retryAfterSeconds: null, deniedScope: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("counts a same-origin view, rate limited per IP, and answers an empty no-store 204", async () => {
    const response = await beacon();
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
    expect(mocks.consume).toHaveBeenCalledWith([expect.objectContaining({ scope: "analytics:landing-view", subject: "203.0.113.7" })]);
    expect(mocks.record).toHaveBeenCalledWith({ marker: "db" });
  });

  it("ignores beacons from other sites without touching the database", async () => {
    const response = await beacon({ "sec-fetch-site": "cross-site", "x-forwarded-for": "203.0.113.7" });
    expect(response.status).toBe(204);
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("does not count over the per-IP limit and answers the same way", async () => {
    mocks.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 60, deniedScope: "analytics:landing-view" });
    const response = await beacon();
    expect(response.status).toBe(204);
    expect(response.headers.get("retry-after")).toBeNull();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("logs a database failure without details and still answers 204", async () => {
    mocks.record.mockRejectedValue(new Error("connection refused"));
    const response = await beacon();
    expect(response.status).toBe(204);
    expect(console.error).toHaveBeenCalledWith("[analytics] landing view failed", expect.anything());
  });
});
