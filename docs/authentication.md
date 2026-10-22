# Authentication and social sign-in

Investník uses Better Auth 1.7.3 with the existing Drizzle account, user, session and verification tables. Email/password and anonymous demo authentication, session hooks and rate limits remain unchanged. No schema migration is needed.

## Optional server configuration

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to enable Google, and/or `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET` to enable Facebook. Credentials are validated as optional non-empty strings on the server. Empty values are treated as absent. A missing half of a pair disables that provider entirely; it is never passed partially to Better Auth. Restart the server after changing credentials.

`createSocialAuthConfig` produces Better Auth's `socialProviders` and a boolean availability object from the same credential pairs. Only the booleans cross into the client UI. Never prefix these variables with `NEXT_PUBLIC_`. Email/password and demo remain available without either provider; absent providers and their divider are hidden.

## Provider consoles and callbacks

Use separate development and production applications/credentials. Do not use production credentials in automated tests.

| Provider | Local authorized callback |
| --- | --- |
| Google | `http://localhost:3000/api/auth/callback/google` |
| Facebook | `http://localhost:3000/api/auth/callback/facebook` |

Production callbacks use the canonical origin `https://investnik.cz` with these same paths: `https://investnik.cz/api/auth/callback/google` and `https://investnik.cz/api/auth/callback/facebook`. Set `BETTER_AUTH_URL=https://investnik.cz` in the production environment. `www.investnik.cz` redirects to the apex before auth runs, so it needs no registration. Custom local ports require matching callback registrations. [brand.md](brand.md) has the cutover order from `tryinvesti.vercel.app`.

- **Google Cloud:** configure the OAuth consent screen/audience, create a Web application OAuth client, add the authorized redirect URI and relevant app origin, and add test users while in testing mode. Complete Google's publishing/verification requirements as applicable.
- **Meta Developers:** create/configure an app with Facebook Login, enable web OAuth login, register the exact Valid OAuth Redirect URI, and configure the app domain/site URL. Add app-role testers in development mode. Configure privacy policy/data deletion details and complete the permissions/access and live-mode requirements shown in the console before public launch. If the console requires HTTPS for your development setup, register a development HTTPS origin and use it consistently in `BETTER_AUTH_URL`.

Better Auth's built-in scopes request Google identity/email/profile and Facebook email/public profile. No custom provider profile mapping is used. Facebook may omit email, and the installed adapter does not assume an email is verified. Missing email fails cleanly with Czech guidance to use another method; no placeholder address or weakened identity constraint is introduced.

## Account linking and onboarding

Keep Better Auth's safe defaults: implicit linking requires a matching email, a verified local email, and a verified provider email (there is no trusted-provider override). `allowDifferentEmails` is not enabled. Existing linked accounts continue to use their provider account identity.

Email/password registration sends a verification e-mail (see below) but does not require it. Settings provides explicit link/unlink controls, and implicit linking retains the verified-email safeguards. Signing in socially with an existing **unverified** local email therefore returns `account_not_linked`; it does not create a second user. The page asks the learner to sign in using their original method. Facebook profiles lacking a verified email claim cannot implicitly link even to a verified local account. Do not disable `requireLocalEmailVerified` or force provider trust to bypass this.

Both social buttons call `authClient.signIn.social` with `callbackURL: "/learn"`. The existing authenticated layout decides whether a new learner needs onboarding; returning learners retain their normal destination. Email registration keeps its existing `/onboarding` redirect. Authentication adds no lesson progress or rewards.

## Demo access

Anonymous demo profiles can use all published lessons, Portfolio Lab (including instrument details, buy/sell and reset), and Backtesting Lab immediately. The server reads the stored anonymous identity when evaluating Portfolio Lab access; no client flag can unlock a regular account. First access records a single `demo_access` entitlement with 5,000 Kč of virtual Practice Capital in the existing unlock ledger. Existing sessions get this access on their next visit without reseeding lesson history. Existing unlock receipts and portfolios keep their original capital; reloads, lesson completion and portfolio resets never repeat the grant. Normal accounts retain the Foundations/420 XP requirements. Planned content remains unpublished.

## Password reset, e-mail verification and password change

Transactional e-mail uses an explicit `EMAIL_TRANSPORT` (`src/features/email`): `resend` requires `RESEND_API_KEY` plus `EMAIL_FROM` on a verified domain. Vercel Production refuses incomplete/non-Resend configuration; Preview forbids Resend. Local QA selects `outbox` explicitly; `log` prints links only in local development. See [environment](environment.md). Delivery runs after the response (`after()`), so a request for an existing account takes as long as one for an unknown address. Failures are logged with the HTTP status and an allowlisted provider error name, without the recipient, provider message or link.

- **Reset** (`/forgot-password` → e-mail → `/api/auth/reset-password/:token` → `/reset-password?token=…`). Better Auth answers every request with the same body; the form shows the same confirmation either way. Tokens live 30 minutes (`PASSWORD_RESET_TOKEN_SECONDS`) and are consumed in the same transaction as the password change, so a link works once. A reset ends **every** session (`revokeSessionsOnPasswordReset`) and lands on `/sign-in?password=reset`. Opening the link proves the mailbox, so a reset also marks the address verified. A social-only account can set its first password this way.
- **Verification.** Sign-up sends a link valid for 24 hours that lands on `/verify-email`. It is a reminder, not a gate: the guest → account save step (`/onboarding/save`) keeps the learner signed in and learning. Settings › Účet marks an unverified address, and Settings › Přihlášení a zabezpečení resends the link.
- **Password change** in Settings › Přihlášení a zabezpečení asks for the current password. "Odhlásit ostatní zařízení" is on by default; this device gets a fresh session.
- **Limits** (shared Postgres store): per IP, `/request-password-reset` and `/send-verification-email` 5/min, `/reset-password` 10/min and `/change-password` 5/min. Per address, 5 e-mailed links per hour whether or not the account exists. Per user, 5 password-change attempts per 15 minutes.

`npm run test:account-recovery` drives the real Better Auth handler on a disposable local DB. `npm run test:account-recovery-browser` runs the whole flow in a browser against a fresh production server whose e-mails go to `EMAIL_OUTBOX_DIR`.

## Failure and loading behavior

OAuth uses full-page redirects. Both social buttons lock immediately during an attempt, with a pending label and `aria-busy`; API/network failures unlock them. Browser Back restores usable buttons. Per-attempt errors return to the originating auth page. Errors without usable OAuth state fall back to `/sign-in` via `onAPIError.errorURL`.

Only allowlisted Czech messages are rendered. Raw provider messages, `error_description`, tokens and other details are never rendered by the social error component. Missing email, unsafe linking, cancellation, unavailable providers and generic callback failures offer a recoverable path. Provider cancellation that never returns to Investník can be recovered with Browser Back.

## Verification

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`. `npm run test:auth-browser` (`scripts/validate-auth.mjs`) exercises a fresh local production runtime using disposable local users and **fake** provider credentials; it stops provider navigation before contacting Google/Meta. It checks actual Better Auth authorization URLs and callback cancellation, not a live provider login. See the script's environment requirements. Real consent/token exchange requires manual testing with development credentials.

Implementation was checked against the installed package source, including `oauth2/link-account.mjs`, `api/routes/callback.mjs` and the Google/Facebook adapters. Reference: [Better Auth accounts](https://better-auth.com/docs/concepts/users-accounts), [Google](https://better-auth.com/docs/authentication/google), [Facebook](https://better-auth.com/docs/authentication/facebook).


### Existing-flow UX (#114, phase 2)

Forgot-password confirmation names the sender and subject, offers a 60-second client resend countdown,
and retains the same response for all addresses. Server buckets remain authoritative. A 429 uses
`Retry-After` (seconds or HTTP date) to show whole minutes. Address hints move between sign-in, reset
request and the final sign-in through tab-scoped `sessionStorage`, with graceful fallback if storage is
blocked; no address enters navigation URLs.

Reset and verification pages, and their token-bearing Better Auth redirect endpoints, send
`Referrer-Policy: no-referrer`. Hydration removes a token query parameter with `history.replaceState`
while preserving the framework history state. The reset form keeps its token only in memory; reloading
a stripped URL requires reopening the mail link. Password reset and Settings password change use one
new-password field with a keyboard-accessible show/hide control.

Explicit verification resend checks the authenticated session and waits for the transport. A failure
returns a fixed error and Settings shows Czech recovery copy. Signup and unauthenticated sends still
run after the response. The local outbox recognizes a `.force-failure` marker in its directory for QA;
remove it to resume delivery. Production on Vercel cannot select the outbox. Never expose this switch
through an HTTP endpoint or upload the outbox.

Account creation (including guest save) emits one quiet verification acknowledgment at its destination.
An unverified saved account has a text link to verification in the account menu; verification is still
optional for learning. Successful reset/change sends a token-free security notification with Prague time
and a recovery link, after the response. Delivery failure cannot roll back the password change.
Unknown Better Auth errors always use the caller's Czech fallback. HIBP remains optional and is not
enabled; no new external password-check service or privacy-policy commitment is introduced here.


### Account changes (#114, phase 3)

Settings offers `changeEmail` through Better Auth with `updateEmailWithoutVerification=false`. A
verified current address first approves the change, then the new address verifies it. An unverified
current address skips old-address approval but still requires new-address verification. The address
is unchanged until the final verification. Initiating a change requires a saved account and a session
created less than 10 minutes ago, matching the deletion freshness helper. Shared Postgres limits apply
per user and to both current and target mailboxes, in addition to Better Auth's per-IP limit.

`POST /api/account/password` wraps Better Auth's server-only `setPassword` for social-only accounts.
It verifies same-origin requests, the session, saved-account status, 10-minute freshness, input length
and a shared per-user budget. It cannot replace an existing password. The email-reset fallback remains.
No password or exception body is logged or returned.

Successful address verification notifies the old address; new Google/Facebook account links notify
the account address. The email-change hook verifies the signed verification token again before choosing
the old notification recipient. Initial social registration and existing social sign-in do not send a
link notification. Existing verified-email account-linking safeguards remain unchanged. Notifications
contain Prague time and a recovery CTA, never tokens or the new email address.


### Delivery records (#114, phase 4)

`email_delivery` stores only the owner, kind, provider/message ID, outcome, safe error code and times.
Every send boundary requires an authoritative user ID; no unknown-account reset creates a record.
No address, mail body, URL or token enters the table. The optional current-address epoch is compared
with `user.email_delivery_epoch` to isolate suppression across address changes. Both use millisecond
Postgres timestamps, matching JavaScript Date precision. Proposed new recipients and old-address
security notifications have a null epoch and cannot suppress the current mailbox.

Signed Resend webhooks advance outcomes atomically with monotonic precedence, so retries and older
outcomes cannot erase a bounce or complaint. Ordinary current-mailbox verification sends are suppressed
after a bounce/complaint; password recovery and security messages remain eligible. Settings shows a
warning with a link to the email-change form. A mailbox update changes the epoch in the same update,
so even a delayed event for the old address cannot affect the new mailbox.

The existing authorized daily cron deletes records older than 90 days; account deletion cascades them.
The personal-data export includes delivery metadata. See [environment](environment.md) for the exact
webhook subscription, secret setup, privacy notes and QA settings. A provider acknowledgment records
`sent`, not proof of inbox delivery. Unknown message IDs (including an event that arrives before its
send response has been recorded) are ignored, per the issue contract; the table is not a durable mail
queue or a replacement for provider delivery diagnostics.
