import { emailEnvironmentSchema } from "./config";
import { randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** A rendered transactional e-mail; `kind` names the template for logs and QA, never the recipient. */
export interface EmailMessage {
  readonly kind: "password-reset" | "email-verification" | "password-changed" | "email-change-confirmation" | "email-changed" | "social-linked";
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface EmailTransport {
  readonly name: "resend" | "outbox" | "log";
  send(message: EmailMessage): Promise<{ messageId: string } | void>;
}

/** Normalized failure: carries the transport and HTTP status, never the address, key or provider body. */
export class EmailDeliveryError extends Error {
  constructor(readonly transport: EmailTransport["name"], readonly kind: EmailMessage["kind"], readonly status?: number, readonly providerCode?: string) {
    super(`E-mail "${kind}" could not be sent through ${transport}${status ? ` (HTTP ${status})` : ""}${providerCode ? ` [${providerCode}]` : ""}.`);
    this.name = "EmailDeliveryError";
  }
}

const SAFE_RESEND_ERROR_NAMES = new Set([
  "validation_error", "missing_required_field", "invalid_access", "invalid_parameter", "invalid_region",
  "invalid_api_key", "restricted_api_key", "missing_api_key", "method_not_allowed", "not_found",
  "rate_limit_exceeded", "daily_quota_exceeded", "monthly_quota_exceeded", "internal_server_error",
  "application_error", "invalid_idempotent_request", "concurrent_idempotent_requests",
]);

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
      if (!response.ok) {
        // Never reflect provider-controlled strings: even the error name could contain personal data.
        const payload: unknown = await response.json().catch(() => null);
        const name = payload && typeof payload === "object" && "name" in payload ? payload.name : undefined;
        const code = typeof name === "string" && SAFE_RESEND_ERROR_NAMES.has(name) ? name : "unknown_error";
        throw new EmailDeliveryError("resend", message.kind, response.status, code);
      }
      const result: unknown = await response.json().catch(() => null);
      const id = result && typeof result === "object" && "id" in result ? result.id : undefined;
      if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(id)) throw new EmailDeliveryError("resend", message.kind, undefined, "invalid_response");
      return { messageId: id };
    },
  };
}

/** Local QA only: each message becomes one JSON file that browser and persistence suites read back. */
export function createOutboxTransport(directory: string): EmailTransport {
  return {
    name: "outbox",
    async send(message) {
      // Outbox-only QA switch. No route can toggle this, and hosted Production cannot select outbox.
      const fail = await access(join(directory, ".force-failure")).then(() => true, () => false);
      if (fail) throw new EmailDeliveryError("outbox", message.kind);
      await mkdir(directory, { recursive: true });
      const messageId = `outbox-${randomUUID()}`;
      await writeFile(join(directory, `${Date.now()}-${messageId}.json`), JSON.stringify({ ...message, providerMessageId: messageId, sentAt: new Date().toISOString() }));
      return { messageId };
    },
  };
}

/** Log links only in local development. Hosted previews log template metadata without personal data. */
export function createLogTransport({ development, log = console }: { development: boolean; log?: Pick<Console, "warn"> }): EmailTransport {
  return {
    name: "log",
    async send(message) {
      log.warn(`[investi:email] EMAIL_TRANSPORT=log; "${message.kind}" was not sent.${development ? `\n${message.text}` : ""}`);
    },
  };
}

export interface EmailConfig {
  readonly transport?: "resend" | "outbox" | "log";
  readonly vercelEnv?: "production" | "preview" | "development";
  readonly resendApiKey?: string;
  readonly from?: string;
  readonly outboxDir?: string;
  readonly development: boolean;
}

/** Credentials never select a transport implicitly. Revalidate here even if general env validation is skipped. */
export function selectEmailTransport(config: EmailConfig, fetchImpl?: typeof fetch): EmailTransport {
  const parsed = emailEnvironmentSchema.safeParse({
    EMAIL_TRANSPORT: config.transport, VERCEL_ENV: config.vercelEnv,
    RESEND_API_KEY: config.resendApiKey, EMAIL_FROM: config.from, EMAIL_OUTBOX_DIR: config.outboxDir,
  });
  if (!parsed.success) throw new Error(`Invalid e-mail configuration: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  const selected = parsed.data;
  if (selected.EMAIL_TRANSPORT === "resend") return createResendTransport({ apiKey: selected.RESEND_API_KEY!, from: selected.EMAIL_FROM!, fetch: fetchImpl });
  if (selected.EMAIL_TRANSPORT === "outbox") return createOutboxTransport(selected.EMAIL_OUTBOX_DIR!);
  return createLogTransport({ development: config.development && !config.vercelEnv });
}
