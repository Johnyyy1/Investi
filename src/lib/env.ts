import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { emailEnvironmentShape, refineEmailEnvironment } from "@/features/email/config";

export const env = createEnv({
  server: {
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    /** Bearer secret Vercel Cron sends to scheduled jobs; without it the cron endpoints refuse every request. */
    CRON_SECRET: z.string().min(32).optional(),
    DATABASE_URL: z.url(),
    ...emailEnvironmentShape,
    RESEND_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
    GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
    FACEBOOK_CLIENT_ID: z.string().trim().min(1).optional(),
    FACEBOOK_CLIENT_SECRET: z.string().trim().min(1).optional(),
    DETERMINISTIC_MARKET_NOW: z.string().datetime().optional(),
    FMP_API_KEY: z.string().min(1).optional(),
    FX_DATA_PROVIDER: z.enum(["deterministic", "cnb", "frankfurter"]).optional(),
    MARKET_DATA_PROVIDER: z.enum(["deterministic", "fmp"]).default("deterministic"),
  },
  createFinalSchema: (shape, isServer) => z.object(shape).superRefine((values, ctx) => {
    if (isServer) refineEmailEnvironment(values as z.infer<z.ZodObject<typeof emailEnvironmentShape>>, ctx);
  }),
  client: {},
  experimental__runtimeEnv: {},
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true" && process.env.VERCEL_ENV !== "production",
  emptyStringAsUndefined: true,
});
