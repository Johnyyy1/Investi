import { z } from "zod";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { isFreshForAccountDeletion } from "@/features/account/deletion";
import { rateLimiter } from "@/features/rate-limit";
import { CHANGE_PASSWORD_USER_RULE } from "@/features/rate-limit/policy";
import { passwordChangedEmail, sendEmailAfterResponse } from "@/features/email";

/** Better Auth's setPassword is server-only; this wrapper supplies authentication, freshness, CSRF and limits. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== new URL(env.BETTER_AUTH_URL).origin) return Response.json({ code: "INVALID_ORIGIN" }, { status: 403, headers });
  const current = await auth.api.getSession({ headers: request.headers });
  if (!current || current.user.isAnonymous) return Response.json({ code: "UNAUTHORIZED" }, { status: 401, headers });
  if (!isFreshForAccountDeletion(new Date(current.session.createdAt))) return Response.json({ code: "SESSION_NOT_FRESH" }, { status: 403, headers });
  const budget = await rateLimiter.consume([{ scope: "auth:set-password", subject: current.user.id, rule: CHANGE_PASSWORD_USER_RULE }]);
  if (!budget.allowed) return Response.json({ code: "TOO_MANY_REQUESTS" }, { status: 429, headers: { ...headers, "Retry-After": String(budget.retryAfterSeconds) } });
  const body = z.object({ newPassword: z.string().min(8).max(128) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ code: "INVALID_PASSWORD_LENGTH" }, { status: 400, headers });
  try {
    await auth.api.setPassword({ headers: request.headers, body: body.data });
    sendEmailAfterResponse(passwordChangedEmail({ to: current.user.email, origin: env.BETTER_AUTH_URL }));
    return Response.json({ status: true }, { headers });
  } catch {
    // Never reflect a provider exception or password. setPassword refuses accounts with an existing password.
    return Response.json({ code: "SET_PASSWORD_FAILED" }, { status: 400, headers });
  }
}
