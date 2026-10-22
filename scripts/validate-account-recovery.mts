import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, inArray, like } from "drizzle-orm";

/**
 * Password reset, e-mail verification and password change through the real Better Auth handler on a
 * disposable local database. E-mails land in a temporary outbox, never at Resend. Checks: identical answers
 * for known and unknown addresses, single-use 30-minute reset tokens, sessions revoked by a reset, expired
 * links refused, verification, password change with session revocation, and the per-address/per-user limits.
 */
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname), "Requires a local database.");
// .env may hold a real Resend key; this suite must only ever write to its own outbox.
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;
const outbox = await mkdtemp(join(tmpdir(), "investi-recovery-outbox-"));
process.env.EMAIL_OUTBOX_DIR = outbox;
process.env.EMAIL_TRANSPORT = "outbox";

const { db } = await import("../src/db");
const { account, rateLimitBucket, session, user, verification } = await import("../src/db/schema");
const { auth } = await import("../src/lib/auth");
const { rateLimiter } = await import("../src/features/rate-limit");
const { CHANGE_PASSWORD_USER_RULE, EMAIL_LINK_ACCOUNT_RULE } = await import("../src/features/rate-limit/policy");
const { PASSWORD_RESET_TOKEN_SECONDS } = await import("../src/features/email/templates");

const run = `recovery-${randomUUID().replaceAll("-", "").slice(0, 10)}`;
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const net = `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
let nextIp = 1;
const usedIps: string[] = [];
const freshIp = () => { const ip = `${net}.${nextIp++}`; usedIps.push(ip); return ip; };
const accountSubjects: string[] = [];
const email = (label: string) => { const address = `${run}-${label}@example.com`; accountSubjects.push(address); return address; };

const calledPaths = new Set<string>();
async function call(path: string, { body, cookie, ip = freshIp(), method = body ? "POST" : "GET" }: { body?: unknown; cookie?: string; ip?: string; method?: string } = {}) {
  const url = new URL(path.startsWith("http") ? path : `${baseURL}/api/auth${path}`);
  calledPaths.add(url.pathname.replace(/^\/api\/auth/, ""));
  return auth.handler(new Request(url, {
    method,
    redirect: "manual",
    headers: { "content-type": "application/json", origin: baseURL, "x-forwarded-for": ip, ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }));
}
const sessionCookie = (response: Response) => response.headers.getSetCookie().map((value) => value.split(";")[0]).find((value) => value.includes("session_token="));

type Sent = { kind: string; to: string; text: string };
const seen = new Set<string>();
/** Messages that arrived since the last read; sending runs after the response, so wait briefly. */
async function newMail(expected: number) {
  const deadline = Date.now() + 3_000;
  let fresh: Sent[] = [];
  do {
    for (const file of (await readdir(outbox)).sort()) {
      if (seen.has(file)) continue;
      seen.add(file);
      fresh.push(JSON.parse(await readFile(join(outbox, file), "utf8")) as Sent);
    }
    if (fresh.length >= expected) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  if (expected === 0) await new Promise((resolve) => setTimeout(resolve, 300)).then(async () => {
    for (const file of await readdir(outbox)) if (!seen.has(file)) { seen.add(file); fresh = [...fresh, JSON.parse(await readFile(join(outbox, file), "utf8")) as Sent]; }
  });
  return fresh;
}
const linkIn = (mail: Sent) => mail.text.match(/https?:\/\/\S+/)?.[0] ?? assert.fail("e-mail without a link");

async function signUp(address: string, password: string) {
  const response = await call("/sign-up/email", { body: { name: "Recovery QA", email: address, password, callbackURL: "/verify-email" } });
  assert.equal(response.status, 200, "sign-up succeeds");
  const created = await db.query.user.findFirst({ where: eq(user.email, address) });
  assert.ok(created);
  return { id: created.id, cookie: sessionCookie(response)! };
}
const signIn = (address: string, password: string) => call("/sign-in/email", { body: { email: address, password } });

try {
  // 1. Sign-up sends one verification e-mail; its link verifies the address and lands on /verify-email.
  const learner = email("learner");
  const { id: learnerId, cookie: firstCookie } = await signUp(learner, "first-password-1");
  const [verificationMail, ...extraSignUpMail] = await newMail(1);
  assert.equal(extraSignUpMail.length, 0);
  assert.deepEqual([verificationMail.kind, verificationMail.to], ["email-verification", learner]);
  assert.equal((await db.query.user.findFirst({ where: eq(user.id, learnerId) }))?.emailVerified, false);
  const verified = await call(linkIn(verificationMail));
  assert.equal(verified.status, 302);
  assert.equal(new URL(verified.headers.get("location")!, baseURL).pathname, "/verify-email");
  assert.equal((await db.query.user.findFirst({ where: eq(user.id, learnerId) }))?.emailVerified, true, "the link verifies the address");
  const resend = await call("/send-verification-email", { body: { email: learner, callbackURL: "/verify-email" }, cookie: firstCookie });
  assert.equal(resend.status, 400, "a verified address gets no second link");

  // 2. Unknown and known addresses get the same answer; only the known one receives mail.
  const unknown = await call("/request-password-reset", { body: { email: email("nobody"), redirectTo: "/reset-password" } });
  const known = await call("/request-password-reset", { body: { email: learner, redirectTo: "/reset-password" } });
  assert.equal(unknown.status, 200); assert.equal(known.status, 200);
  assert.deepEqual(await unknown.json(), await known.json(), "the response does not reveal whether the account exists");
  const [resetMail, ...extraResetMail] = await newMail(1);
  assert.equal(extraResetMail.length, 0, "no e-mail for the unknown address");
  assert.deepEqual([resetMail.kind, resetMail.to], ["password-reset", learner]);

  // 3. The token lives 30 minutes and the e-mailed link hands it to /reset-password.
  const resetLink = new URL(linkIn(resetMail));
  const token = resetLink.pathname.split("/").at(-1)!;
  const stored = await db.query.verification.findFirst({ where: eq(verification.identifier, `reset-password:${token}`) });
  assert.ok(stored);
  const lifetime = (stored.expiresAt.getTime() - Date.now()) / 1_000;
  assert.ok(lifetime > PASSWORD_RESET_TOKEN_SECONDS - 60 && lifetime <= PASSWORD_RESET_TOKEN_SECONDS, `token lifetime ${lifetime}s`);
  const landing = await call(resetLink.href);
  assert.equal(landing.status, 302);
  const landed = new URL(landing.headers.get("location")!, baseURL);
  assert.deepEqual([landed.pathname, landed.searchParams.get("token")], ["/reset-password", token]);

  // 4. Resetting ends every session, swaps the password and consumes the token.
  const secondCookie = sessionCookie(await signIn(learner, "first-password-1"));
  assert.ok(secondCookie);
  assert.ok((await db.select().from(session).where(eq(session.userId, learnerId))).length >= 2);
  assert.equal((await call("/reset-password", { body: { newPassword: "short", token } })).status, 400, "the new password still needs 8 characters");
  assert.equal((await call("/reset-password", { body: { newPassword: "second-password-2", token } })).status, 200);
  assert.equal((await db.select().from(session).where(eq(session.userId, learnerId))).length, 0, "a reset revokes every session");
  assert.equal(await (await call("/get-session", { cookie: secondCookie })).json(), null, "a session from before the reset no longer works");
  assert.equal((await signIn(learner, "first-password-1")).status, 401, "the old password stops working");
  assert.equal((await signIn(learner, "second-password-2")).status, 200, "the new password works");
  const reused = await call("/reset-password", { body: { newPassword: "third-password-3", token } });
  assert.equal(reused.status, 400);
  assert.equal(((await reused.json()) as { code?: string }).code, "INVALID_TOKEN", "a reset token works once");
  const reusedLanding = new URL((await call(resetLink.href)).headers.get("location")!, baseURL);
  assert.equal(reusedLanding.searchParams.get("error"), "INVALID_TOKEN", "a used link lands on the expired-link screen");

  assert.deepEqual((await newMail(1)).map(({ kind, to }) => ({ kind, to })), [{ kind: "password-changed", to: learner }]);

  // 5. An expired token is refused, both from the e-mail link and on submit.
  await call("/request-password-reset", { body: { email: learner, redirectTo: "/reset-password" } });
  const expiredLink = new URL(linkIn((await newMail(1))[0]));
  const expiredToken = expiredLink.pathname.split("/").at(-1)!;
  await db.update(verification).set({ expiresAt: new Date(Date.now() - 1_000) }).where(eq(verification.identifier, `reset-password:${expiredToken}`));
  assert.equal(new URL((await call(expiredLink.href)).headers.get("location")!, baseURL).searchParams.get("error"), "INVALID_TOKEN");
  assert.equal((await call("/reset-password", { body: { newPassword: "third-password-3", token: expiredToken } })).status, 400);
  assert.equal((await signIn(learner, "second-password-2")).status, 200, "an expired token changes nothing");

  // 6. Resetting proves the mailbox: an unverified address becomes verified.
  const unverified = email("unverified");
  const { id: unverifiedId } = await signUp(unverified, "first-password-1");
  await newMail(1);
  await call("/request-password-reset", { body: { email: unverified, redirectTo: "/reset-password" } });
  const unverifiedToken = new URL(linkIn((await newMail(1))[0])).pathname.split("/").at(-1)!;
  assert.equal((await call("/reset-password", { body: { newPassword: "second-password-2", token: unverifiedToken } })).status, 200);
  assert.equal((await db.query.user.findFirst({ where: eq(user.id, unverifiedId) }))?.emailVerified, true);

  assert.equal((await newMail(1))[0].kind, "password-changed");

  // 7. Password change needs the current password and can sign out every other session.
  const changer = email("changer");
  const { id: changerId, cookie: changerCookie } = await signUp(changer, "first-password-1");
  await newMail(1);
  const otherCookie = sessionCookie(await signIn(changer, "first-password-1"))!;
  const wrong = await call("/change-password", { body: { currentPassword: "not-the-password", newPassword: "second-password-2" }, cookie: changerCookie });
  assert.equal(wrong.status, 400);
  assert.equal(((await wrong.json()) as { code?: string }).code, "INVALID_PASSWORD");
  assert.equal((await call("/change-password", { body: { currentPassword: "first-password-1", newPassword: "second-password-2" } })).status, 401, "a session is required");
  const changed = await call("/change-password", { body: { currentPassword: "first-password-1", newPassword: "second-password-2", revokeOtherSessions: true }, cookie: changerCookie });
  assert.equal(changed.status, 200);
  const renewedCookie = sessionCookie(changed);
  assert.ok(renewedCookie, "the current device gets a fresh session");
  assert.equal(await (await call("/get-session", { cookie: otherCookie })).json(), null, "other devices are signed out");
  assert.ok(await (await call("/get-session", { cookie: renewedCookie })).json(), "this device stays signed in");
  assert.equal((await db.select().from(session).where(eq(session.userId, changerId))).length, 1);
  assert.equal((await signIn(changer, "second-password-2")).status, 200);

  assert.deepEqual((await newMail(1)).map(({ kind, to }) => ({ kind, to })), [{ kind: "password-changed", to: changer }]);

  // Address changes preserve the old address until all required approvals have completed.
  for (const verified of [true, false]) {
    const oldAddress = email(`change-${verified}`), newAddress = email(`changed-${verified}`);
    const { id, cookie } = await signUp(oldAddress, "first-password-1");
    const [initial] = await newMail(1);
    if (verified) await call(linkIn(initial));
    const response = await call("/change-email", { cookie, body: { newEmail: newAddress, callbackURL: "/verify-email" } });
    assert.equal(response.status, 200);
    const [first] = await newMail(1);
    assert.equal(first.to, verified ? oldAddress : newAddress);
    assert.equal((await db.query.user.findFirst({ where: eq(user.id, id) }))?.email, oldAddress);
    let approval = first;
    if (verified) {
      assert.equal(first.kind, "email-change-confirmation");
      await call(linkIn(first));
      [approval] = await newMail(1);
      assert.equal(approval.to, newAddress);
      assert.equal((await db.query.user.findFirst({ where: eq(user.id, id) }))?.email, oldAddress);
    }
    await call(linkIn(approval));
    const updated = await db.query.user.findFirst({ where: eq(user.id, id) });
    assert.equal(updated?.email, newAddress);
    assert.equal(updated?.emailVerified, true);
    assert.deepEqual((await newMail(1)).map(({ kind, to }) => ({ kind, to })), [{ kind: "email-changed", to: oldAddress }]);
    assert.equal((await signIn(oldAddress, "first-password-1")).status, 401);
    assert.equal((await signIn(newAddress, "first-password-1")).status, 200);
  }

  // A stale session cannot initiate an address change or set a social account's first password.
  const socialAddress = email("social");
  const { id: socialId, cookie: socialCookie } = await signUp(socialAddress, "first-password-1");
  await newMail(1);
  await db.delete(account).where(eq(account.userId, socialId));
  const adapter = (await auth.$context).internalAdapter;
  await adapter.createAccount({ userId: socialId, providerId: "google", accountId: `google-${run}` });
  assert.equal((await newMail(0)).length, 0, "first social login is not linking");
  await adapter.createAccount({ userId: socialId, providerId: "facebook", accountId: `facebook-${run}` });
  assert.deepEqual((await newMail(1)).map(({ kind, to }) => ({ kind, to })), [{ kind: "social-linked", to: socialAddress }]);
  const { POST: setPassword } = await import("../src/app/api/account/password/route");
  const setFirstPassword = (cookie = socialCookie, origin = new URL(baseURL).origin) => setPassword(new Request(`${baseURL}/api/account/password`, { method: "POST", headers: { cookie, origin, "content-type": "application/json" }, body: JSON.stringify({ newPassword: "social-password-1" }) }));
  assert.equal((await setFirstPassword("", baseURL)).status, 401);
  assert.equal((await setFirstPassword(socialCookie, "https://untrusted.test")).status, 403);
  await db.update(session).set({ createdAt: new Date(Date.now() - 11 * 60_000) }).where(eq(session.userId, socialId));
  assert.equal((await call("/change-email", { cookie: socialCookie, body: { newEmail: email("refused") } })).status, 403);
  assert.equal((await setFirstPassword()).status, 403);
  await db.update(session).set({ createdAt: new Date() }).where(eq(session.userId, socialId));
  assert.equal((await setFirstPassword()).status, 200);
  assert.equal((await newMail(1))[0].kind, "password-changed");
  assert.equal((await setFirstPassword()).status, 400, "cannot overwrite an existing password");
  assert.equal((await signIn(socialAddress, "social-password-1")).status, 200);

  // 8. Current-password guesses are limited per user, whichever IPs they come from.
  const guesser = email("guesser");
  const { cookie: guesserCookie } = await signUp(guesser, "first-password-1");
  await newMail(1);
  const guesses: number[] = [];
  for (let attempt = 0; attempt <= CHANGE_PASSWORD_USER_RULE.max; attempt++) {
    guesses.push((await call("/change-password", { body: { currentPassword: `guess-${attempt}-password`, newPassword: "second-password-2" }, cookie: guesserCookie })).status);
  }
  assert.deepEqual(guesses, [...Array(CHANGE_PASSWORD_USER_RULE.max).fill(400), 429]);

  // 9. Each address gets at most EMAIL_LINK_ACCOUNT_RULE.max reset e-mails per hour from any IPs, existing or not.
  for (const target of [email("flooded"), email("flooded-unknown")]) {
    const existing = target.includes("unknown") ? null : await signUp(target, "first-password-1");
    if (existing) await newMail(1);
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= EMAIL_LINK_ACCOUNT_RULE.max; attempt++) statuses.push((await call("/request-password-reset", { body: { email: target, redirectTo: "/reset-password" } })).status);
    assert.deepEqual(statuses, [...Array(EMAIL_LINK_ACCOUNT_RULE.max).fill(200), 429], `per-address limit for ${existing ? "an existing" : "an unknown"} account`);
    assert.equal((await newMail(existing ? EMAIL_LINK_ACCOUNT_RULE.max : 0)).length, existing ? EMAIL_LINK_ACCOUNT_RULE.max : 0);
  }

  // 10. One IP cannot cycle through addresses either.
  const ip = freshIp();
  const perIp: number[] = [];
  for (let attempt = 0; attempt < 6; attempt++) perIp.push((await call("/request-password-reset", { body: { email: email(`ip-${attempt}`), redirectTo: "/reset-password" }, ip })).status);
  assert.deepEqual(perIp, [200, 200, 200, 200, 200, 429]);

  console.log("Account recovery validation passed: enumeration-safe reset, single-use expiring tokens, session revocation, verification, password change and rate limits.");
} finally {
  const createdIds = (await db.select({ id: user.id }).from(user).where(like(user.email, `${run}-%`))).map(({ id }) => id);
  // Reset tokens store the user id and have no foreign key, so they are removed explicitly.
  if (createdIds.length) await db.delete(verification).where(inArray(verification.value, createdIds));
  await db.delete(user).where(like(user.email, `${run}-%`));
  const keys = [
    ...usedIps.flatMap((ip) => [...calledPaths].map((path) => rateLimiter.keyFor(`auth:${path}`, ip))),
    ...createdIds.flatMap((id) => ["auth:change-password", "auth:change-email", "auth:set-password"].map((scope) => rateLimiter.keyFor(scope, id))),
    ...accountSubjects.flatMap((address) => ["auth:sign-in-account", "auth:password-reset-account", "auth:verification-email-account", "auth:email-change-address"].map((scope) => rateLimiter.keyFor(scope, address))),
  ];
  for (let index = 0; index < keys.length; index += 500) await db.delete(rateLimitBucket).where(inArray(rateLimitBucket.key, keys.slice(index, index + 500)));
  await rm(outbox, { recursive: true, force: true });
}
process.exit(0);
