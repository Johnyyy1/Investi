import { describe, expect, it } from "vitest";
import { DEMO_SESSION_MS, demoSessionExpiry, isDemoIdentity, isGuestIdentity } from "./identity";

const started = new Date("2026-10-15T10:00:00Z");
const end = new Date(started.getTime() + DEMO_SESSION_MS);

describe("demoSessionExpiry", () => {
  it("caps a refresh at 24 hours after the demo started", () => {
    expect(demoSessionExpiry(started, new Date("2026-10-22T09:00:00Z"))).toEqual(end);
  });

  it("keeps an earlier requested expiry", () => {
    const earlier = new Date("2026-10-15T20:00:00Z");
    expect(demoSessionExpiry(started, earlier)).toEqual(earlier);
  });

  it("never extends a demo that is already past its end", () => {
    expect(demoSessionExpiry(started, new Date("2026-10-30T00:00:00Z")).getTime()).toBe(started.getTime() + 24 * 60 * 60 * 1000);
  });
});

describe("anonymous kinds", () => {
  it("treats legacy anonymous rows without a kind as demos and never saved accounts", () => {
    expect(isDemoIdentity({ isAnonymous: true, anonymousKind: null })).toBe(true);
    expect(isDemoIdentity({ isAnonymous: true, anonymousKind: "guest" })).toBe(false);
    expect(isDemoIdentity({ isAnonymous: false, anonymousKind: null })).toBe(false);
    expect(isGuestIdentity({ isAnonymous: true, anonymousKind: "guest" })).toBe(true);
  });
});
