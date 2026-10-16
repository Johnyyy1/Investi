import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import { APIError, createAuthMiddleware, getIP, getSessionFromCtx } from "better-auth/api";
import { anonymous } from "better-auth/plugins/anonymous";
import { eq } from "drizzle-orm";
import { accountDeletionRefusal } from "@/features/account/deletion";
import { hasPasswordCredential } from "@/features/account/repository";
import { ensureDemoSeed } from "@/features/demo/repository";
import { claimGuestLearning, deleteDemoIdentity } from "@/features/guest/repository";
import { DEMO_SESSION_MS, demoSessionExpiry, GUEST_KIND_HEADER, GUEST_SESSION_MS, isDemoIdentity, isGuestIdentity } from "@/features/guest/identity";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { createSocialAuthConfig } from "@/lib/auth-providers";
import { rateLimiter } from "@/features/rate-limit";
import { ACCOUNT_DELETION_USER_RULE, authIpRules, DEMO_CREATION_IP_RULE, NO_TRUSTED_IP_SUBJECT, normalizeAccountSubject, SIGN_IN_ACCOUNT_RULE, type RateLimitBucket } from "@/features/rate-limit/policy";

const socialAuth = createSocialAuthConfig(env);
export const authProviderAvailability = socialAuth.availability;

/** Session, password and freshness requirements for /delete-user, on top of Better Auth's own checks. */
async function guardAccountDeletion(ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]) {
  const current = await getSessionFromCtx(ctx);
  // Better Auth's session middleware answers an unauthenticated request with its own 401.
  if (!current) return null;
  const body = (ctx.body ?? {}) as { password?: unknown; token?: unknown };
  const refusal = accountDeletionRefusal({
    isAnonymous: current.user.isAnonymous === true,
    hasPassword: await hasPasswordCredential(current.user.id),
    passwordProvided: typeof body.password === "string" && body.password.length > 0,
    tokenProvided: body.token !== undefined,
    sessionCreatedAt: new Date(current.session.createdAt),
  });
  if (refusal) throw new APIError(refusal === "ANONYMOUS_IDENTITY" ? "FORBIDDEN" : "BAD_REQUEST", { message: "Account deletion was refused.", code: refusal });
  return { scope: "auth:delete-account", subject: current.user.id, rule: ACCOUNT_DELETION_USER_RULE } satisfies RateLimitBucket;
}

/** Limits Better Auth's per-IP rules cannot express: per account for passwords, seeded demos per IP and
 * account-deletion confirmations per user, which are checked first. */
const authAttemptLimits = createAuthMiddleware(async (ctx) => {
  const buckets: RateLimitBucket[] = [];
  if (ctx.path === "/delete-user") {
    const bucket = await guardAccountDeletion(ctx);
    if (bucket) buckets.push(bucket);
  } else if (ctx.path === "/sign-in/email") {
    const account = normalizeAccountSubject((ctx.body as { email?: unknown } | undefined)?.email);
    if (account) buckets.push({ scope: "auth:sign-in-account", subject: account, rule: SIGN_IN_ACCOUNT_RULE });
  } else if (ctx.path === "/sign-in/anonymous" && ctx.headers?.get(GUEST_KIND_HEADER) !== "guest") {
    const ip = ctx.headers ? getIP(ctx.headers, ctx.context.options) : null;
    buckets.push({ scope: "auth:demo-creation", subject: ip ?? NO_TRUSTED_IP_SUBJECT, rule: DEMO_CREATION_IP_RULE });
  }
  const decision = await rateLimiter.consume(buckets);
  if (!decision.allowed) {
    const retryAfter = String(decision.retryAfterSeconds);
    throw new APIError("TOO_MANY_REQUESTS", { message: "Too many requests. Please try again later." }, { "X-Retry-After": retryAfter, "Retry-After": retryAfter });
  }
});

export const auth = betterAuth({
  appName: "investi",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: { anonymousKind: { type: "string", required: false, input: false } },
    // Deleting the user row cascades every learner-owned row; shared curriculum and market data stay.
    // guardAccountDeletion adds the password and fresh-sign-in requirements.
    deleteUser: { enabled: true },
  },
  socialProviders: socialAuth.socialProviders,
  // Preserve Better Auth's verified-email linking safeguards; no trusted-provider override.
  onAPIError: { errorURL: new URL("/sign-in", env.BETTER_AUTH_URL).href },
  // Counted in Postgres, not per-instance memory, so the limits hold across serverless instances.
  rateLimit: { enabled: true, customRules: authIpRules, customStorage: rateLimiter.betterAuthStorage() },
  // Vercel overwrites X-Forwarded-For with the connecting client's IP, so a client cannot spoof it there.
  // Better Auth trusts only a single-value header; anything else falls back to one shared bucket.
  advanced: { ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } },
  hooks: { before: authAttemptLimits },
  databaseHooks: {
    // The guest client asks for a guest explicitly; every other anonymous sign-in stays a demo.
    // Choosing "guest" grants nothing: it only skips the demo seed and open Lab access.
    user: { create: { before: async (user, ctx) => {
      if (!user.isAnonymous) return { data: user };
      return { data: { ...user, anonymousKind: ctx?.headers?.get(GUEST_KIND_HEADER) === "guest" ? "guest" : "demo" } };
    } } },
    session: { create: { before: async (session) => {
      const owner = await db.query.user.findFirst({ where: eq(schema.user.id, session.userId) });
      if (!owner?.isAnonymous) return { data: session };
      if (isGuestIdentity(owner)) return { data: { ...session, expiresAt: new Date(Date.now() + GUEST_SESSION_MS) } };
      await ensureDemoSeed(owner.id);
      return { data: { ...session, expiresAt: new Date(Date.now() + DEMO_SESSION_MS) } };
    } }, update: { before: async (data, ctx) => {
      // A refresh runs with the session it refreshes in context. A demo keeps its fixed end; returning
      // false instead would make Better Auth treat the refresh as failed and sign the demo out early.
      const current = ctx?.context.session;
      if (!data.expiresAt || !current || !isDemoIdentity(current.user as { isAnonymous?: boolean | null; anonymousKind?: string | null })) return { data };
      return { data: { ...data, expiresAt: demoSessionExpiry(new Date(current.session.createdAt), new Date(data.expiresAt)) } };
    } } },
  },
  plugins: [anonymous({
    generateName: () => "Alex",
    // We delete the anonymous user ourselves, so a failed guest claim never cascades the guest's learning away.
    disableDeleteAnonymousUser: true,
    // Runs after the account exists. Guest learning moves to the account in one transaction that also
    // deletes the guest; demo sample data is never transferred and the demo is deleted as before.
    onLinkAccount: async ({ anonymousUser, newUser }) => {
      if (anonymousUser.user.id === newUser.user.id) return;
      try {
        if (isGuestIdentity(anonymousUser.user)) await claimGuestLearning(anonymousUser.user.id, newUser.user.id);
        else await deleteDemoIdentity(anonymousUser.user.id);
      } catch (error) {
        // The account is created either way; unclaimed guest data stays until anonymous cleanup.
        console.error("Anonymous identity could not be linked.", error instanceof Error ? error.message : "unknown");
      }
    },
  }), nextCookies()],
});
