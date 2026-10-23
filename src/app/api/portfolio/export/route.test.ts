import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), rows: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.owner }));
vi.mock("@/features/portfolio/repository", () => ({ loadPortfolioRows: mocks.rows }));
import { GET } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.owner.mockResolvedValue({ id: "owner" }); mocks.rows.mockResolvedValue({ trades: [], readAt: new Date("2026-10-23T10:00:00Z") }); });
it("exports only the session owner's ledger as a no-store CSV download", async () => {
  const response = await GET();
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toContain("text/csv");
  expect(response.headers.get("content-disposition")).toContain('attachment; filename="investnik-evidence-obchodu-2026-10-23.csv"');
  expect(mocks.rows).toHaveBeenCalledWith("owner"); expect(await response.text()).toContain("Datum obchodu;Číslo obchodu");
});
it("rejects a request without a session", async () => {
  mocks.owner.mockResolvedValue(null); expect((await GET()).status).toBe(401); expect(mocks.rows).not.toHaveBeenCalled();
});
it("returns a recoverable error without leaking data", async () => {
  mocks.rows.mockRejectedValue(new Error("private")); const response = await GET(); expect(response.status).toBe(500); expect(await response.text()).not.toContain("private");
});
