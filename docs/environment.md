# Environment and validation settings

Use `.env.example` as the template and keep all credential-bearing files ignored. The application uses Next.js environment loading; Drizzle, seed, and most standalone scripts use `dotenv/config`, which loads `.env` by default, not `.env.local`. Prefer an ignored `.env` for the shared local workflow, or explicitly export values for standalone commands. Never point disposable QA at the normal development or production database.

## Application settings

| Variable | Classification | Current use |
| --- | --- | --- |
| `DATABASE_URL` | Required in production and DB tooling | PostgreSQL connection; Compose supplies its internal `db:5432` URL |
| `BETTER_AUTH_SECRET` | Required in production | Server authentication secret, at least 32 characters |
| `BETTER_AUTH_URL` | Required in production | Actual app origin, OAuth callbacks, normalized auth-error redirect |
| `CRON_SECRET` | Required in production for scheduled cleanup | At least 32 characters; Vercel Cron sends it as a bearer token to `/api/cron/cleanup-anonymous`, which refuses every request without it |
| `MARKET_DATA_PROVIDER` | Optional in production | `deterministic` default or explicit `fmp`; no silent fallback |
| `FX_DATA_PROVIDER` | Optional with deterministic; required with FMP | `deterministic`, `cnb` (ČNB daily fixing, recommended) or `frankfurter` reference FX |
| `FMP_API_KEY` | Required only with FMP | Server-only provider credential |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional in production | Both must be present to enable Google sign-in |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | Optional in production | Both must be present to enable Facebook sign-in |
| `DETERMINISTIC_MARKET_NOW` | Development/test-only intended usage | Optional fixed UTC instant for reproducible sample market-session states; ignored in FMP mode |
| `SKIP_ENV_VALIDATION` | Development/build escape hatch | `true` bypasses schema validation; keep production validation enabled |
| `NODE_ENV` | Framework-controlled | Production guards, DB client lifetime; Next assigns development/production |

`NEXT_PUBLIC_APP_URL` was obsolete: no client or server consumer read it outside its own environment declaration. Authentication uses `BETTER_AUTH_URL` and the browser's same-origin auth client. Its declaration, example, Compose setting, and setup references have been removed. No client environment variable is currently needed.

## Infrastructure/development settings

`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` initialize Docker Compose PostgreSQL. `APP_PORT` changes the published app port (default 3000); set `BETTER_AUTH_URL` to the matching origin. Compose does not expose the DB port. The example host URL uses the historically separate local PostgreSQL instance on port 5433; adjust it for your actual host database. `NEXT_TELEMETRY_DISABLED` is a Next.js opt-out set in Docker. These are active infrastructure settings, not application feature flags.

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
| `MARKETING_TEST_URL`, `MARKETING_SCREENSHOT_DIR` | Landing browser suite |
| `DESIGN_SYSTEM_BASE_URL` | Development-only design-system browser suite |
| `PORTFOLIO_CLOSED_TEST_URL`, `PORTFOLIO_CLOSED_SCREENSHOT_DIR` | Closed-market browser runtime/output |
| `INSTRUMENT_UNAVAILABLE_TEST_URL`, `INSTRUMENT_UNAVAILABLE_SCREENSHOT_DIR` | Unavailable-history/quote browser runtime/output |
| `PERSONALIZATION_TEST_URL`, `PERSONALIZATION_SCREENSHOT_DIR` | Personalization/compatibility browser suites |
| `PERSONALIZATION_QA_DISPOSABLE` | Explicit opt-in; requires dedicated `investi_6a3a_qa` DB |
| `ANONYMOUS_CLEANUP_QA_DISPOSABLE` | Explicit opt-in for `test:anonymous-cleanup`, which deletes every eligible anonymous identity in its local DB |
| `PERSONALIZATION_QA_USER_ID`, `PERSONALIZATION_QA_LESSONS` | Internal child fixture harness; scoped QA owner/history mode |
| `PERSONALIZATION_QA_FOCUS` | Optional focused Settings browser run |
| `AUTH_TEST_URL`, `AUTH_DISABLED_TEST_URL` | Two auth runtimes, fake enabled providers versus disabled providers; dedicated `investi_6a4_qa` DB |
| `AUTH_SCREENSHOT_DIR`, `AUTH_SKIP_SCREENSHOTS` | Auth browser output controls |

Vitest/configuration and framework tools also manage their own environment. No secret values are documented here. See [onboarding](onboarding.md) for the stricter fresh-database guard and [authentication](authentication.md) for callback setup.
