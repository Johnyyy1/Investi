import "server-only";

import { hasSuppressedEmail, queueDelivery, recordFailed, recordSent } from "./repository";
import { suppressesDelivery } from "./policy";
import { after } from "next/server";
import { env } from "@/lib/env";
import { EmailDeliveryError, selectEmailTransport, type EmailMessage } from "./transport";

export { accountSecurityEmail, emailChangeConfirmation, passwordChangedEmail, passwordResetEmail, verificationEmail, EMAIL_VERIFICATION_TOKEN_SECONDS, PASSWORD_RESET_TOKEN_SECONDS } from "./templates";

const transport = selectEmailTransport({
  transport: env.EMAIL_TRANSPORT,
  vercelEnv: env.VERCEL_ENV,
  resendApiKey: env.RESEND_API_KEY,
  from: env.EMAIL_FROM,
  outboxDir: env.EMAIL_OUTBOX_DIR,
  development: process.env.NODE_ENV === "development",
});

export async function sendEmail(message: EmailMessage & { userId: string }) {
  let deliveryId: string | undefined;
  try {
    if (suppressesDelivery(message.kind) && await hasSuppressedEmail(message.userId, message.to)) throw new EmailDeliveryError(transport.name, message.kind, undefined, "address_suppressed");
    deliveryId = await queueDelivery(message, transport.name);
    const result = await transport.send(message);
    if (!result) throw new EmailDeliveryError(transport.name, message.kind, undefined, "not_sent");
    await recordSent(deliveryId, result.messageId);
  } catch (error) {
    if (deliveryId) await recordFailed(deliveryId, error instanceof EmailDeliveryError ? error.providerCode ?? "transport_error" : "delivery_error").catch(() => undefined);
    // The recipient stays out of logs; the learner can request another link.
    console.error("[investi:email]", error instanceof EmailDeliveryError ? error.message : `E-mail "${message.kind}" could not be sent.`);
    throw new EmailDeliveryError(transport.name, message.kind);
  }
}

/**
 * Sends after the response is finished, so a request for an existing account takes as long as one for an
 * unknown address. Outside a request (scripts) the send simply runs on.
 */
export function sendEmailAfterResponse(message: EmailMessage & { userId: string }) {
  const deliver = () => sendEmail(message).catch(() => undefined);
  try {
    after(deliver);
  } catch {
    void deliver();
  }
}
