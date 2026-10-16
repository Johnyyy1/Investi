# investi

Learn investing by doing. The authenticated product is organized around three destinations: **Learn**, **Lab**, and **Progress**. Twelve guided lessons are currently available across Investing Foundations and Returns & Compounding, with persisted lesson position, transactional first-completion rewards, and focused interactive exercises.

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

   On Vercel, production deploys run `vercel-build` (`scripts/vercel-build.mjs`), which applies pending migrations before `next build`. Preview deploys skip migrations so unmerged branches never change the shared database.

4. Start the app:

   ```bash
   npm run dev
   ```

`db:seed` is idempotent. Apply all committed migrations through `0009_brainy_madame_masque.sql`; the current code requires reward receipts, portfolio/trade and unlock ledgers, and the additive personalization fields. Historical migrations and their metadata must remain intact.

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

Static gates run independently. Database/browser checks require a local disposable QA database and a fresh app runtime; `validate-design-system.mjs` specifically requires development mode:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:persistence
ACCOUNT_DATA_QA_DISPOSABLE=1 npm run test:account-deletion
ANONYMOUS_CLEANUP_QA_DISPOSABLE=1 npm run test:anonymous-cleanup
npm run test:migration
npm run test:curriculum-seed
npm run test:portfolio-persistence
npm run test:portfolio-migration
npm run test:progression-persistence
npm run test:log-returns-persistence
npm run test:product
LEGAL_TEST_URL=http://localhost:3000 npm run test:legal-browser
BROWSER_CHANNEL=chrome node scripts/validate-foundations.mjs
BROWSER_CHANNEL=chrome node scripts/validate-returns-flow.mjs
BROWSER_CHANNEL=chrome npm run test:log-returns-browser
BROWSER_CHANNEL=chrome npm run test:portfolio-browser
BROWSER_CHANNEL=chrome node scripts/validate-design-system.mjs
```

Run migrations and seed on a disposable local QA database, with `DATABASE_URL` and local auth/provider settings explicitly exported. Re-run `db:seed` followed by `test:curriculum-seed` to verify idempotence. Personalization upgrade QA additionally requires a fresh database and explicit opt-in; see [onboarding](docs/onboarding.md). Browser suites create and remove only their own local disposable identities. Screenshots are written under `/tmp`, never the repository.

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
