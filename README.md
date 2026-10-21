# Investník

Investník (formerly investi) is a free, Czech-first investing-education platform at [investnik.cz](https://investnik.cz). [docs/brand.md](docs/brand.md) covers the name, the brand assets, the domain setup and the remaining external rollout steps.

Learn investing by doing. The authenticated product is organized around three destinations: **Learn**, **Lab**, and **Progress**. Guided lessons are organized into modules (Investing Foundations, Returns & Compounding, …), with persisted lesson position, transactional first-completion rewards, and focused interactive exercises. The lesson catalog in `src/features/learning/catalog.ts` lists what is published.

## Architecture

- **Next.js App Router** separates public authentication/onboarding from authenticated product routes.
- **Better Auth** owns credentials, normal sessions, and isolated anonymous demo sessions.
- **Drizzle + PostgreSQL** own curriculum records, per-user progress, learning profiles, and immutable lesson-award receipts.
- **`features/lessons`** is the typed authored lesson engine shared by Foundations and Returns.
- **`features/progress`** validates step transitions and completes lessons with rewards in one transaction.
- **`features/gamification`** derives XP, local learning days, streak, and daily lesson progress from persisted award receipts.
- **`features/rewards`** owns the server-side Practice Capital policy and exact receipt-derived entitlement read model.
- **`features/portfolio`** owns persistent paper trading, exact accounting, generations, and transaction authority.
- **`features/market-data`** normalizes deterministic/FMP security data, Frankfurter FX, equity fundamentals, and ETF analytics behind server-only services.
- **`features/personalization`** owns diagnostic evidence, preference validation, and deterministic recommendations.
- **`features/lab`** contains pure allocation/backtest math and an explicitly synthetic educational fixture.

## Local setup and deployment order

1. Run `npm ci`, copy `.env.example` to an ignored `.env`, and set a real `BETTER_AUTH_SECRET`. See [environment settings](docs/environment.md) for required, optional, infrastructure, and test variables.
2. Start PostgreSQL and update `DATABASE_URL`.
3. Apply committed migrations before starting the new application code, then seed the curriculum:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

   On Vercel, production deploys run `vercel-build` (`scripts/vercel-build.mjs`), which applies pending migrations and then the curriculum seed before `next build`, so a lesson added to the catalog is completable without a manual step. The seed fails the deploy if any catalog lesson is still missing from the `lesson` table afterwards. Preview deploys skip both so unmerged branches never change the shared database.

4. Start the app:

   ```bash
   npm run dev
   ```

`db:seed` is idempotent and safe to run on every deploy. `npm run db:check-curriculum` is a read-only check that exits non-zero when a published catalog module or lesson has no row in the database. Apply every committed migration in `drizzle/` (`npm run db:migrate` applies the pending ones in order); the application code assumes the full chain. Historical migrations and their metadata must remain intact.

## Optional social sign-in

Google and Facebook can be enabled independently with server-only credential pairs. See [authentication setup](docs/authentication.md) for callback URLs, provider-console setup, safe account-linking behavior and verification. Email/password and demo continue to work without OAuth credentials.

## Docker

The `Dockerfile` and `compose.yaml` are a **local development stack only**: the image runs `npm run dev` (Next.js development mode) as root with the source tree bind-mounted. Never use it as a production image; production deploys go through Vercel (`vercel-build`).

Prerequisites: Docker Desktop (or Docker Engine with the Compose plugin). On first use, create an ignored Compose environment file and replace both placeholder secrets with locally generated values:

```bash
cp .env.example .env
```

`BETTER_AUTH_SECRET` must be at least 32 characters. `POSTGRES_PASSWORD` is used only by the Docker PostgreSQL instance. `BETTER_AUTH_URL` should remain `http://localhost:3000` unless the app is exposed on another host or port. `DATABASE_URL` remains the non-Docker development connection string; Compose supplies its own internal value using the `db` service hostname.

Start the complete development stack:

```bash
docker compose up --build
```

The app is available at <http://localhost:3000>. Compose waits for PostgreSQL to pass its healthcheck, then the app automatically runs the committed Drizzle migrations and idempotent curriculum seed before launching Next.js development mode. To run them manually instead, use:

```bash
docker compose run --rm app npm run db:migrate
docker compose run --rm app npm run db:seed
```

Stop the stack with `docker compose down`. PostgreSQL data remains in the named `postgres_data` volume across stops and rebuilds. To remove containers and the persisted development database deliberately, run `docker compose down --volumes`.

## Verification

GitHub Actions runs the gates automatically. `.github/workflows/ci.yml` runs on every pull request and every push to `main`: one job generates Next.js route types (`next typegen`, which a clean checkout needs before `tsc`) and runs lint, typecheck, unit tests and build; a second job migrates and seeds a disposable PostgreSQL service container and runs the persistence, migration and concurrency suites. `.github/workflows/browser.yml` runs the Playwright browser suites nightly (and on demand) against `next start`. Both use deterministic sample data. `main` requires both CI jobs to pass before merging.

Locally, run `npx next typegen` once on a fresh checkout before `npm run typecheck` (`next dev` and `next build` also generate the types).

Static gates run independently. Database and browser suites require a local disposable QA database and a fresh app runtime; see [Scripts and test suites](#scripts-and-test-suites) for the full list.

Run migrations and seed on a disposable local QA database, with `DATABASE_URL` and local auth/provider settings explicitly exported. Re-run `db:seed` followed by `test:curriculum-seed` to verify idempotence. Personalization upgrade QA additionally requires a fresh database and explicit opt-in; see [onboarding](docs/onboarding.md). Browser suites create and remove only their own local disposable identities. Screenshots are written under `/tmp`, never the repository.

## Scripts and test suites

Every suite below is an npm script in `package.json` unless it is written as `node scripts/…`. "CI" marks what GitHub Actions runs: `ci.yml` on every pull request, `browser.yml` nightly.

**App and database**

| Script | Purpose |
| --- | --- |
| `dev`, `build`, `start` | Next.js development server, production build, production server |
| `vercel-build` | Production deploys on Vercel: applies pending migrations, seeds the curriculum, then `next build` |
| `db:migrate`, `db:seed` | Apply committed migrations; seed the curriculum (idempotent, fails if a catalog lesson is still missing) |
| `db:check-curriculum` | Read-only: fail when a published catalog module or lesson is missing from the database |
| `db:generate`, `db:studio` | Generate a new migration from the Drizzle schema; open Drizzle Studio |

**Static gates** (no database, all in CI)

| Script | Purpose |
| --- | --- |
| `lint`, `typecheck` | ESLint; `tsc --noEmit` (run `npx next typegen` first on a fresh checkout) |
| `knip` | Unused files, exports and dependencies (config and reasoned exceptions in `knip.jsonc`) |
| `test`, `test:watch` | Vitest unit tests: domain, accounting, lesson content, components |

**Database suites** (need `DATABASE_URL` pointing at a disposable local database that is migrated and seeded)

| Script | Covers | CI |
| --- | --- | --- |
| `test:curriculum-seed` | Seed idempotence and lesson publication/order | ✓ |
| `test:migration` | Practice Capital receipt migrations | ✓ |
| `test:portfolio-migration` | Portfolio schema migrations | ✓ |
| `test:persistence` | Progress, completion and reward receipts | ✓ |
| `test:portfolio-persistence` | Trades, generations, reset, exact accounting, concurrency | ✓ |
| `test:portfolio-allocation` | Target-mix execution and rebalancing | ✓ |
| `test:portfolio-closed-market` | Orders and valuations while the market is closed | ✓ |
| `test:progression-persistence` | Portfolio Lab unlock, demo access grant and row-lock concurrency | ✓ |
| `test:log-returns-persistence` | Returns module answers, completion and rewards | ✓ |
| `test:guest-claim` | Guest → account claim | ✓ |
| `test:market-data-cache` | Shared Postgres market-data cache | ✓ |
| `test:rate-limit` | Shared rate limits | ✓ |
| `test:account-deletion` | Account deletion, data export, session retention (needs `ACCOUNT_DATA_QA_DISPOSABLE=1`) | ✓ |
| `test:anonymous-cleanup` | Anonymous identity cleanup (needs `ANONYMOUS_CLEANUP_QA_DISPOSABLE=1`) | ✓ |
| `test:personalization-persistence` | Onboarding profile and recommendations (needs `PERSONALIZATION_QA_DISPOSABLE=1`, see [onboarding](docs/onboarding.md)) | |
| `test:prepared-statements` | Prepared-statement compatibility of a pooler endpoint (see [performance baseline](docs/performance-baseline.md)) | |

**Browser suites** (Playwright; need a fresh running server on a disposable database. Each suite reads its base URL from a `*_TEST_URL` variable listed in [environment settings](docs/environment.md); `BROWSER_CHANNEL=chrome` uses installed Chrome)

| Script | Covers | CI |
| --- | --- | --- |
| `test:product` | Product shell and Backtesting | ✓ |
| `test:foundations-browser` | Foundations lessons | ✓ |
| `test:portfolio-browser` | Portfolio Lab | ✓ |
| `test:progression-browser` | Unlock progression | ✓ |
| `test:backtesting-browser` | Backtesting Lab | ✓ |
| `test:marketing-browser` | Landing page | ✓ |
| `test:not-found-browser` | 404 pages: unmatched URL, lesson, instrument | ✓ |
| `test:log-returns-browser`, `test:returns-browser` | Returns module | |
| `test:portfolio-browser-closed` | Closed/stale market states (server started with `DETERMINISTIC_MARKET_NOW`) | |
| `test:instrument-browser-unavailable` | Unavailable instrument history/quotes | |
| `test:studovna` | Learn page | |
| `test:onboarding-redesign` | Guest onboarding | |
| `test:personalization-browser`, `test:personalization-compatibility` | Personalization and legacy accounts | |
| `test:settings` | Settings and linked accounts | |
| `test:legal-browser` | Privacy and terms pages | |
| `test:demo-session` | Demo and guest session lifetimes | |
| `test:request-isolation` | Request-scoped memoization across users | |
| `test:navigation-feedback` | Client navigation feedback | |
| `test:auth-browser` | Social sign-in with fake providers (see [authentication](docs/authentication.md)) | |
| `test:progress-browser` | Progress page (needs `PROGRESS_QA_DISPOSABLE=1` and an `investi_progress_qa` database) | |
| `test:design-system-browser` | Design system (requires `npm run dev`) | |

**Operator and diagnostics**

| Script | Purpose |
| --- | --- |
| `demo:cleanup` | Dry run of the anonymous identity cleanup; `-- --apply` applies it |
| `smoke:fmp` | Manual smoke test of the live FMP market-data adapter |
| `smoke:fmp-fundamentals` | Manual smoke test of live FMP equity fundamentals and their cache |
| `bench:navigation` | Client navigation benchmark (see [performance baseline](docs/performance-baseline.md)) |

## Anonymous identity retention

Demos and guests are anonymous Better Auth identities without a password or provider account. A demo is one-time: its session lasts a fixed 24 hours from the start and using it never extends that. A guest session lasts seven days and, like an account's, extends while it is used. Once every session of an anonymous identity has expired, nobody can sign in to it again.

A daily Vercel Cron job (`vercel.json`) calls `/api/cron/cleanup-anonymous`, which removes anonymous identities that have had no valid session for over a day (and were created over a day ago). Deleting the user cascades its sessions, profile, progress, receipts, unlocks, portfolios and trades; saved accounts and shared curriculum/market data are never touched. Rows locked by a guest claim or lesson completion are skipped and retried by the next run. The endpoint requires `Authorization: Bearer $CRON_SECRET` and refuses every request when `CRON_SECRET` is not set, so set it in the Vercel project for production. The same job then deletes session rows (with their IP address and user agent) for every identity once they expired more than 30 days ago (`deleteExpiredSessions`).

## Personal data

A saved account downloads its data from Settings → Moje data (`GET /api/account/export`, session owner only, rate limited per user): profile, sign-in methods without secrets, sessions, learning profile, progress, reward receipts, unlocks, portfolio generations with trades and target mixes, with money in minor units and decimals as exact strings. The same screen deletes the account through Better Auth's `/delete-user`; a guard in `src/lib/auth.ts` requires the password for password accounts, a sign-in from the last 10 minutes for Google/Facebook-only accounts, refuses guests and demos (the cleanup above removes those), and limits attempts per user. The user row cascades everything the user owns; shared curriculum, market data and rate-limit counters stay. `/privacy` and `/terms` are linked from every footer and the sign-up step; the operator's identity and contact in `src/components/legal/legal-page.tsx` must be filled in and the texts reviewed before they are relied on.

The operator command applies the same rule and needs only `DATABASE_URL`:

```bash
npm run demo:cleanup
npm run demo:cleanup -- --apply
```

See [current product contracts](docs/product-reset.md) for reward, streak, daily-goal, synthetic-data, migration, compatibility, and validation semantics. Current policy v3: Foundations lessons earn XP only, finishing Foundations unlocks Portfolio Lab with a one-time 5,000 Kč, and every lesson outside Foundations adds 2,000 Kč; stored receipts keep their original amounts.
