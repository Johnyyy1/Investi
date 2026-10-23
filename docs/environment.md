# Environment and validation settings

Use `.env.example` as the template and keep all credential-bearing files ignored. The application uses Next.js environment loading; Drizzle, seed, and most standalone scripts use `dotenv/config`, which loads `.env` by default, not `.env.local`. Prefer an ignored `.env` for the shared local workflow, or explicitly export values for standalone commands. Never point disposable QA at the normal development or production database.

## Application settings

| Variable | Classification | Current use |
| --- | --- | --- |
| `DATABASE_URL` | Required in production and DB tooling | PostgreSQL connection; Compose supplies its internal `db:5432` URL |
| `BETTER_AUTH_SECRET` | Required in production | Server authentication secret, at least 32 characters |
| `BETTER_AUTH_URL` | Required in production | Actual app origin, OAuth callbacks, normalized auth-error redirect. Production is `https://investnik.cz` ([brand.md](brand.md)); previews and local runs keep their own origin |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Domain transition only | Comma-separated extra origins that Better Auth reads directly for its origin check. Set `https://tryinvesti.vercel.app` only while the old host still serves pages, then remove it |
| `CRON_SECRET` | Required in production for scheduled cleanup | At least 32 characters; Vercel Cron sends it as a bearer token to `/api/cron/cleanup-anonymous`, which refuses every request without it |
| `MARKET_DATA_PROVIDER` | Optional in production | `deterministic` default or explicit `fmp`; no silent fallback |
| `FX_DATA_PROVIDER` | Optional with deterministic; required with FMP | `deterministic`, `cnb` (ČNB daily fixing, recommended) or `frankfurter` reference FX |
| `FMP_API_KEY` | Required only with FMP | Server-only provider credential |
| `EMAIL_TRANSPORT` | Explicit mail transport | `resend`, `outbox`, or `log` (default). Production on Vercel requires `resend`; Preview refuses it, even if a key is accidentally present |
| `VERCEL_ENV` | Vercel-controlled | Enforces production mail configuration independently of `NODE_ENV` (local production-mode QA can use an outbox) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Required with `EMAIL_TRANSPORT=resend` | Server-only Resend key and a single sender on a verified domain, intended as `investi <ucet@mail.investnik.cz>`. Reserved test domains (`example.com`, `.test`, …) are never sent to |
| `EMAIL_OUTBOX_DIR` | Required with `EMAIL_TRANSPORT=outbox` | Private local QA directory. JSON files contain mail content and links; never upload or commit them |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional in production | Both must be present to enable Google sign-in |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | Optional in production | Both must be present to enable Facebook sign-in |
| `DETERMINISTIC_MARKET_NOW` | Development/test-only intended usage | Optional fixed UTC instant for reproducible sample market-session states; ignored in FMP mode |
| `SKIP_ENV_VALIDATION` | Development/build escape hatch | `true` bypasses schema validation; keep production validation enabled |
| `NODE_ENV` | Framework-controlled | Production guards, DB client lifetime; Next assigns development/production |

`NEXT_PUBLIC_APP_URL` was obsolete: no client or server consumer read it outside its own environment declaration. Authentication uses `BETTER_AUTH_URL` and the browser's same-origin auth client. Its declaration, example, Compose setting, and setup references have been removed. No client environment variable is currently needed.

## Infrastructure/development settings

`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` initialize Docker Compose PostgreSQL. `APP_PORT` changes the published app port (default 3000); set `BETTER_AUTH_URL` to the matching origin. Compose does not expose the DB port. The example host URL uses the historically separate local PostgreSQL instance on port 5433; adjust it for your actual host database. `NEXT_TELEMETRY_DISABLED` is a Next.js opt-out set in Docker. These are active infrastructure settings, not application feature flags. The `Dockerfile` is for local development only: it runs `npm run dev` as root against a bind-mounted tree, so never ship it as a production image.

## CI settings

GitHub Actions (`.github/workflows/`) sets `MARKET_DATA_PROVIDER` and `FX_DATA_PROVIDER` to `deterministic`, and placeholder `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` values. The static job also sets `SKIP_ENV_VALIDATION=true` and never connects to a database; the persistence and browser jobs point `DATABASE_URL` at a disposable loopback PostgreSQL service container. CI holds no real secrets.

## Test-only settings

All browser app URLs must be loopback. Most suites also refuse non-loopback DB URLs and delete only their own disposable identities. Explicitly export the QA database URL so a local `.env` cannot select another database.

| Settings | Consumers |
| --- | --- |
| `BROWSER_CHANNEL` | Browser validation; installed Chrome can substitute for bundled Chromium |
| `PRODUCT_TEST_URL`, `PRODUCT_SCREENSHOT_DIR` | Current product shell/Backtesting suite |
| `RETURNS_TEST_URL`, `RETURNS_SCREENSHOT_DIR` | Returns/log-return suites |
| `PORTFOLIO_TEST_URL`, `PORTFOLIO_SCREENSHOT_DIR` | Portfolio and progression browser suites |
| `PROGRESSION_SCREENSHOT_DIR` | Progression browser output |
| `FOUNDATIONS_TEST_URL`, `FOUNDATIONS_SCREENSHOT_DIR` | Foundations browser suite |
| `WALKTHROUGH_TEST_URL`, `WALKTHROUGH_SCREENSHOT_DIR`, `LESSON_IDS` | Generic walkthrough of every published lesson; `LESSON_IDS` (comma-separated) limits it to those lessons |
| `MARKETING_TEST_URL`, `MARKETING_SCREENSHOT_DIR` | Landing browser suite |
| `DESIGN_SYSTEM_BASE_URL` | Development-only design-system browser suite |
| `PORTFOLIO_CLOSED_TEST_URL`, `PORTFOLIO_CLOSED_SCREENSHOT_DIR` | Closed-market browser runtime/output |
| `INSTRUMENT_UNAVAILABLE_TEST_URL`, `INSTRUMENT_UNAVAILABLE_SCREENSHOT_DIR` | Unavailable-history/quote browser runtime/output |
| `NOT_FOUND_TEST_URL`, `NOT_FOUND_SCREENSHOT_DIR` | Not-found pages browser suite |
| `PERSONALIZATION_TEST_URL`, `PERSONALIZATION_SCREENSHOT_DIR` | Personalization/compatibility browser suites |
| `PERSONALIZATION_QA_DISPOSABLE` | Explicit opt-in; requires dedicated `investi_6a3a_qa` DB |
| `ACCOUNT_DATA_QA_DISPOSABLE` | Explicit opt-in for `test:account-deletion`, whose session-retention step deletes every session in its local DB that expired over 30 days ago |
| `LEGAL_TEST_URL` | Running server for `test:legal-browser` |
| `ANONYMOUS_CLEANUP_QA_DISPOSABLE` | Explicit opt-in for `test:anonymous-cleanup`, which deletes every eligible anonymous identity in its local DB |
| `PERSONALIZATION_QA_USER_ID`, `PERSONALIZATION_QA_LESSONS` | Internal child fixture harness; scoped QA owner/history mode |
| `PERSONALIZATION_QA_FOCUS` | Optional focused Settings browser run |
| `AUTH_TEST_URL`, `AUTH_DISABLED_TEST_URL` | Two auth runtimes, fake enabled providers versus disabled providers; dedicated `investi_6a4_qa` DB |
| `AUTH_SCREENSHOT_DIR`, `AUTH_SKIP_SCREENSHOTS` | Auth browser output controls |
| `RECOVERY_TEST_URL`, `RECOVERY_OUTBOX_DIR`, `RECOVERY_SCREENSHOT_DIR` | `test:account-recovery-browser`: a server started with `EMAIL_TRANSPORT=outbox`, `RESEND_API_KEY` empty and `EMAIL_OUTBOX_DIR` set to `RECOVERY_OUTBOX_DIR` |

Vitest/configuration and framework tools also manage their own environment. No secret values are documented here. See [onboarding](onboarding.md) for the stricter fresh-database guard and [authentication](authentication.md) for callback setup.


## Transactional email release checklist (#114, phase 1)

The intended app origin is `https://investnik.cz`, with sender `investi <ucet@mail.investnik.cz>`.
`mail.investnik.cz` is a DNS subdomain of `investnik.cz`, not another domain to purchase. Register/control
`investnik.cz` first if it is not already owned. Do not reuse Brigoš's verified sender or mail credentials.

1. In the **qlearn** Vercel project, attach `investnik.cz` to Production. Copy the DNS values Vercel actually
   supplies to the domain's authoritative DNS provider; preserve existing records. Confirm ownership,
   HTTPS, and that the deployed commit contains `/forgot-password`. The legacy `tryinvesti.vercel.app`
   alias must also target qlearn's current Production deployment if it remains in use.
2. In a separate investi Resend team/account (or a plan supporting another verified domain), add
   `mail.investnik.cz`. Copy its exact DKIM and sending SPF/MX records into DNS. Add DMARC at
   `_dmarc.mail.investnik.cz`, starting with `p=none` and a working, monitored aggregate-report mailbox;
   advance to `quarantine` only after reviewing alignment reports. Do not invent DKIM values or create
   duplicate SPF policies. See [Resend domain setup](https://resend.com/docs/dashboard/domains/introduction).
3. Create a production sending key scoped to this domain. In Vercel **Production only**, set
   `EMAIL_TRANSPORT=resend`, `EMAIL_FROM="investi <ucet@mail.investnik.cz>"`, `RESEND_API_KEY`, and
   `BETTER_AUTH_URL=https://investnik.cz`. Preview uses `EMAIL_TRANSPORT=log` and **no** Resend key.
   `log` prints message content only in local development, never in hosted previews.
4. Run `npm run email:validate` with the intended deployment environment. Vercel's build command runs
   this before migrations or seed, and app env validation repeats it. Production cannot bypass mail
   validation with `SKIP_ENV_VALIDATION`.
5. Run `npm run email:check` with the production sender and a Resend key allowed to **list domains**.
   The script uses Next's `.env*` loading, calls only `GET /domains`, follows pagination and exits nonzero
   unless the exact sender domain is verified. A send-only scoped key may return 403: use a separate
   operator key for this read-only check, without replacing the app's scoped sending key. It prints no
   credentials, addresses, links or provider body. This is an explicit operator check, not a network call
   during PR CI or a build. [Resend API reference](https://resend.com/docs/api-reference/domains/list-domains).
6. Redeploy with the new environment. Check `https://investnik.cz/forgot-password` returns 200 and
   sign-in links to it. Request resets for consenting Gmail and Seznam.cz test accounts. Record receipt
   within one minute, inbox placement, SPF/DKIM/DMARC `pass`, and a link using `https://investnik.cz`.
   Complete one reset; verify reuse fails. Verify expiry after 30 minutes with the persistence suite
   (and a deliberately aged test link if manually checking production). Never paste tokens into reports.

DNS propagation and inbox placement are external acceptance checks; a passing unit test or successful
Resend API response cannot prove them. Until these steps pass, #114 remains open. PR phases 2–4 cover
flow UX, account changes and delivery observability separately, as specified in the issue.
