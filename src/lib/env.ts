import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    /** Bearer secret Vercel Cron sends to scheduled jobs; without it the cron endpoints refuse every request. */
    CRON_SECRET: z.string().min(32).optional(),
    DATABASE_URL: z.url(),
    /** Resend API key for password-reset and verification e-mails; without it (or EMAIL_FROM) nothing is sent. */
    RESEND_API_KEY: z.string().trim().min(1).optional(),
    /** Sender on a domain verified in Resend, e.g. "investi <ucet@example.com>". */
    EMAIL_FROM: z.string().trim().min(3).optional(),
    /** Local QA only: write e-mails as JSON files here instead of sending them. Ignored when Resend is configured. */
    EMAIL_OUTBOX_DIR: z.string().trim().min(1).optional(),
    GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
    FACEBOOK_CLIENT_ID: z.string().trim().min(1).optional(),
    FACEBOOK_CLIENT_SECRET: z.string().trim().min(1).optional(),
    DETERMINISTIC_MARKET_NOW: z.string().datetime().optional(),
    FMP_API_KEY: z.string().min(1).optional(),
    FX_DATA_PROVIDER: z.enum(["deterministic", "cnb", "frankfurter"]).optional(),
    MARKET_DATA_PROVIDER: z.enum(["deterministic", "fmp"]).default("deterministic"),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  emptyStringAsUndefined: true,
});
