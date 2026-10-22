import { z } from "zod";

/** Accept a mailbox or a display-name mailbox, never multiple recipients or header injection. */
export function senderDomain(from: string): string | null {
  if (/[\r\n]/.test(from)) return null;
  const mailbox = from.match(/^[^<>]*<([^<>]+)>$/)?.[1] ?? from;
  if (!z.email().safeParse(mailbox.trim()).success) return null;
  return mailbox.trim().split("@")[1].toLowerCase();
}

export const emailEnvironmentShape = {
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  EMAIL_TRANSPORT: z.enum(["resend", "outbox", "log"]).default("log"),
  RESEND_API_KEY: z.string().trim().min(1).optional(),
  EMAIL_FROM: z.string().trim().refine((value) => senderDomain(value) !== null, "EMAIL_FROM must be a single valid sender mailbox").optional(),
  EMAIL_OUTBOX_DIR: z.string().trim().min(1).optional(),
};

type EmailEnvironment = z.infer<z.ZodObject<typeof emailEnvironmentShape>>;

/** Shared by env validation, transport selection and the manual release check. No values enter errors. */
export function refineEmailEnvironment(config: EmailEnvironment, ctx: z.RefinementCtx) {
  const issue = (path: keyof EmailEnvironment, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (config.VERCEL_ENV === "production" && config.EMAIL_TRANSPORT !== "resend") issue("EMAIL_TRANSPORT", "Vercel Production requires EMAIL_TRANSPORT=resend");
  if (config.VERCEL_ENV === "preview" && config.EMAIL_TRANSPORT === "resend") issue("EMAIL_TRANSPORT", "Vercel Preview must use log or outbox; Resend is forbidden");
  if (config.EMAIL_TRANSPORT === "resend") {
    if (!config.RESEND_API_KEY) issue("RESEND_API_KEY", "Resend requires RESEND_API_KEY");
    if (!config.EMAIL_FROM) issue("EMAIL_FROM", "Resend requires EMAIL_FROM");
  }
  if (config.EMAIL_TRANSPORT === "outbox" && !config.EMAIL_OUTBOX_DIR) issue("EMAIL_OUTBOX_DIR", "Outbox requires EMAIL_OUTBOX_DIR");
}

export const emailEnvironmentSchema = z.object(emailEnvironmentShape).superRefine(refineEmailEnvironment);
