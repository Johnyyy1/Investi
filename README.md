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

Static gates run independently. Database/browser checks require a local disposable QA database and a fresh app runtime; `validate-design-system.mjs` specifically requires development mode:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:persistence
npm run test:migration
npm run test:curriculum-seed
npm run test:portfolio-persistence
npm run test:portfolio-migration
npm run test:progression-persistence
npm run test:log-returns-persistence
npm run test:product
BROWSER_CHANNEL=chrome node scripts/validate-foundations.mjs
BROWSER_CHANNEL=chrome node scripts/validate-returns-flow.mjs
BROWSER_CHANNEL=chrome npm run test:log-returns-browser
BROWSER_CHANNEL=chrome npm run test:portfolio-browser
BROWSER_CHANNEL=chrome node scripts/validate-design-system.mjs
```

Run migrations and seed on a disposable local QA database, with `DATABASE_URL` and local auth/provider settings explicitly exported. Re-run `db:seed` followed by `test:curriculum-seed` to verify idempotence. Personalization upgrade QA additionally requires a fresh database and explicit opt-in; see [onboarding](docs/onboarding.md). Browser suites create and remove only their own local disposable identities. Screenshots are written under `/tmp`, never the repository.

## Demo retention

Anonymous demo sessions expire after 24 hours. Their database identities may remain until cleanup. Preview or apply the bounded cleanup with:

```bash
npm run demo:cleanup
npm run demo:cleanup -- --apply
```

Only users explicitly marked `is_anonymous = true` and older than seven days are eligible; cascading foreign keys remove their sessions, profile, progress, and award receipts.

See [current product contracts](docs/product-reset.md) for reward, streak, daily-goal, synthetic-data, migration, compatibility, and validation semantics. Current policy v2 grants no capital per lesson; normal learners receive the one-time 5,000 Kč Portfolio Lab unlock after Foundations, while legacy lesson receipts retain their stored capital.
