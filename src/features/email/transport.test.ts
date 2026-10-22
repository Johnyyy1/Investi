import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createOutboxTransport, createResendTransport, createLogTransport, EmailDeliveryError, isReservedTestAddress, RESEND_ENDPOINT, selectEmailTransport, type EmailMessage } from "./transport";

const message: EmailMessage = { kind: "password-reset", to: "learner@example.cz", subject: "Předmět", text: "Text https://app.test/x", html: "<p>HTML</p>" };

describe("createResendTransport", () => {
  it("posts one message to Resend with the key as a bearer token", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ id: "e1" }), { status: 200 }));
    await createResendTransport({ apiKey: "re_test", from: "Investník <ucet@example.com>", fetch }).send(message);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(RESEND_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "Investník <ucet@example.com>", to: ["learner@example.cz"], subject: "Předmět", text: "Text https://app.test/x", html: "<p>HTML</p>", tags: [{ name: "kind", value: "password-reset" }],
    });
  });

  it("never sends to reserved test domains, which QA sign-ups use", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const transport = createResendTransport({ apiKey: "re_test", from: "a@b.c", fetch });
    for (const to of ["qa@example.com", "qa@sub.example.org", "qa@app.test", "qa@x.invalid", "qa@localhost"]) await transport.send({ ...message, to });
    expect(fetch).not.toHaveBeenCalled();
    expect(isReservedTestAddress("qa@notexample.com")).toBe(false);
    expect(isReservedTestAddress("qa@testing.cz")).toBe(false);
  });

  it("normalizes a rejected request without the address, key or provider body", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("invalid key re_test for learner@example.cz", { status: 403 }));
    const error = await createResendTransport({ apiKey: "re_test", from: "a@b.c", fetch }).send(message).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(error).toMatchObject({ transport: "resend", kind: "password-reset", status: 403 });
    expect(String((error as Error).message)).not.toMatch(/re_test|learner@example\.cz/);
  });

  it("normalizes a network failure", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => { throw new TypeError("fetch failed: learner@example.cz"); });
    const error = await createResendTransport({ apiKey: "re_test", from: "a@b.c", fetch }).send(message).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(String((error as Error).message)).not.toContain("learner@example.cz");
  });
});

describe("createOutboxTransport", () => {
  it("writes each message as one JSON file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "investnik-outbox-"));
    try {
      await createOutboxTransport(join(directory, "nested")).send(message);
      const files = await readdir(join(directory, "nested"));
      expect(files).toHaveLength(1);
      expect(JSON.parse(await readFile(join(directory, "nested", files[0]), "utf8"))).toMatchObject({ kind: "password-reset", to: "learner@example.cz", text: message.text });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("createLogTransport", () => {
  it("prints the message during development so the flow can be finished by hand", async () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    await createLogTransport({ development: true, log }).send(message);
    expect(log.warn.mock.calls[0][0]).toContain("https://app.test/x");
    expect(log.error).not.toHaveBeenCalled();
  });

  it("logs a configuration error in production without the link or the address", async () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    await createLogTransport({ development: false, log }).send(message);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).not.toMatch(/app\.test|learner@example\.cz/);
  });
});

describe("selectEmailTransport", () => {
  it("selects explicitly and never sends just because credentials exist", () => {
    const credentials = { resendApiKey: "re_test", from: "investi <ucet@mail.investnik.cz>", development: false };
    expect(selectEmailTransport(credentials).name).toBe("log");
    expect(selectEmailTransport({ ...credentials, transport: "resend" }).name).toBe("resend");
    expect(selectEmailTransport({ ...credentials, transport: "outbox", outboxDir: "/tmp/x" }).name).toBe("outbox");
    expect(() => selectEmailTransport({ transport: "resend", development: false })).toThrow("Resend requires");
    expect(() => selectEmailTransport({ transport: "outbox", development: false })).toThrow("Outbox requires");
  });

  it("refuses hosted preview Resend and incomplete production regardless of general env validation", () => {
    expect(() => selectEmailTransport({ transport: "resend", vercelEnv: "preview", resendApiKey: "secret", from: "a@b.cz", development: false })).toThrow("Resend is forbidden");
    expect(() => selectEmailTransport({ vercelEnv: "production", development: false })).toThrow("Production requires");
  });
});

it("logs only an allowlisted Resend error name, status and kind", async () => {
  for (const name of ["validation_error", "learner@example.cz", "validation_error\nsecret"]) {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ name, message: "secret token https://private.test", recipient: message.to }, { status: 403 }));
    const error = await createResendTransport({ apiKey: "secret-key", from: "a@b.cz", fetch }).send(message).catch((error: unknown) => error);
    expect(error).toMatchObject({ status: 403, providerCode: name === "validation_error" ? name : "unknown_error" });
    expect(String(error)).not.toMatch(/learner@|secret|private/);
  }
});
