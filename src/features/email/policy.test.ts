import { describe, expect, it } from "vitest";
import { DELIVERY_RETENTION_MS, deliveryStatuses, precedingStatuses, suppressesDelivery } from "./policy";

describe("delivery policy", () => {
  it("is monotonic under replay and out-of-order events", () => {
    for (const status of deliveryStatuses) {
      expect(precedingStatuses(status)).not.toContain(status);
      for (const earlier of precedingStatuses(status)) expect(precedingStatuses(earlier)).not.toContain(status);
    }
    expect(precedingStatuses("delivered")).not.toContain("bounced");
    expect(precedingStatuses("bounced")).toContain("delivered");
  });
  it("suppresses ordinary verification but keeps recovery and all security notices", () => {
    expect(suppressesDelivery("email-verification")).toBe(true);
    for (const kind of ["password-reset", "password-changed", "email-change-confirmation", "email-changed", "social-linked"] as const) expect(suppressesDelivery(kind)).toBe(false);
    expect(DELIVERY_RETENTION_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });
});
