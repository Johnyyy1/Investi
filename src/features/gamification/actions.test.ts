import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), initialize: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("./repository", () => ({ initializeTimeZone: mocks.initialize }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { initializeTimeZoneAction } from "./actions";

describe("time-zone initialization", () => {
  let log: MockInstance<typeof console.error>;
  beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "owner" }); log = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => log.mockRestore());

  it("saves a valid zone for the session owner", async () => {
    expect(await initializeTimeZoneAction("Europe/Prague")).toEqual({ ok: true });
    expect(mocks.initialize).toHaveBeenCalledWith("owner", "Europe/Prague");
  });

  it("refuses a zone the server cannot resolve without writing or logging", async () => {
    expect(await initializeTimeZoneAction("Mars/Olympus_Mons")).toEqual({ ok: false });
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("logs a failed write once", async () => {
    mocks.initialize.mockRejectedValue(new Error("connection terminated"));
    expect(await initializeTimeZoneAction("Europe/Prague")).toEqual({ ok: false });
    expect(log.mock.calls).toEqual([["[gamification] initialize time zone failed", { error: { name: "Error", message: "connection terminated" } }]]);
  });
});
