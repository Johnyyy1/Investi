import { randomBytes } from "node:crypto";
import { Webhook } from "svix";
import { describe, expect, it } from "vitest";
import { verifyDeliveryWebhook } from "./webhook";

const secret = `whsec_${randomBytes(32).toString("base64")}`;
const payload = JSON.stringify({ type: "email.bounced", data: { email_id: "message-1", to: ["private@example.com"], subject: "secret token" } });
function signed(body = payload, date = new Date()) {
  return new Headers({ "svix-id": "event-1", "svix-timestamp": String(Math.floor(date.getTime() / 1000)), "svix-signature": new Webhook(secret).sign("event-1", date, body) });
}
describe("Resend webhook", () => {
  it("verifies the raw body and discards personal fields", () => {
    expect(verifyDeliveryWebhook(payload, signed(), secret)).toEqual({ messageId: "message-1", status: "bounced" });
  });
  it("refuses tampering, missing signatures, wrong secrets and stale/future timestamps", () => {
    expect(() => verifyDeliveryWebhook(`${payload} `, signed(), secret)).toThrow();
    expect(() => verifyDeliveryWebhook(payload, new Headers(), secret)).toThrow();
    expect(() => verifyDeliveryWebhook(payload, signed(), `whsec_${randomBytes(32).toString("base64")}`)).toThrow();
    for (const offset of [-600_000, 600_000]) expect(() => verifyDeliveryWebhook(payload, signed(payload, new Date(Date.now() + offset)), secret)).toThrow();
  });
  it("ignores unsupported signed events", () => {
    const body = JSON.stringify({ type: "email.opened", data: { email_id: "message-1" } });
    expect(verifyDeliveryWebhook(body, signed(body), secret)).toBeNull();
  });
});
