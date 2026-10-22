import { describe, expect, it } from "vitest";
import { emailEnvironmentSchema, senderDomain } from "./config";

const resend = { EMAIL_TRANSPORT: "resend", RESEND_API_KEY: "secret", EMAIL_FROM: "investi <ucet@mail.investnik.cz>" };

describe("e-mail environment", () => {
  it("defaults to safe logging locally and in previews even with credentials", () => {
    expect(emailEnvironmentSchema.parse({}).EMAIL_TRANSPORT).toBe("log");
    expect(emailEnvironmentSchema.parse({ ...resend, EMAIL_TRANSPORT: undefined, VERCEL_ENV: "preview" }).EMAIL_TRANSPORT).toBe("log");
  });
  it.each([{}, { EMAIL_TRANSPORT: "log" }, { EMAIL_TRANSPORT: "outbox", EMAIL_OUTBOX_DIR: "/tmp/x" }, { ...resend, EMAIL_FROM: undefined }, { ...resend, RESEND_API_KEY: undefined }])("refuses incomplete production configuration %j", (config) => {
    expect(emailEnvironmentSchema.safeParse({ ...config, VERCEL_ENV: "production" }).success).toBe(false);
  });
  it("accepts complete production Resend and refuses preview Resend", () => {
    expect(emailEnvironmentSchema.safeParse({ ...resend, VERCEL_ENV: "production" }).success).toBe(true);
    expect(emailEnvironmentSchema.safeParse({ ...resend, VERCEL_ENV: "preview" }).success).toBe(false);
    expect(emailEnvironmentSchema.safeParse({ EMAIL_TRANSPORT: "outbox" }).success).toBe(false);
  });
  it("checks a single sender mailbox without exposing its value in errors", () => {
    expect(senderDomain("investi <ucet@MAIL.investnik.cz>")).toBe("mail.investnik.cz");
    expect(senderDomain("ucet@mail.investnik.cz")).toBe("mail.investnik.cz");
    for (const from of ["bad", "a@b.cz, c@d.cz", "x <a@b.cz>\r\nBcc: x@y.cz"]) expect(senderDomain(from)).toBeNull();
  });
});
