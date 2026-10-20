import "server-only";

import { after } from "next/server";
import { env } from "@/lib/env";
import { EmailDeliveryError, selectEmailTransport, type EmailMessage } from "./transport";

export { passwordResetEmail, verificationEmail, EMAIL_VERIFICATION_TOKEN_SECONDS, PASSWORD_RESET_TOKEN_SECONDS } from "./templates";

const transport = selectEmailTransport({
  resendApiKey: env.RESEND_API_KEY,
  from: env.EMAIL_FROM,
  outboxDir: env.EMAIL_OUTBOX_DIR,
  development: process.env.NODE_ENV === "development",
});

async function deliver(message: EmailMessage) {
  try {
    await transport.send(message);
  } catch (error) {
    // The recipient stays out of logs; the learner can request another link.
    console.error("[investi:email]", error instanceof EmailDeliveryError ? error.message : `E-mail "${message.kind}" could not be sent.`);
  }
}

/**
 * Sends after the response is finished, so a request for an existing account takes as long as one for an
 * unknown address. Outside a request (scripts) the send simply runs on.
 */
export function sendEmailAfterResponse(message: EmailMessage) {
  const delivery = deliver(message);
  try {
    after(delivery);
  } catch {
    void delivery;
  }
}
