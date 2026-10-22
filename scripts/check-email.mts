import nextEnv from "@next/env";
import { checkEmailDomain } from "../src/features/email/check";

// Same .env* resolution as Next, without importing auth or opening a database connection.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");
try {
  await checkEmailDomain({ apiKey: process.env.RESEND_API_KEY ?? "", from: process.env.EMAIL_FROM ?? "" });
  console.log("email:check: sender domain is verified in Resend. No e-mail was sent.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "email:check failed.");
  process.exitCode = 1;
}
