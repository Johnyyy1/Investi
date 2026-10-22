import nextEnv from "@next/env";
import { emailEnvironmentSchema } from "../src/features/email/config";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");
const input = Object.fromEntries(Object.entries(process.env).map(([key, value]) => [key, value === "" ? undefined : value]));
const result = emailEnvironmentSchema.safeParse(input);
if (!result.success) {
  // Zod's full error serialization can include input values. Print only our fixed messages.
  console.error(`Invalid e-mail configuration: ${result.error.issues.map((issue) => issue.message).join("; ")}`);
  process.exitCode = 1;
}
