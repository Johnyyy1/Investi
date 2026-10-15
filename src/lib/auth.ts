import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import { anonymous } from "better-auth/plugins/anonymous";
import { eq } from "drizzle-orm";
import { ensureDemoSeed } from "@/features/demo/repository";
import { claimGuestLearning, deleteDemoIdentity } from "@/features/guest/repository";
import { DEMO_SESSION_MS, demoSessionExpiry, GUEST_KIND_HEADER, GUEST_SESSION_MS, isDemoIdentity, isGuestIdentity } from "@/features/guest/identity";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { createSocialAuthConfig } from "@/lib/auth-providers";

const socialAuth = createSocialAuthConfig(env);
export const authProviderAvailability = socialAuth.availability;

export const auth = betterAuth({
  appName: "investi",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  user: { additionalFields: { anonymousKind: { type: "string", required: false, input: false } } },
  socialProviders: socialAuth.socialProviders,
  // Preserve Better Auth's verified-email linking safeguards; no trusted-provider override.
  onAPIError: { errorURL: new URL("/sign-in", env.BETTER_AUTH_URL).href },
  rateLimit: { enabled: true, customRules: { "/sign-in/anonymous": { window: 60, max: 5 } } },
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
