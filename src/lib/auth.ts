import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { verifyJWT } from "better-auth/crypto";
import { betterAuth } from "better-auth/minimal";
import { APIError, createAuthMiddleware, getIP, getSessionFromCtx } from "better-auth/api";
import { anonymous } from "better-auth/plugins/anonymous";
import { eq } from "drizzle-orm";
import { isFreshForAccountDeletion, accountDeletionRefusal } from "@/features/account/deletion";
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
import { ACCOUNT_DELETION_USER_RULE, authIpRules, CHANGE_PASSWORD_USER_RULE, CHANGE_EMAIL_USER_RULE, DEMO_CREATION_IP_RULE, EMAIL_LINK_ACCOUNT_RULE, NO_TRUSTED_IP_SUBJECT, normalizeAccountSubject, SIGN_IN_ACCOUNT_RULE, type RateLimitBucket } from "@/features/rate-limit/policy";
import { accountSecurityEmail, emailChangeConfirmation, EMAIL_VERIFICATION_TOKEN_SECONDS, passwordResetEmail, PASSWORD_RESET_TOKEN_SECONDS, passwordChangedEmail, sendEmail, sendEmailAfterResponse, verificationEmail } from "@/features/email";

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

/** Better Auth paths that e-mail a link to the address in the body; each address has its own hourly budget. */
const emailLinkScopes = new Map([
  ["/request-password-reset", "auth:password-reset-account"],
  ["/send-verification-email", "auth:verification-email-account"],
]);

/** Limits Better Auth's per-IP rules cannot express: per account for passwords and e-mailed links, seeded
 * demos per IP, and account-deletion confirmations and password changes per user, which are checked first. */
const authAttemptLimits = createAuthMiddleware(async (ctx) => {
  const buckets: RateLimitBucket[] = [];
  if (ctx.path === "/delete-user") {
    const bucket = await guardAccountDeletion(ctx);
    if (bucket) buckets.push(bucket);
  } else if (ctx.path === "/change-email") {
    const current = await getSessionFromCtx(ctx);
    if (current) {
      if (current.user.isAnonymous || !isFreshForAccountDeletion(new Date(current.session.createdAt))) throw new APIError("FORBIDDEN", { code: "SESSION_NOT_FRESH", message: "Fresh session required." });
      buckets.push({ scope: "auth:change-email", subject: current.user.id, rule: CHANGE_EMAIL_USER_RULE });
      const target = normalizeAccountSubject((ctx.body as { newEmail?: unknown } | undefined)?.newEmail);
      for (const address of new Set([current.user.email, target].filter((value): value is string => Boolean(value)))) buckets.push({ scope: "auth:email-change-address", subject: address, rule: EMAIL_LINK_ACCOUNT_RULE });
    }
  } else if (ctx.path === "/sign-in/email") {
    const account = normalizeAccountSubject((ctx.body as { email?: unknown } | undefined)?.email);
    if (account) buckets.push({ scope: "auth:sign-in-account", subject: account, rule: SIGN_IN_ACCOUNT_RULE });
  } else if (emailLinkScopes.has(ctx.path)) {
    // Counted whether or not the account exists, so a denial reveals nothing about the address.
    const account = normalizeAccountSubject((ctx.body as { email?: unknown } | undefined)?.email);
    if (account) buckets.push({ scope: emailLinkScopes.get(ctx.path)!, subject: account, rule: EMAIL_LINK_ACCOUNT_RULE });
  } else if (ctx.path === "/change-password") {
    // Better Auth answers an unauthenticated request with its own 401.
    const current = await getSessionFromCtx(ctx);
    if (current) buckets.push({ scope: "auth:change-password", subject: current.user.id, rule: CHANGE_PASSWORD_USER_RULE });
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
  appName: "Investník",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Reset links are single-use (Better Auth consumes the token with the password change) and short-lived.
    resetPasswordTokenExpiresIn: PASSWORD_RESET_TOKEN_SECONDS,
    // A reset is how a learner locks out whoever knew the old password, so every session ends with it.
    revokeSessionsOnPasswordReset: true,
    // Better Auth answers the same way for unknown addresses; the send runs after the response so timing matches too.
    sendResetPassword: async ({ user, url }) => sendEmailAfterResponse({ ...passwordResetEmail({ to: user.email, url }), userId: user.id }),
    // Opening the reset link proves the learner reads this mailbox.
    onPasswordReset: async ({ user }) => {
      sendEmailAfterResponse({ ...passwordChangedEmail({ to: user.email, origin: env.BETTER_AUTH_URL }), userId: user.id });
      if (!user.emailVerified) await db.update(schema.user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(schema.user.id, user.id));
    },
  },
  // Verification is a reminder, not a gate: a guest who saves progress keeps learning without opening their mailbox.
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: EMAIL_VERIFICATION_TOKEN_SECONDS,
    sendVerificationEmail: async ({ user, url }, request): Promise<void> => {
      const message = { ...verificationEmail({ to: user.email, url }), userId: user.id };
      // Only an authenticated explicit resend may expose delivery failure.
      const explicit = request && new URL(request.url).pathname.endsWith("/send-verification-email");
      const current = explicit ? await auth.api.getSession({ headers: request.headers }) : null;
      if (current) {
        try { await sendEmail(message); }
        catch { throw new APIError("INTERNAL_SERVER_ERROR", { code: "EMAIL_DELIVERY_FAILED", message: "Email delivery failed." }); }
      } else sendEmailAfterResponse(message);
    },
  },
  user: {
    additionalFields: { emailDeliveryEpoch: { type: "date", required: false, input: false, returned: false }, anonymousKind: { type: "string", required: false, input: false } },
    // Deleting the user row cascades every learner-owned row; shared curriculum and market data stay.
    // guardAccountDeletion adds the password and fresh-sign-in requirements.
    deleteUser: { enabled: true },
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
      sendChangeEmailConfirmation: async ({ user, url }) => {
        try { await sendEmail({ ...emailChangeConfirmation({ to: user.email, url }), userId: user.id }); }
        catch { throw new APIError("INTERNAL_SERVER_ERROR", { code: "EMAIL_DELIVERY_FAILED", message: "Email delivery failed." }); }
      },
    },
  },
  socialProviders: socialAuth.socialProviders,
  // Preserve Better Auth's verified-email linking safeguards; no trusted-provider override.
  onAPIError: { errorURL: new URL("/sign-in", env.BETTER_AUTH_URL).href },
  // Counted in Postgres, not per-instance memory, so the limits hold across serverless instances.
  rateLimit: { enabled: true, customRules: authIpRules, customStorage: rateLimiter.betterAuthStorage() },
  // Vercel overwrites X-Forwarded-For with the connecting client's IP, so a client cannot spoof it there.
  // Better Auth trusts only a single-value header; anything else falls back to one shared bucket.
  advanced: { ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } },
  hooks: { before: authAttemptLimits, after: createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/change-password") return;
    const result = ctx.context.returned;
    if (!result || typeof result !== "object" || !("user" in result)) return;
    const current = ctx.context.session;
    if (current) sendEmailAfterResponse({ ...passwordChangedEmail({ to: current.user.email, origin: env.BETTER_AUTH_URL }), userId: current.user.id });
  }) },
  databaseHooks: {
    // The guest client asks for a guest explicitly; every other anonymous sign-in stays a demo.
    // Choosing "guest" grants nothing: it only skips the demo seed and open Lab access.
    user: { create: { before: async (user, ctx) => {
      if (!user.isAnonymous) return { data: user };
      return { data: { ...user, anonymousKind: ctx?.headers?.get(GUEST_KIND_HEADER) === "guest" ? "guest" : "demo" } };
    } }, update: { before: async (data, ctx) => {
      if (typeof data.email === "string" && ctx?.path === "/verify-email") return { data: { ...data, emailDeliveryEpoch: new Date() } };
    }, after: async (updated, ctx) => {
      // Better Auth has already authenticated this verification JWT and committed the email update.
      // Verify again before selecting the old notification recipient, including logged-out link visits.
      if (ctx?.path !== "/verify-email" || typeof ctx.query?.token !== "string") return;
      const payload = await verifyJWT<{ email?: string; updateTo?: string; requestType?: string }>(ctx.query.token, env.BETTER_AUTH_SECRET).catch(() => null);
      if (payload?.requestType !== "change-email-verification" || !payload.email || payload.updateTo !== updated.email || payload.email === updated.email) return;
      sendEmailAfterResponse({ ...accountSecurityEmail({ to: payload.email, origin: env.BETTER_AUTH_URL, kind: "email-changed" }), userId: updated.id });
    } } },
    account: { create: { after: async (linked) => {
      if (linked.providerId !== "google" && linked.providerId !== "facebook") return;
      const owner = await db.query.user.findFirst({ where: eq(schema.user.id, linked.userId) });
      if (!owner || owner.isAnonymous) return;
      const accounts = await db.query.account.findMany({ where: eq(schema.account.userId, linked.userId), columns: { id: true } });
      if (accounts.length > 1) sendEmailAfterResponse({ ...accountSecurityEmail({ to: owner.email, origin: env.BETTER_AUTH_URL, kind: "social-linked", provider: linked.providerId }), userId: owner.id });
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
