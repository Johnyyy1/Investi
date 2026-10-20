import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** A rendered transactional e-mail; `kind` names the template for logs and QA, never the recipient. */
export interface EmailMessage {
  readonly kind: "password-reset" | "email-verification";
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface EmailTransport {
  readonly name: "resend" | "outbox" | "unconfigured";
  send(message: EmailMessage): Promise<void>;
}

/** Normalized failure: carries the transport and HTTP status, never the address, key or provider body. */
export class EmailDeliveryError extends Error {
  constructor(readonly transport: EmailTransport["name"], readonly kind: EmailMessage["kind"], readonly status?: number) {
    super(`E-mail "${kind}" could not be sent through ${transport}${status ? ` (HTTP ${status})` : ""}.`);
    this.name = "EmailDeliveryError";
  }
}

export const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** RFC 2606 / 6761 names that never receive mail. QA suites sign up such addresses; sending would only bounce. */
export function isReservedTestAddress(address: string) {
  const domain = address.slice(address.lastIndexOf("@") + 1).trim().toLowerCase();
  return /(^|\.)(example\.(com|net|org)|test|invalid|localhost|example)$/.test(domain);
}

/** Resend's REST API; one request per message, retried by nobody so a reset link is never sent twice. */
export function createResendTransport({ apiKey, from, fetch: fetchImpl = fetch }: { apiKey: string; from: string; fetch?: typeof fetch }): EmailTransport {
  return {
    name: "resend",
    async send(message) {
      if (isReservedTestAddress(message.to)) return;
      let response: Response;
      try {
        response = await fetchImpl(RESEND_ENDPOINT, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html, tags: [{ name: "kind", value: message.kind }] }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new EmailDeliveryError("resend", message.kind);
      }
      if (!response.ok) throw new EmailDeliveryError("resend", message.kind, response.status);
    },
  };
}

/** Local QA only: each message becomes one JSON file that browser and persistence suites read back. */
export function createOutboxTransport(directory: string): EmailTransport {
  return {
    name: "outbox",
    async send(message) {
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({ ...message, sentAt: new Date().toISOString() }));
    },
  };
}

/** Without a provider nothing is sent. Development prints the link so the flow stays testable by hand. */
export function createUnconfiguredTransport({ development, log = console }: { development: boolean; log?: Pick<Console, "warn" | "error"> }): EmailTransport {
  return {
    name: "unconfigured",
    async send(message) {
      if (development) {
        log.warn(`[investi:email] RESEND_API_KEY or EMAIL_FROM is not set; "${message.kind}" was not sent.\n${message.text}`);
        return;
      }
      log.error(`[investi:email] RESEND_API_KEY or EMAIL_FROM is not set; "${message.kind}" was not sent.`);
    },
  };
}

export interface EmailConfig {
  readonly resendApiKey?: string;
  readonly from?: string;
  readonly outboxDir?: string;
  readonly development: boolean;
}

/** Resend when fully configured, else the QA outbox when one is set, else the logging fallback. */
export function selectEmailTransport(config: EmailConfig, fetchImpl?: typeof fetch): EmailTransport {
  if (config.resendApiKey && config.from) return createResendTransport({ apiKey: config.resendApiKey, from: config.from, fetch: fetchImpl });
  if (config.outboxDir) return createOutboxTransport(config.outboxDir);
  return createUnconfiguredTransport({ development: config.development });
}
