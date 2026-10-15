import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron";

const secret = "s".repeat(40);

describe("isAuthorizedCronRequest", () => {
  it("accepts exactly the bearer secret", () => {
    expect(isAuthorizedCronRequest(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("refuses a missing, wrong or differently formatted header", () => {
    expect(isAuthorizedCronRequest(null, secret)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isAuthorizedCronRequest(secret, secret)).toBe(false);
    expect(isAuthorizedCronRequest(`bearer ${secret}`, secret)).toBe(false);
  });

  it("refuses everything when no secret is configured", () => {
    expect(isAuthorizedCronRequest("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer undefined", undefined)).toBe(false);
  });
});
