# Navigation performance baseline

Phase 0: measure only. No business logic, UI, schema, or financial behaviour was changed.
Measured 2026-10-14 on the code at `b71cde1` plus the instrumentation described below.

## Summary

Navigation between `/learn`, `/progress`, `/lab` and `/lab/portfolio` is slow for two independent reasons. Which one you feel depends on how far the app is from its database.

1. **A fixed ~300 ms client-side floor (measured).** Every soft navigation takes 320–335 ms even though the server answers in 10–15 ms. The route's `loading.tsx` fallback paints at ~6 ms, then React holds the real content back until ~300 ms after the fallback committed. Removing the `loading.tsx` files in a throwaway build dropped navigation to 22–39 ms with identical server work. The mechanism is React's Suspense reveal throttle (`globalMostRecentFallbackTime + 300` in the bundled `react-dom` 19.2.8).
2. **Database round-trips dominate server time as soon as the database is not on localhost (measured with injected latency).** A page runs 8–19 queries; 5–15 of them sit on one sequential chain, and each query costs about two round-trips because the pool is created with `prepare: false`. With +30 ms RTT the server needs 0.6–1.0 s per route; with +60 ms, 1.1–1.9 s. The portfolio-unlock transaction alone is 46–77 % of that.

Both stack as `navigation ≈ max(~320 ms floor, server time + ~25 ms)`. This was checked with the real `loading.tsx` files at +10 ms and +30 ms RTT (table below).

External market data (FMP quotes, ČNB FX) adds another measured ~320 ms + ~110 ms on a cold cache for any route that values a portfolio, but the deterministic benchmark does not exercise it (see "External API latency").

**What was not measured:** the real RTT between the Vercel function and Neon, Vercel cold starts, and Neon compute wake-up. The RTT sensitivity table is a model of that gap, not a production measurement.

**Phase 1 (bottleneck #3) is done:** the unlock status read no longer opens a transaction or takes the row lock, and its five reads are one statement. See "Phase 1: unlock read path" at the end. The tables between here and there are the original baseline.

**Phase 2 (bottlenecks #4 and #6) is done:** session, learning profile and unlock status are read once per request, duplicate learner reads are gone, and independent reads run concurrently. At +30 ms RTT `/learn` server time went 602 → 354 ms. See "Phase 2: request-scoped reads and concurrency".

**Phase 3 (bottleneck #1) is done:** the ~300 ms client floor is gone when the server is fast. Route-level `loading.tsx` boundaries on the main routes were replaced by one persistent boundary in the `(app)` layout plus a `useLinkStatus` pending indicator. At +0 ms, navigation went from 321 to 40 ms. When the server is slower than the floor, navigation is 2–5 % slower than before on the data routes. See "Phase 3: client navigation floor".

**Phase 4 (bottleneck #2) is evaluated, not shipped:** `prepare: false` stays. `prepare: true` alone changes nothing (Drizzle's `unsafe()` calls are never prepared); forcing named prepared statements halves server time at +30 ms RTT locally, but Neon pooler compatibility is unverified and PgBouncer serves stale plans after a column-type migration. See "Phase 4: prepared statements".

## What is measured, and how the layers are separated

| Layer | Metric | Source |
| --- | --- | --- |
| Navigation latency | `navigationMs`: click until the destination `h1` is in the DOM, plus two animation frames | in-page `MutationObserver` (Playwright) |
| Perceived feedback | `feedbackMs`: click until the URL has changed and the loading UI is up (no `h1` yet) | same |
| Network + server TTFB | `rscResponseMs`: click until response headers of the non-prefetch `_rsc` request | Playwright `request.timing()` |
| After response | `afterResponseMs`: navigation end minus RSC response start. Body streaming, React commit, paint; includes the React throttle | derived |
| Server execution | `serverPageMs`: wall time of the page render, with per-operation breakdown, query count and query shapes | `[investi:perf]` server log lines |
| External API latency | `kind: "external"` operations on the server; measured separately against the live providers (below) | server log + `external-latency` run |
| Client rendering | not isolable on its own; with the throttle removed `afterResponseMs` is 15–32 ms (Apple M4, no CPU throttling) | no-loading experiment |

Playwright never reports the streamed navigation response as finished, so no RSC end time is taken; `rscResponseMs` is response start only.

## Environment

- Apple M4, macOS 15.6, Node 24.15.0, Next.js 16.3.4 production build (`next build` + `next start`), React 19.2.8, Chrome 155 (headless, 1440×900, no CPU or network throttling).
- PostgreSQL 15.19 on localhost, freshly migrated and seeded, throwaway database. No production or shared database was touched.
- `MARKET_DATA_PROVIDER=deterministic`, `FX_DATA_PROVIDER=deterministic`, so external latency is ~0 in the navigation benchmark.
- QA identity: one anonymous demo account created through `/api/auth/sign-in/anonymous` (authenticated, Portfolio Lab unlocked, two seeded holdings), deleted by the script afterwards.
- Cold = a brand-new browser context per run (empty router cache, no prefetched shells), 8 runs per route, server already warm after the first. Warm = one context, first pass discarded, 30 passes. The first requests after process start are listed under "Process-cold".
- Percentiles are nearest-rank. With n=8 the p95 is effectively the maximum.

## Results

All values are milliseconds, **median / p95**, localhost database, real `loading.tsx` files. Warm = 30 passes; cold = 8 runs.

### Soft navigation, warm client (n=30)

| Route | Navigation | Feedback | RSC response | After response | Server page | DB queries |
| --- | --- | --- | --- | --- | --- | --- |
| `/learn` | 321.8 / 322.9 | 6.3 / 7.1 | 7.0 / 9.1 | 313.7 / 316.0 | 14.6 / 18.4 | 19 |
| `/progress` | 320.4 / 324.4 | 5.6 / 6.8 | 7.1 / 8.1 | 313.8 / 317.3 | 13.1 / 17.2 | 18 |
| `/lab` | 335.4 / 339.6 | 5.4 / 6.2 | 7.2 / 8.1 | 329.0 / 332.2 | 11.8 / 14.0 | 8 |
| `/lab/portfolio` (extended cycle) | 321.9 / 327.0 | 6.1 / 7.5 | 8.1 / 22.9 | 304.4 / 323.1 | 12.2 / 17.0 | 13 |

### Soft navigation, cold client (n=8)

| Route | Navigation | Feedback | RSC response | After response | Server page |
| --- | --- | --- | --- | --- | --- |
| `/learn` | 320.5 / 323.6 | 6.6 / 9.4 | 7.0 / 10.5 | 311.9 / 315.7 | 12.4 / 17.9 |
| `/progress` | 329.1 / 337.3 | 5.5 / 9.1 | 3.6 / 4.4 | 325.6 / 334.5 | 10.4 / 15.8 |
| `/lab` | 331.0 / 340.5 | 8.2 / 8.9 | 8.7 / 12.3 | 322.9 / 328.8 | 13.5 / 18.0 |
| `/lab/portfolio` | 323.2 / 357.3 | 10.1 / 11.0 | 8.3 / 8.5 | 315.1 / 349.8 | 14.7 / 15.2 |

Cold and warm clients are indistinguishable here: the floor, not the network, decides. Prefetching does not remove it.

### Full document loads (hard navigation, new tab, n=30)

| Route | TTFB | DOMContentLoaded | Load |
| --- | --- | --- | --- |
| `/learn` | 8.7 / 10.7 | 35.2 / 42.1 | 57.7 / 66.3 |
| `/progress` | 8.5 / 10.2 | 35.2 / 45.2 | 57.1 / 65.6 |
| `/lab` | 9.1 / 10.4 | 30.5 / 33.0 | 47.1 / 53.7 |
| `/lab/portfolio` | 9.6 / 14.5 | 32.3 / 39.3 | 53.8 / 60.4 |

A hard load does not wait for the throttle (no soft-navigation fallback), so it is faster than a soft navigation on localhost. This is the opposite of what the router is meant to give.

### Process-cold (first requests after `next start`)

`layout 38.3 ms / 11 queries`, `/learn 70.6 ms / 26 queries`, then `/progress 12.7 ms`, `/lab 13.2 ms`, `/learn 17.9 ms`. One observation each, so an indication only. It does not include a real serverless cold start.

### Experiment 1: is the ~300 ms the loading fallback? (diagnostic build, not a fix)

The six `loading.tsx` files (and the two tests that import them) were moved out temporarily, the app rebuilt, and the same benchmark rerun. Files were restored afterwards; nothing of this is in the commit.

| Route | Navigation (with `loading.tsx`) | Navigation (without) | Server page (without) |
| --- | --- | --- | --- |
| `/learn` | 320.7 / 323.8 | 37.6 / 39.8 | 11.6 / 13.0 |
| `/progress` | 321.5 / 324.0 | 38.6 / 41.6 | 10.7 / 12.4 |
| `/lab` | 324.8 / 339.0 | 22.9 / 39.2 | 7.3 / 8.9 |
| `/lab/portfolio` | 321.9 / 327.0 | 24.0 / 38.4 | 10.2 / 11.5 |

(`n=30`, extended cycle, warm.) Without a fallback there is also no feedback before the content, so this removes the floor but not the need for feedback when the server is slow. It identifies the cause; it is not the recommended remedy.

### Experiment 2: database round-trip sensitivity

`scripts/pg-latency-proxy.mjs` sits between the app and the local database and delays every chunk, adding the stated RTT. Server page time, median ms (RTT 0 is the n=30 run, others n=10):

| Route | Queries | +0 ms | +10 ms | +30 ms | +60 ms | ≈ RTTs on the path |
| --- | --- | --- | --- | --- | --- | --- |
| `/learn` | 19 | 11.6 | 393.6 | 991.6 | 1899.2 | 31 |
| `/progress` | 18 | 10.7 | 369.9 | 924.4 | 1775.3 | 29 |
| `/lab` | 8 | 7.3 | 236.2 | 593.7 | 1138.3 | 19 |
| `/lab/portfolio` | 13 | 10.2 | 341.0 | 857.1 | 1645.5 | 27 |

The last column is the least-squares slope of server time against added RTT, i.e. sequential round-trips. It exceeds the query count because each query costs ~2 round-trips (see bottleneck 2).

These runs used the no-loading build, so navigation ≈ server time + ~25 ms. To check the combined model, the real build was run at +10 and +30 ms (n=10, warm, navigation / server page):

| Route | +0 ms | +10 ms | +30 ms |
| --- | --- | --- | --- |
| `/learn` | 321 / 14 | 389 / 364 | 1021 / 993 |
| `/progress` | 321 / 15 | 363 / 338 | 954 / 927 |
| `/lab` | 325 / 10 | 335 / 217 | 636 / 598 |
| `/lab/portfolio` | 322 / 12 | 339 / 316 | 881 / 860 |

`/lab` at +10 ms is the clean case: the server needs 217 ms, yet navigation stays at the 335 ms floor. Once the server exceeds the floor, it is the server that is felt.

### External API latency (live providers, measured separately)

Through the project's own `createMarketDataService` (FMP securities, ČNB FX), from this machine's network, 6 fresh services, AAPL/USD→CZK, read-only:

| Operation | Median | Max |
| --- | --- | --- |
| Instrument metadata (cache miss) | 156.9 | 467.5 |
| Quote (cache miss) | 319.0 | 322.1 |
| FX rate (cache miss) | 112.7 | 143.1 |
| Quote / FX (cache hit) | 0.3 / <0.1 | 0.4 / 0.1 |

Cache TTLs are in-process: quote 30 s, instrument 24 h, ČNB FX per its own TTL. Each serverless instance has its own cache. `observePortfolioHoldingValue` fetches the quote, then FX (sequential); `getQuote` resolves metadata first. A holding on a cold instance therefore costs up to ~157 + 319 + 113 ≈ 590 ms; holdings run concurrently with each other. This is a sum of separately measured parts, **not** an end-to-end measurement, and it is measured from this machine rather than from Vercel.

## Server-side audit

### Execution path per route (soft navigation)

The `(app)/layout.tsx` does **not** run on soft navigation: in the benchmark log it executed 138 times (the 138 document loads) against 411 page renders (273 soft navigations + the same 138 document loads). Each soft navigation rendered its page exactly once, and prefetches rendered no page code. So on soft navigation only the page path below counts; on a hard load the layout path is added first.

```
layout (hard load only, 9–11 queries, ~5.5 ms local)
  getSession → learningProfile → [hasLearningHistory if no completed onboarding] → loadPortfolioLabUnlock

/learn      (19 queries)                         /progress   (18)
  getSession                                       getSession
  ├ lessonProgress ┐                               ├ lessonProgress ┐
  ├ learningProfile│ parallel                      ├ learningProfile│ parallel
  ├ gamification   │ (→ lesson_award,              ├ gamification   │
  └ practiceCapital┘   profile again)              └ practiceCapital┘
  loadPortfolioLabUnlock (tx)                      loadPortfolioLabUnlock (tx)
  loadPortfolioView (if unlocked)                  loadPortfolioLedgerSummary (if unlocked, no market data)

/lab        (8)                                  /lab/portfolio (13)
  getSession                                       getSession
  loadPortfolioLabUnlock (tx)                      loadPortfolioLabUnlock (tx)
                                                   loadPortfolioView
loadPortfolioLabUnlock (tx) = BEGIN; SELECT user FOR UPDATE; 5 reads via Promise.all; [INSERT]; COMMIT
loadPortfolioView = getOrCreateActivePortfolio → (entitlement[2 queries] ∥ trades) → (holding valuation ∥ latestAllocation)
```

### Where the time goes at +30 ms RTT (median of 12 renders each)

| Route | Server page | `getSession` | Unlock transaction | Portfolio view / ledger | Learner reads (parallel) |
| --- | --- | --- | --- | --- | --- |
| `/learn` | 992 | 134 | 460 (46 %) | 263 | 133 |
| `/progress` | 924 | 133 | 459 (50 %) | 198 | 133 |
| `/lab` | 594 | 135 | 460 (77 %) | – | – |
| `/lab/portfolio` | 858 | 135 | 459 (53 %) | 263 | – |

The 5 reads inside the unlock transaction run through one connection, so `Promise.all` does not parallelise them: `ensureUnlock` takes 327–329 ms ≈ 5 × 66 ms, and 66 ms ≈ one query.

### Duplicate calls (counted per page render, localhost)

| Table / call | Times | Why |
| --- | --- | --- |
| `select user` | 3 | session lookup, `FOR UPDATE` lock, `isAnonymous` in unlock facts |
| `lesson_award` | 4 (`/learn`, `/progress`), 2 (`/lab/portfolio`) | gamification, practice capital, unlock XP, portfolio entitlement |
| `progression_unlock` | 3 (2 on `/lab/portfolio`) | practice-capital grants, unlock facts, entitlement |
| `learning_profile` | 2 (3 on hard load) | `loadLearner` and `loadGamification` both read it; layout reads it again |
| `lesson_progress` | 2 | learner states and unlock "completed lessons" |
| `portfolio` | 2 | unlock "grandfathered" check and `getOrCreateActivePortfolio` |
| `getCurrentUser` / `getSession` | 2 on a hard load | layout and page each resolve the session; not request-scoped cached |
| `loadPortfolioLabUnlock` | 2 on a hard load of `/learn`, `/lab`, `/lab/portfolio`, `/progress` | once in the layout, once in the page; each takes the user-row lock |

"Repeated" is a candidate for deduplication, not proof of waste; some repeats ask different questions of the same table.

### Sequential work that could probably run concurrently

Analysis only; nothing was changed. Each needs a check that behaviour is preserved.

1. Layout: `learningProfile` → `hasLearningHistory` → `loadPortfolioLabUnlock`. The unlock needs only the user id, not the profile.
2. `/learn` and `/progress`: `loadLearner()` finishes (session + four reads) before `loadPortfolioLabUnlock` starts; both depend only on the user id.
3. `loadPortfolioRows`: `entitlement` runs two queries back to back (`lesson_award` sum, then `progression_unlock` sum). `loadPracticeCapitalSummary` does the same.
4. `loadLatestAllocation` starts only after `loadPortfolioRows` returns; it needs only the portfolio id, so it could start with `trades`.
5. `observePortfolioHoldingValue`: FX waits for the quote, but the quote currency is already known from the trade ledger.
6. `loadPortfolioLabUnlock`: after the row lock, the five reads share a connection and run serially (see above).
7. `/learn` awaits the full valuation (`loadPortfolioView`, including external quotes) before sending the page, although it is a secondary card. A `Suspense` boundary or the ledger-only summary used by `/progress` would not block the main content. This is a UX/domain decision for a later phase.

## Suspected bottlenecks, ranked by measured impact

| # | Finding | Evidence | Impact |
| --- | --- | --- | --- |
| 1 | Suspense fallback throttle: content is held ~300 ms after the `loading.tsx` fallback | measured (baseline vs experiment 1); mechanism in `react-dom` source | +285–310 ms on every soft navigation whose server time is under ~300 ms; the whole perceived navigation time in a fast environment |
| 2 | ~2 round-trips per query: `postgres(url, { prepare: false })` makes postgres.js describe every parameterised statement first (`describeFirst = parameters.length && !prepared`, `node_modules/postgres/src/connection.js:238`); ≈66 ms per query at +30 ms RTT | measured (experiment 2, timeline); driver behaviour read in source | doubles the cost of every query on a remote database. `prepare: false` is normally needed behind a transaction-mode pooler, so whether it can change must be verified against the Neon endpoint in use |
| 3 | Unlock transaction on every read: a write-locking `SELECT … FOR UPDATE` plus five serialised reads, on every page view and again in the layout | measured | 46–77 % of server time at +30 ms RTT; also serialises concurrent tabs of the same user on one row lock |
| 4 | Long sequential chain: 15 of 19 queries on the critical path of `/learn` | measured (timeline) | with #2 and #3 the reason server time scales ~30× RTT |
| 5 | Portfolio valuation on a cold or expired cache blocks `/learn` and `/lab/portfolio` | measured per-call latency; not reproduced end to end | up to ~590 ms per holding on a cold instance or after 30 s without quote traffic |
| 6 | Redundant reads and a second session lookup/unlock on hard loads | measured counts | small at RTT 0, multiplies with #2 |

Impact figures for #2–#4 are in milliseconds of injected latency, not production milliseconds; production impact is that table evaluated at the true Vercel↔Neon RTT, which still has to be measured.

## Instrumentation

`src/lib/perf.ts`, enabled only when the server process has `INVESTI_PERF_DEBUG=1` (read once at module load). When unset, every helper returns its callback untouched and the Drizzle logger is not attached; behaviour and UI are unchanged.

- `perfSegment(name, fn)` wraps a layout or page. On completion it prints one line: `[investi:perf] {…}` with `segment`, a per-request id (random, scoped by `React.cache`), `totalMs`, per-label ops (`calls`, `totalMs`, `maxMs`, `kind`: auth/db/external/compute), `repeatedOps`, `counters` (market-data cache hit / miss / coalesced by family), `dbQueryCount`, `repeatedQueryShapes`, and an op `timeline`. Durations use `performance.now()`.
- `perfMeasure(label, kind, fn)` times an async operation inside the active segment. Applied to: session lookup, layout reads, `loadLearner`'s four reads, the unlock check (`progression.loadPortfolioLabUnlock`, its read `progression.readUnlockFacts`, and on the write path `lockUserRow` and `ensureUnlock` separately), `loadPortfolioRows`, `loadPortfolioView` and each holding valuation, and every market-data provider call (`MarketDataService.call`, i.e. cache misses only).
- Query counts come from a Drizzle `logger` that receives the parameterised SQL text and keeps only `verb + table names`.
- `BEGIN`/`COMMIT` issued by postgres.js are not logged by Drizzle, so `dbQueryCount` excludes them (+2 per transaction).
- Nothing logged contains parameters, cookies, tokens, user ids or emails. Do not enable it in production by default; it prints one line per route render.
- Unit tests: `src/lib/perf.test.ts` (disabled pass-through, aggregation, no parameters in output, failure path).

## Reproduce

Needs a disposable local database; the script refuses a non-local `DATABASE_URL` or base URL.

```bash
# 1. Disposable Postgres (or use the Docker one on 5433) and migrate
initdb -D /tmp/investi-perf-pg -U qa --auth=trust
pg_ctl -D /tmp/investi-perf-pg -o "-p 5544 -c listen_addresses=127.0.0.1" -l /tmp/investi-perf-pg.log -w start
createdb -h 127.0.0.1 -p 5544 -U qa investi_perf

export DATABASE_URL=postgresql://qa@127.0.0.1:5544/investi_perf
export BETTER_AUTH_URL=http://localhost:3100 NEXT_PUBLIC_APP_URL=http://localhost:3100
export MARKET_DATA_PROVIDER=deterministic FX_DATA_PROVIDER=deterministic INVESTI_PERF_DEBUG=1
npm run db:migrate && npm run db:seed

# 2. Production build on a free port; log to a file for server-side correlation
npm run build
npx next start -p 3100 > /tmp/investi-server.log 2>&1 &

# 3. Benchmark (writes test-results/navigation-benchmark.json, gitignored)
BENCH_BASE_URL=http://localhost:3100 BENCH_SERVER_LOG=/tmp/investi-server.log \
  BENCH_ITERATIONS=30 BENCH_COLD_RUNS=8 npm run bench:navigation
```

Do not run it against `next dev` (dev timings are not representative) or against a shared or production database. Stop any dev server before `next build` (it shares `.next`).

Optional database latency sensitivity (restart the app with the proxy's port in `DATABASE_URL`, and use the same URL for the benchmark):

```bash
node scripts/pg-latency-proxy.mjs 5610 5544 5   # +5 ms each way = +10 ms RTT
export DATABASE_URL=postgresql://qa@127.0.0.1:5610/investi_perf
```

Settings: `BENCH_ITERATIONS` (warm passes, default 15), `BENCH_COLD_RUNS` (default 5), `BENCH_OUTPUT`, `BROWSER_CHANNEL` (default `chrome`). The JSON contains every sample plus the correlated server segments.

To measure external API latency, set `MARKET_DATA_PROVIDER=fmp`, `FX_DATA_PROVIDER=cnb` and a key, and time `MarketDataService` calls directly (see `scripts/smoke-fmp-market-data.mts` for the setup). The navigation benchmark's demo account is only seeded with holdings under the deterministic provider, so it cannot exercise live valuation on its own.

## Limits of this baseline

- Localhost database and deterministic market data: absolute server times are lower bounds. Experiment 2 shows how steeply they rise; the real RTT to Neon is unknown and is the first number to collect from a deployed environment (run the instrumented build with `INVESTI_PERF_DEBUG=1` and read the Vercel function logs).
- One machine, one browser, no CPU or network throttling: client rendering time on a typical phone is not covered.
- Vercel cold starts, Neon compute wake-up and region placement are not measured.
- Per-route loading markup differs, so `feedbackMs` uses "URL committed and no `h1`", not a specific element.
- The React throttle explanation rests on the measured experiment and the bundled source; the exact reveal timing can differ slightly between React versions.

## Phase 1: unlock read path (measured 2026-10-14)

Addresses bottleneck #3. No schema, migration, reward policy or unlock-rule change; `prepare: false`, `loading.tsx` and the instrumentation are untouched.

### What changed

`src/features/progression/repository.ts`

- **One statement for the facts.** XP total, completed lesson ids, "unlock recorded", "has a portfolio" and `isAnonymous` come from a single `SELECT` on `user` with scalar subqueries (each served by an existing primary key or index). One statement is also one snapshot, so the facts are mutually consistent even without a transaction. Used on both paths, including inside `completeLesson`.
- **Read first, lock only to record.** `resolvePortfolioLabUnlock` (pure, in `unlocks.ts`) decides from the facts whether anything must be written. A recorded unlock or a still-locked account is answered from that one read: no `BEGIN`, no `SELECT … FOR UPDATE`, no `COMMIT`, no write. Only an unlocked account without a record (first demo visit, legacy repair, grandfathered portfolio) takes the original path: transaction, user row lock, re-read under the lock, `INSERT … ON CONFLICT DO NOTHING`.

Why the lock-free read is safe: `progression_unlock` and `portfolio` rows are never deleted (only by the user cascade), so "recorded" and "grandfathered" only ever go from false to true. A read can at worst see an account as still locked while a completion is committing; that completion records and reports the unlock itself, under the lock. Every grant still happens under the user row lock with the unique `(user_id, unlock_id)` key, so exactly-once is unchanged.

### Unlock check alone (direct calls, n=20 sequential, median ms)

`loadPortfolioLabUnlock` from a script against the disposable database, through `scripts/pg-latency-proxy.mjs`. Queries are Drizzle-logged statements; `BEGIN`/`COMMIT` are extra and not logged.

| Case | Queries before → after | +0 ms | +10 ms | +30 ms |
| --- | --- | --- | --- | --- |
| Recorded unlock | 6 + BEGIN/COMMIT → 1 | 1.0 → 0.3 | 166.8 → 27.0 | 460.3 → 69.8 |
| Locked learner | 6 + BEGIN/COMMIT → 1 | 0.9 → 0.3 | 167.0 → 26.7 | 458.8 → 69.8 |
| Demo, recorded | 6 + BEGIN/COMMIT → 1 | 0.6 → 0.3 | 166.3 → 26.5 | 459.0 → 69.8 |
| First recording (write path, demo) | 7 + BEGIN/COMMIT → 4 + BEGIN/COMMIT | 1.4 → 1.3 | – | 553.3 → 347.6 |
| Read while another session holds the user row lock for 500 ms | – | 506.9 → 0.3 | 647.5 → 26.3 | 898.1 → 70.5 |
| 8 concurrent reads, same user (wall time) | – | 26.6 → 5.5 | 1096 → 62 | 3023 → 147 |

At +30 ms that is ≈15 round-trips → ≈2.3 (one statement, which still costs two round-trips under `prepare: false`). The last two rows are the lock contention that disappeared: before, every page view queued behind any completion, trade or other tab of the same user; the eight reads were fully serialised.

### Navigation (same build and benchmark as above, warm, median ms)

Before and after were both measured in this session on the same machine, database and seeds (`HEAD` at `00952de`, then the change). Navigation n=30 at +0 and n=20 at +10/+30 (`/lab/portfolio` half of that, extended cycle only). Server page and unlock time are from `[investi:perf]` lines.

| Route | Queries | Navigation +0 | Navigation +10 | Navigation +30 | Server page +30 | Unlock in page +30 |
| --- | --- | --- | --- | --- | --- | --- |
| `/learn` | 19 → 14 | 321.7 → 320.9 | 422.5 → 318.4 | 1072.3 → 623.1 | 1043.8 → 600.7 | 483.8 → 66.7 |
| `/progress` | 18 → 13 | 321.0 → 320.9 | 398.3 → 318.4 | 1003.2 → 559.4 | 972.7 → 533.9 | 482.9 → 66.8 |
| `/lab` | 8 → 3 | 335.7 → 337.2 | 336.8 → 332.8 | 656.4 → 333.9 | 626.8 → 201.7 | 485.2 → 66.7 |
| `/lab/portfolio` | 13 → 8 | 321.7 → 321.5 | 365.3 → 316.4 | 922.4 → 488.9 | 902.3 → 466.0 | 484.0 → 66.6 |

Sequential round-trips on the server path (slope of server time against added RTT): `/learn` ≈34 → ≈20, `/progress` ≈32 → ≈17, `/lab` ≈21 → ≈6, `/lab/portfolio` ≈30 → ≈15.

At +10 ms every route is now under the ~320 ms client floor (bottleneck #1), so navigation no longer changes with the database there; at +30 ms `/lab` is too. At +0 ms nothing changes: the floor decides.

Hard loads, TTFB median (layout and page each run the unlock check): +10 ms 263–384 → 99; +30 ms 696–1010 → 268–270. `DOMContentLoaded` at +30 ms: `/learn` 1362 → 608, `/lab` 1037 → 297.

The absolute "before" values are 1–6 % above the original baseline tables (same code, different run); the comparison above uses only numbers from this session.

### Validation

- `npm run test:progression-persistence` (disposable database) adds: a recorded and a locked account are read while another session holds the user row lock (the old code fails this, verified), with no rows written; eight concurrent `requirePortfolioLabUnlock` calls; a missing user still throws; a first demo recording does wait for the row lock; six concurrent reads, two action guards and a lesson completion on a qualifying unrecorded (legacy) account grant 5,000 Kč exactly once.
- Unit tests for `resolvePortfolioLabUnlock` in `unlocks.test.ts`.
- Unchanged and passing: `test:persistence`, `test:migration`, `test:portfolio-persistence` (buy/sell/reward concurrency), `test:portfolio-allocation`, `test:portfolio-migration`, `test:portfolio-closed-market`, `test:personalization-persistence`, `test:curriculum-seed`, `test:log-returns-persistence`.

### Remaining lock contention and next steps

- The user row lock is still taken, by design, by lesson completion and progress saves, trades, mixes, resets, demo seeding and first portfolio creation. Lesson completion now holds it for four fewer queries, because its unlock check is the one-statement read.
- The write path (first demo visit, legacy or grandfathered repair) still locks the row; it runs once per account.
- A hard load still runs the unlock check twice (layout and page); each is now one statement. A request-scoped `React.cache` would remove one.
- Still open from the baseline: two round-trips per query (`prepare: false`), `loadLearner` and the unlock check running one after the other on `/learn` and `/progress`, the two-query entitlement in `loadPortfolioRows`, and the ~300 ms `loading.tsx` floor.

## Phase 2: request-scoped reads and concurrency (measured 2026-10-14)

Addresses bottlenecks #4 (long sequential chain) and #6 (redundant reads, second session lookup and unlock on hard loads). No schema, migration, reward policy, unlock rule, auth configuration or `loading.tsx` change; `prepare: false` and the Phase 1 read path are untouched.

### What changed

- **`requestMemo` (`src/lib/request-memo.ts`).** A thin wrapper over `React.cache`: one call per argument list per RSC render, shared by the layout and page of that request. React scopes the cache to the Flight request, so nothing crosses requests or users. Outside a render (Server Actions, route handlers, scripts) React has no request and does not memoize; every mutation path keeps its own fresh reads. The wrapper adopts the result into a native promise, because a Drizzle query is a lazy thenable that re-executes on every `then` (caching it directly ran the profile SQL twice per render; caught by the instrumentation, covered by a unit test). No `unstable_cache`, `use cache` or process-level cache is used.
- **Memoized per request:** the Better Auth session (`getCurrentUser`), `getLearningProfile`, and the new `loadPortfolioLabUnlockStatus` for rendering. The status variant still records a first unlock (once per request instead of once in the layout and once in the page) and returns only the status, never `newlyUnlocked` / `capitalAwardedMinor`. `loadPortfolioLabUnlock` and `requirePortfolioLabUnlock` (actions, lesson completion) are not memoized.
- **Learner reads deduplicated.** `loadGamification` reuses the request's profile instead of reading it again. Practice Capital (`readPracticeCapitalEntitlementMinor`) is one statement with two scalar sums (lesson receipts, unlock grants) added as `BigInt`: same authoritative rows, same exact integers, one round-trip instead of two sequential ones. The portfolio ledger's entitlement uses the same function, including inside the trade, mix, reset and creation transactions.
- **Concurrency once the user is known.** `/learn` and `/progress` load the learner summary alongside the unlock and portfolio card (the unlock no longer waits for the learner). The layout reads profile and unlock together. Settings, the module page and the lesson page start their independent reads together. `loadPortfolioView` loads the saved mix alongside the ledger (it needs only the generation id).
- **Kept sequential on purpose.** The portfolio view still starts only after the unlock check: `getOrCreateActivePortfolio` can create a generation, which must not happen for a locked account. The learner's Practice Capital and the ledger's entitlement are still separate reads on `/learn`; the ledger value is read next to the trades it is folded with, rather than reused from earlier in the request.

Why the layout may read the unlock before its onboarding redirect: an account that still needs onboarding has no lessons, awards, unlock rows or portfolio, and demo identities are seeded with a completed profile before their session exists, so that check is a plain read that cannot write. The page renders in parallel with the layout and already ran the same check before this change. `test:onboarding-redesign` ("no financial/learning writes") passes.

### Soft navigation, warm (median / p95 ms, before → after)

Same machine, disposable database, seeds and benchmark; "before" is `639f2d4` measured in this session. n=20 at +0 ms, n=15 at +10/+30 ms (`/lab/portfolio` from the extended cycle). Server = `serverPageMs` from `[investi:perf]`.

| Route | Queries | Navigation +0 | Navigation +10 | Navigation +30 | Server +0 | Server +10 | Server +30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/learn` | 14 → 11 | 320.3 / 322.4 → 320.7 / 323.1 | 320.5 / 323.2 → 321.5 / 325.6 | 624.5 / 638.7 → 376.4 / 387.7 | 12.9 → 12.1 | 221.6 → 135.7 | 601.6 / 609.3 → 354.1 / 361.9 |
| `/progress` | 13 → 10 | 320.4 / 322.6 → 320.8 / 333.3 | 320.1 / 341.2 → 319.9 / 337.3 | 558.8 / 573.2 → 376.7 / 389.6 | 13.3 → 11.3 | 197.4 → 135.3 | 532.8 / 540.0 → 353.7 / 358.3 |
| `/lab` | 3 → 3 | 328.1 / 339.2 → 336.4 / 340.9 | 325.9 / 339.6 → 336.4 / 338.8 | 337.4 / 339.2 → 337.2 / 339.9 | 8.6 → 8.9 | 74.5 → 82.2 | 203.0 / 205.5 → 211.9 / 216.4 |
| `/lab/portfolio` | 8 → 7 | 318.0 / 323.0 → 321.2 / 322.8 | 320.6 / 323.2 → 321.5 / 340.8 | 488.7 / 491.6 → 371.1 / 375.8 | 10.1 → 9.1 | 171.7 → 135.3 | 465.6 / 469.7 → 350.1 / 355.0 |

Sequential round-trips (slope of server time against added RTT): `/learn` ≈20 → ≈11, `/progress` ≈17 → ≈11, `/lab/portfolio` ≈15 → ≈11, `/lab` ≈6.5 → ≈6.8.

At +0 and +10 ms every route stays at the ~320 ms client floor (bottleneck #1), before and after: the server already answered well under it, so unchanged navigation there is expected and says nothing about the backend. The server columns show the backend gain. At +30 ms the server now needs ~350 ms on the three data routes, just above the floor, and navigation follows it.

`/lab` runs the same three statements before and after. In the "after" runs, identical statements were 4–10 % slower than in the "before" runs (unlock read at +30: 66.9 → 70.0 ms; session: 135.3 → 142.6 ms), and `/lab`'s +8–9 ms matches that drift. It is attributed to the environment, not proven.

### Hard loads (layout + page in one request)

| Route | Queries per request | Layout +30 | Page +30 | TTFB +10 | TTFB +30 | DOMContentLoaded +30 |
| --- | --- | --- | --- | --- | --- | --- |
| `/learn` | 18 → 11 | 263.9 → 208.4 | 590.4 → 345.3 | 99.6 → 83.1 | 268.0 → 212.4 | 605.2 → 352.1 |
| `/progress` | 17 → 10 | 263.1 → 208.6 | 523.5 → 345.5 | 99.3 → 83.1 | 268.0 → 213.2 | 536.9 → 354.4 |
| `/lab` | 7 → 4 | 261.5 → 207.1 | 197.0 → 206.9 | 99.1 → 82.8 | 268.0 → 212.8 | 295.4 → 235.0 |
| `/lab/portfolio` | 12 → 8 | 262.7 → 208.2 | 458.0 → 343.6 | 99.0 → 82.8 | 268.5 → 212.4 | 464.0 → 349.1 |

Medians, n=15–28. The memo counters confirm one read per request on every hard load: e.g. `/learn` `memo.call.session: 3, memo.miss.session: 1`, `learningProfile 3 / 1`, `portfolioLabUnlock 2 / 1`. The layout and page render concurrently (evidence: on the old build a demo's first hard load showed the pre-grant Practice Capital, so the page read it before the layout's grant committed; see below), so a hit is usually a shared in-flight promise, not a finished one.

### Remaining repeated reads (soft `/learn`, after)

`select lesson_award,progression_unlock` ×2: the learner's Practice Capital and the ledger's entitlement (kept separate, see above). No other shape repeats on any of the four routes.

### Remaining sequential bottlenecks (at +30 ms, `/learn`)

`session (≈142) → unlock (≈70) → active generation (≈70) → ledger + mix (≈70)`. In order of size:

1. **Session lookup, ~40 % of every route:** Better Auth issues two sequential statements (session, then user), each two round-trips under `prepare: false`. Options (not done, they change auth behaviour or configuration): Better Auth's signed cookie cache, which delays revocation by its max-age, or a joined lookup.
2. **`prepare: false`:** still ~2 round-trips per statement (bottleneck #2), unchanged by design.
3. **Unlock → generation → ledger:** the portfolio view cannot start before the unlock because it may create a generation. A plain read of an existing active generation could run alongside the unlock, with creation kept behind it; trades could be selected by a subquery on the active generation. Each removes ~one query depth.
4. **Saved mix:** `loadLatestAllocation` is two sequential statements when a mix exists. The benchmark's demo account has none, so this is not in the numbers above.
5. **Client floor (~320 ms):** untouched (out of scope).

### Pre-existing behaviour found, not changed

On a demo's first render, the unlock check records the 5,000 Kč grant while the learner summary reads Practice Capital in parallel, so the "Cvičný kapitál" figure can show the pre-grant value for that one render (the old build showed "0 Kč" on 2/2 first hard loads; the next request shows 5 000 Kč). Before this change, the layout's recording raced the page the same way, and a soft first render read Practice Capital strictly before the unlock. Accounting is unaffected: the portfolio's cash comes from the entitlement read after the unlock. Fixing the display needs the render to know whether its unlock check granted capital; that is a product decision for a later phase.

### Validation

- Unit (`npm test`, 80 files / 766 tests): `src/lib/request-memo.test.ts` runs `requestMemo` against React's real server `cache` with a per-request dispatcher: one read per argument list within a request (including concurrent callers), separate reads in separate requests, no memoization outside a render, a rejection shared only within its request, a lazy thenable executed once, and the perf counters.
- `test:progression-persistence` adds: the status variant is not memoized outside a render (a completion is visible on the next call) and exposes no grant outcome; four concurrent status reads plus an action guard repair a qualifying unrecorded account exactly once (5,000 Kč); the one-statement entitlement equals independent SQL sums exactly, including a 9,007,199,254,740,993 minor-unit grant beyond float precision, inside and outside a transaction, and is exactly `0n` without receipts.
- New `test:request-isolation` (browser, production build): two users' hard loads interleaved and concurrent for 12 rounds, each sees only its own email, name and exact Practice Capital; a receipt inserted between requests is visible on the next request; soft navigation keeps the user's own data; sign-out redirects on the next request; switching accounts in the same browser shows only the new account; a demo identity is isolated and granted once.
- Unchanged and passing on the disposable databases: `test:persistence`, `test:migration`, `test:portfolio-persistence` (buy/sell/reward concurrency), `test:portfolio-allocation`, `test:portfolio-migration`, `test:portfolio-closed-market`, `test:personalization-persistence`, `test:curriculum-seed`, `test:log-returns-persistence`; browser: `test:product`, `test:progression-browser`, `test:studovna`, `test:portfolio-browser`, `test:settings`, `test:onboarding-redesign`, `test:personalization-browser`, `test:personalization-compatibility`, `scripts/validate-progress.mjs`.
- `test:foundations-browser` fails at its last step, "Unlocked portfolio has a build-mix action", looking for a "Sestavit" link that no longer exists in `src` at `639f2d4` (a unit test asserts its absence). Every step before it passes, including the one-time 5,000 Kč grant. Stale assertion, independent of this change; not edited here.

Reproduce as in "Reproduce" above; the analysis grouped `[investi:perf]` lines by request id to separate hard loads (layout + page) from soft navigations (page only).

## Phase 3: client navigation floor (measured 2026-10-14)

Addresses bottleneck #1. No change to React, Next.js, their configuration, `prepare: false`, transactions, rewards or data loading. Versions: `next` 16.3.4; `react`/`react-dom` 19.2.8 in `node_modules`, but the App Router runs Next's bundled `react-dom` **19.3.0-canary-cbb046ab-20260731**, which is where the throttle below lives.

### Mechanism (read in the bundled `react-dom-client.production.js`, confirmed by experiment)

React holds a commit in the **retry lanes** (content revealed into a Suspense boundary that is showing its fallback) until `globalMostRecentFallbackTime + 300 ms`. A **transition** that never shows a fallback is not throttled. Next renders each `loading.tsx` as a Suspense boundary keyed by its route segment. Navigating to a sibling route therefore mounts a *new* boundary, commits its fallback at once (URL and skeleton at ~6 ms), and the real content waits for the throttle. Which `loading.tsx` matters: the nearest one at or below the segment that changes. For `/learn` ↔ `/progress` ↔ `/lab` ↔ `/lab/portfolio` that was the route's own file, or `(app)/loading.tsx` for `/lab`, which had none. Every one of them produced the same floor.

### Candidates (production build, same benchmark, warm, median ms)

| Variant | What | Nav +0 (`/learn`) | Nav +30 (`/learn`, `/lab`) | Hard-load TTFB / DCL +30 (`/learn`) |
| --- | --- | --- | --- | --- |
| A | baseline: route `loading.tsx` files | 321.2 | 364.5, 331.1 | 202.8 / 335.3 |
| B | all six `(app)` `loading.tsx` removed, pending indicator | 40.0 | 385.5, 236.5 | 345.0 / 391.5 |
| C | D + `lab/portfolio/loading.tsx` kept | 38.5 (`/lab/portfolio` 322.1) | 386.8, 238.0 (`/lab/portfolio` 355.6) | 202.7 / 335.5 |
| **D (chosen)** | route `loading.tsx` removed on main routes, **one persistent `<Suspense>` in the `(app)` layout**, pending indicator | 39.9 | 372.4, 238.0 | 201.5 / 334.6 |

- **B** removes the floor but also all streaming on full page loads: HTML waits for the whole page (TTFB 203 → 345 ms at +30, DOMContentLoaded +56 ms).
- **C** shows that any route-level boundary brings the floor back for that route (322 ms at +0). It is ~16 ms faster than D for that route at +30, because content is revealed into the committed fallback as it streams.
- **D** keeps hard loads identical to A. The layout boundary streams the shell and a neutral fallback first, then the page. On a client navigation that boundary is already showing content and is not remounted, so React keeps the current page during the transition and commits the new one without a fallback, so there is no throttle.
- **E** (`useLinkStatus` feedback) is part of B, C and D.

### Before (A) → after (D): soft navigation, warm (median / p95 ms)

n=15 at +0/+10/+30, n=10 at +60; `/lab/portfolio` from the extended cycle. "Server" is `serverPageMs`.

| Route | +0 | +10 | +30 | +60 | Server +30 |
| --- | --- | --- | --- | --- | --- |
| `/learn` | 321.2 / 323.0 → **39.9 / 55.7** | 319.9 / 322.0 → **171.0 / 186.4** | 364.5 / 370.9 → 372.4 / 389.1 | 671.0 / 673.7 → 680.4 / 689.0 | 338.9 → 337.9 |
| `/progress` | 321.2 / 323.4 → **39.0 / 56.6** | 320.4 / 337.5 → **170.8 / 187.1** | 358.7 / 372.6 → 375.7 / 388.5 | 672.0 / 681.7 → 686.8 / 691.0 | 337.7 → 337.2 |
| `/lab` | 336.1 / 340.0 → **38.4 / 43.2** | 336.6 / 337.7 → **117.9 / 121.6** | 331.1 / 339.3 → **238.0 / 239.9** | 422.0 / 423.7 → 421.5 / 426.1 | 202.9 → 202.0 |
| `/lab/portfolio` | 321.2 / 323.9 → **39.7 / 55.7** | 320.4 / 322.7 → **156.3 / 157.7** | 354.6 / 358.3 → 372.0 / 374.7 | 655.2 / 657.3 → 671.4 / 673.6 | 338.1 → 333.8 |

The floor is eliminated whenever the server answers in under ~280 ms: at +0 and +10 on every route, and at +30 on `/lab`. Server time is unchanged.

**Trade-off when the server is slower than the floor:** the data routes are 8–17 ms slower (2–5 %) at +30 and +60. Without a fallback, React renders the whole page after the response ends (RSC stream end → URL commit ≈ 13 ms, then two frames); a committed fallback lets React reveal content as it streams. This is the price of not showing a fallback, and it is far smaller than the 280 ms saved on fast responses.

### Feedback and requests (D)

| Signal | A | D |
| --- | --- | --- |
| First feedback after click | URL + skeleton at 5–7 ms | `useLinkStatus` pending at ~2 ms; bar fades in after 150 ms (CSS `transition-delay`, no JS timer), so navigations faster than that show none |
| URL change | at click (5–7 ms) | at commit, with the content (Next's documented behaviour for dynamic routes without `loading.js`) |
| RSC navigation requests per navigation | 1 | 1 |
| Prefetch requests after loading `/learn` | 9 (route trees and segments; no page code ran on the server) | 9, identical |

`loading.tsx` did not buy any extra prefetching here: in both builds the same prefetches were made and the server rendered no layout or page for them.

### Pending feedback (what replaces the skeleton on client navigations)

- `AppLink` (`src/components/shell/app-link.tsx`) is `next/link` plus a `LinkPendingReporter` that calls `useLinkStatus()` and renders nothing, so link DOM and CSS are unchanged. It is used by the desktop and mobile navigation, `ButtonLink` and every in-app link inside the shell.
- `NavigationStatusProvider` in `AppShell` turns the reports into one indicator: a 3 px bar at the top edge (hidden for the first 150 ms; static under `prefers-reduced-motion`), a polite `role="status"` "Načítám stránku…" and `aria-busy` on `#main-content`. It clears as soon as history updates.
- With an artificial 1.5 s delay on navigation responses, the current page stays visible and interactive, the bar starts fading in at 150 ms (fully opaque at ~270 ms by its CSS timing; the test checks it at 600 ms), the URL changes only at commit, and the indicator, status and busy flag clear after commit.

### Kept, and why

- `lab/instruments/[instrumentId]/loading.tsx`: a deep link, not primary navigation, whose content depends on external quotes and history that are usually slower than 300 ms on a cold cache. There the floor costs nothing, and its placeholder explicitly shows no price until data arrives.
- `onboarding/loading.tsx`: outside the app shell, not part of this navigation.
- Error boundaries (`error.tsx`) are unchanged; the layout boundary sits above them and does not catch errors.

### Behaviours checked against the baseline build

- **Interrupted navigation:** clicking route X and then Y before X responds can briefly commit X and leave an X history entry before Y commits. The baseline build does exactly the same (measured: `/lab` committed at t=1368 ms, `/learn` at 1617 ms), because neither build had X's loading shell cached. Each click is its own React transition. Not a regression; noted as a limitation.
- **Repeated clicks** on one link: one history entry. **Back/forward:** correct pages, nothing left pending. **New page:** starts at the top. **Keyboard:** Enter on a nav link behaves like a click. **Before hydration:** a click is a full page load, as before.
- **Full page loads:** unchanged TTFB and DOMContentLoaded (table above). The neutral layout fallback replaces the route-specific skeletons there.

### Instant Navigations (Next 16.3)

Requires `cacheComponents` and `partialPrefetching`, which this phase excludes. It also would not remove this floor by itself: these pages are per-user and dynamic, so the instant part would be a fallback shell, and content revealed into a fallback is what React throttles. It would improve slow-server feedback (immediate URL and shell), not fast-server latency. Worth evaluating together with a caching migration.

### Validation

- `npm run typecheck`, `npm run lint`, `npm test` (80 files, 766 tests; the two skeleton-content tests now check the layout fallback for no counts, balances or headings), `npm run build`.
- New `test:navigation-feedback` (browser, production build): fast navigations under 250 ms with no indicator flash and no fallback; slow (1.5 s) navigations keep the page with indicator, status and busy state and update history only at commit; interrupted and repeated clicks end on the last destination with nothing stuck; back/forward; scroll to top; keyboard; hard reload; mobile nav; reduced motion.
- Passing: `test:request-isolation`, `test:product` (includes the sign-out/auth gate), `test:progression-browser`, `test:studovna`, `test:portfolio-browser`, `test:portfolio-browser-closed`, `test:backtesting-browser`, `test:log-returns-browser`, `test:settings`, `test:onboarding-redesign`, `test:personalization-browser`, `test:personalization-compatibility`.
- `test:foundations-browser`: the pre-existing "Sestavit" failure (see Phase 2), unchanged.
- `test:instrument-browser-unavailable` fails identically on the baseline build in this environment ("old quote is labeled stale"). It depends on the deterministic market clock. With `DETERMINISTIC_MARKET_NOW=2026-01-20T15:00:00Z` that assertion passes on the new build, and the run stops at a later history-range check that also depends on the clock (not checked on the baseline with that clock). The stale-data labels on the instrument page are covered by `test:portfolio-browser-closed`, which passes.

Benchmark additions (`scripts/benchmark-navigation.mjs`): `urlMs`, `pendingMs`, `rscEndMs` (Resource Timing end of the navigation response), and navigation/prefetch RSC request counts per navigation.

## Phase 4: prepared statements (measured 2026-10-14)

Addresses bottleneck #2. **Decision: keep `prepare: false`.** No runtime, schema, migration, auth, pool or deployment change. Added: `npm run test:prepared-statements` (`scripts/validate-prepared-statements.mts`), the check that must pass on a disposable Neon branch before this is revisited.

### Connection configuration

- `.env` points at a Neon **pooled** endpoint (`-pooler` hostname, `sslmode`/`channel_binding` set). It was not connected to: it may be production. Vercel's env vars were not inspected (no CLI access), so deployed/local equivalence is unverified.
- `scripts/vercel-build.mjs` runs `drizzle-kit migrate` with the same `DATABASE_URL` as the runtime, i.e. migrations go through the transaction pooler. Neon lists schema migrations as a direct-connection use case. Minimal compatible option (not done, needs a Vercel env change and approval): optional `DATABASE_URL_UNPOOLED` read by `drizzle.config.ts`, falling back to `DATABASE_URL`.
- Neon (docs, 2026-10): PgBouncer in `pool_mode=transaction`, protocol-level prepared statements supported "as of PgBouncer 1.22.0", `max_prepared_statements=1000`, settings not user-configurable, no admin console. The running PgBouncer version is not stated.
- postgres.js 3.4.9 defaults: `max: 10`, `idle_timeout: null`, `max_lifetime` 30–60 min, `fetch_types: true`. Statement cache is per connection and reset on reconnect; it retries once on `FetchPreparedStatement` / `RevalidateCachedQuery`.

### Finding 1: `prepare: true` alone is a no-op here

Drizzle (`drizzle-orm/postgres-js/session.js`) runs every statement through `client.unsafe(query, params)`, and postgres.js's `unsafe` sets `prepare: false` per query unless told otherwise. The client option only gates it. Measured: variant B (`postgres(url, { prepare: true })`) is identical to A in every microbenchmark cell. Real prepared statements need a wrapper that passes `{ prepare: true }` to `unsafe` on the client and on `begin`/`savepoint` transaction clients (variant **C**, the version in `validate-prepared-statements.mts`).

### Round trips per operation (+30 ms RTT, one connection, median)

| Operation | A `prepare: false` | C prepared |
| --- | --- | --- |
| New connection + first query | 4.6 RTT | 4.6 RTT |
| First run of a statement on a reused connection | 2.2 | 2.2 |
| Repeated parameterised statement | 2.2 | **1.1** |
| Query without parameters (simple protocol) | 1.1 | 1.1 |
| Transaction (BEGIN, FOR UPDATE, SELECT, COMMIT), first / repeated | 6.7 / 6.7 | 6.7 / **4.5** |

Identical direct and through local PgBouncer 1.26.1 (transaction mode, `max_prepared_statements=1000`). Setup cost is per connection and per statement shape; C only saves on reuse.

### Navigation (production build, warm, median / p95 ms; server = `serverPageMs`)

One experimental build for both variants, runs interleaved A, C per RTT, n=15 warm, 3 cold, disposable local Postgres 15 through `pg-latency-proxy.mjs`. A repeat of A at +30 at the end was 2–3 % faster than the first A run (drift bound).

| Route | RTT | Navigation A → C | Server A → C | Hard-load TTFB A → C |
| --- | --- | --- | --- | --- |
| `/learn` | +0 | 38.7 → 39.1 | 8.2 → 7.3 | 7.4 → 9.2 |
| | +10 | 158.2 / 188.1 → 106.0 / 137.7 | 126.2 → 66.3 | 77.8 → 42.3 |
| | +30 | 385.9 / 414.6 → **220.5 / 241.4** | 338.4 → **172.5** | 203.4 → 104.4 |
| | +60 | 675.0 / 690.2 → 357.8 / 434.5 | 638.1 → 323.9 | 388.6 → 196.0 |
| `/progress` | +30 | 387.3 / 388.6 → 220.9 / 255.8 | 336.0 → 173.9 | 202.5 → 104.3 |
| | +60 | 684.8 / 702.1 → 369.7 / 497.1 | 638.0 → 323.2 | 389.3 → 195.0 |
| `/lab` | +30 | 239.9 / 252.0 → 136.0 / 137.7 | 203.6 → 103.3 | 201.7 → 103.0 |
| | +60 | 419.9 / 423.7 → 225.3 / 287.5 | 382.9 → 193.6 | 387.5 → 194.1 |
| `/lab/portfolio` | +30 | 372.0 / 388.2 → 205.2 / 223.7 | 336.6 → 170.4 | 201.0 → 103.3 |
| | +60 | 659.3 / 675.9 → 355.1 / 376.3 | 630.8 → 320.6 | 386.3 → 196.8 |

Through local PgBouncer at +30: `/learn` 373.2 → 218.1 navigation, 334.0 → 174.2 server; other routes match the direct runs within 3 %. Query counts unchanged. C's p95 at +60 is wider (first statement use on a newly opened pool connection). At +0 nothing changes.

**Concurrent requests** (4 users × 4 parallel RSC requests to `/learn`, 6 rounds, +30 ms through PgBouncer, two runs each): A median 1097 / 1084 ms (p95 1232 / 1224), C 225 / 219 ms (p95 379 / 370), 0 errors, peak 10 backend connections in both (the pool max). Under `prepare: false` a describe-first query holds its connection until it completes, so a saturated pool queues; prepared queries pipeline.

### Compatibility (local PgBouncer 1.26.1, transaction mode, server pool of 2 shared by 40 client connections)

Local PgBouncer is a stand-in, **not proof of Neon compatibility**.

- **Pass (C):** concurrent reads, `FOR UPDATE` transactions, savepoints, rollbacks, varying `IN` list shapes, exact `BigInt` totals beyond 2^53, PgBouncer `RECONNECT`, `ADD COLUMN`, client reconnects and restarts. No "prepared statement already exists / does not exist" errors.
- **All persistence suites pass under C through PgBouncer:** `test:persistence`, `test:migration`, `test:portfolio-persistence` (buy/sell/reward concurrency), `test:portfolio-allocation`, `test:portfolio-migration`, `test:portfolio-closed-market`, `test:progression-persistence` (exactly-once unlock), `test:personalization-persistence`, `test:curriculum-seed`, `test:log-returns-persistence`.
- **Fail (C only, through PgBouncer):** after `ALTER COLUMN … TYPE` on a selected column, `cached plan must not change result type` for that statement (3 and ~2,000 failures in two 14 s runs; 0 direct, 0 with A). PgBouncer shares the server-side statement by query text, so postgres.js's single re-prepare retry hits the same stale plan, and Neon offers no `RECONNECT`. Production migrations run in `vercel-build` against live traffic, so a type-changing migration could break reads until Neon's server connections recycle (lifetime unknown).
- **Pre-existing, unrelated to this choice:** terminating backends under heavy load crashes the Node process with an uncaught `TypeError: Cannot read properties of null (reading 'write')` in postgres.js `nextWrite` (A 6/6 direct, 5/6 through PgBouncer; C 6/6 and 6/6; 40 workers, kill after 3 s). Neon compute restarts close connections the same way. Worth a separate fix (upstream report or driver upgrade).

### Before enabling prepared statements in production

1. Run `PREPARED_TEST_DATABASE_URL=<disposable Neon branch pooler URL> PREPARED_TEST_CONFIRM_DISPOSABLE=1 npm run test:prepared-statements` (refuses the `DATABASE_URL` endpoint, prints no credentials); all asserted checks must pass, and read the reported schema-change behaviour.
2. Measure the real Vercel↔Neon RTT (`INVESTI_PERF_DEBUG=1` on a preview) to size the gain; it is ~RTT × (statements on the critical path) on warm connections only.
3. Decide a migration policy for type changes (expand → backfill → cutover, never in-place `ALTER TYPE` on read columns), or key statement text per deployment (e.g. a `/* deployment id */` prefix) so a new deployment never reuses old server-side plans.
4. Then the change is the wrapper in `src/db/index.ts` (keep the dev singleton); rollback is restoring `prepare: false` / removing the wrapper and redeploying, no data or schema involved.

Not changed: pool size, `idle_timeout`, `max_lifetime` (no evidence they are wrong for Vercel; a short `idle_timeout` would also discard the statement cache), auth, transactions, locking, rewards.

## Phase 5: lesson step latency (measured 2026-10-16, issue #44)

Every Continue/Previous in a guided lesson waited for `saveLessonPositionAction` before the next step appeared.

### Measurement

Production build, disposable local Postgres 15 through `pg-latency-proxy.mjs` at +30 ms RTT. A fresh learner alternates Continue and Previous on the first two steps of `why-invest` (n=20 each). Time runs from `click()` to the next step's heading being in the DOM, measured in the page. "Settled" also waits for the save.

| Variant | Continue painted, median / p95 | Previous painted | Save settled | Statements per step | Action response |
| --- | --- | --- | --- | --- | --- |
| Before (save, then revalidate `/learn` layout, `/dashboard`, `/progress`) | 429 / 430 ms | 429 / 430 | = painted | 16 | 12.6 KB (re-rendered lesson) |
| No revalidation, UI still waits | 428 / 429 | 428 / 430 | = painted | 7 | 73 B |
| **No revalidation, step advances at once (shipped)** | **6 / 7** | **5 / 6** | 420 / 425 | 7 | 73 B |

- Any `revalidatePath` in a Server Action re-renders the page being viewed into the action response. Next 16.4's `revalidatePath` marks the action as revalidated without checking the path ("TODO: only revalidate if the path matches"). So each step also ran the lesson page's 9 read queries on the server.
- Dropping it did not shorten the wait by itself: the client receives the action result before the re-rendered tree streams. What remains is the save's own round trips: session (2 statements) plus the `FOR UPDATE` transaction (5), about 14 RTT under `prepare: false`.
- `/dashboard` only redirects to `/learn`; no action revalidates it any more.

### What changed

- `saveLessonPositionAction` revalidates nothing.
- `GuidedLesson` shows the next step immediately. `lesson-save-queue.ts` saves the moves one at a time in click order (the server accepts a move only from its current cursor). When a save fails, the moves queued behind it are dropped and the learner returns to the unsaved step. The answer that earned the move is kept, and the error is shown with Continue focused as the retry.
- Completion first waits for the queue, so `completeLessonAction` still requires the saved last step. Completion semantics and rewards are unchanged.
- Back/Forward reuses cached pages regardless of staleness. Without a revalidation, it could reopen the lesson at an old starting step, and the next save would move the cursor backwards. When the lesson unmounts after any save, it waits for the queue and calls `router.refresh()`, which drops that cache. After a completion it skips this, because the completion action already revalidates. A link out of a lesson therefore costs one extra fetch of the destination page, instead of a lesson re-render per step.
- The second click of a double click is ignored, so it cannot skip the step that just appeared.
- `main[data-save-state]` (`saving` / `idle`) lets browser suites wait for the save before reading the database or reloading.

Known trade-off: closing the tab or reloading within the save window (about 0.4 s at +30 ms RTT) can lose the last step's cursor, and the lesson then reopens one step earlier. No answers or rewards are affected.

Not measured: the real Vercel↔Neon RTT. To check on a preview, use `INVESTI_PERF_DEBUG=1` and DevTools: the click-to-step time no longer depends on it, but the settle time does.

## Phase 6: landing page assets and first load (measured 2026-10-16, issue #45)

### Assets

`public/` went from 13.2 MB to 0.98 MB (tracked files).

- The PNG logo (`investi-logo.png`, 2172×724, 413 KB) is gone. Its last live use was the app shell on the two routes outside the paper theme (`/learn/[moduleSlug]`, `/lab/portfolio/mix`). They now show the typeset `investi!` wordmark that the paper shell, auth, onboarding, legal pages and the landing already use, so there is one wordmark and no image request.
- The pre-`PenLanding` landing (`hero`, `final-cta`, `journey-intro`, `marketing-header`/`-footer`, `product-showcases` and the three showcases, `marketing.module.css`) had no importers. It is deleted with the nine brand images only it used (cloud, clouds, hill, sun, mascot-hero, portfolio-pie, flame/gold/books icons, 7.3 MB together). `investi brand identity.png` (1.4 MB, unused and publicly served) is deleted too. `investi-design.pen` is the design source.
- Live illustrations were re-encoded as WebP q75 at about 2× their largest rendered width: the landing art 3.0 MB → 278 KB, `growing-coin.webp` (rendered at 48 px) 1254 px/919 KB → 96 px/3 KB. The guide poses in `public/investi-assets` were already small, are byte-for-byte copies recorded in `manifest.json`, and were left alone.

### Landing first load (`/`, production build, local `next start`)

Transfer by type, Playwright with a fresh context (KB, compressed):

| | Document | CSS | JS | Fonts | Images | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Before, 390 px | 15 | 45 | 237 | 202 | 7 | 507 |
| After, 390 px | 15 | 45 | 224 | 202 | 5 | 493 |
| Before, 1440 px | 15 | 45 | 237 | 202 | 75 | 575 |
| After, 1440 px | 15 | 45 | 224 | 202 | 66 | 554 |

`next/image` already served small variants and lazy-loads the art below the fold, so the source-file savings barely show here. The 13 KB JS saving is the better-auth client: `DemoButton` now imports it when it is clicked.

JS chunks on `/` (gzip): `react-dom` 72 KB, Next runtime 45 KB, GSAP + ScrollTrigger + SplitText + Lenis 64 KB, the rest under 10 KB each. Motion (`motion/react`) is not on the landing. It is used only by the lesson and gamification components. GSAP and Lenis are imported only from `src/components/marketing/motion`, so no product route loads them. Fonts: Inter latin + latin-ext (48 + 84 KB, variable), Manrope latin + latin-ext (25 + 15 KB), and Nunito Sans latin (31 KB), which the root layout preloads for the app although the landing does not use it.

### Lighthouse 13.5.0, mobile (simulated throttling), 5 runs each

| | Performance | FCP | LCP | TBT | CLS | Speed Index | Byte weight |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Before (`origin/main` @ `9915199`) | 85 (85–86) | 1.4 s | 4.3 s | 30 ms | 0 | 2.0 s | 516 KB |
| After | 86 (all runs) | 1.4 s | 4.2 s | 40 ms | 0 | 1.9 s | 500 KB |

The ≥ 90 target is not reached. What limits it:

- The LCP element is the hero `<h1>` span. The observed (unthrottled) LCP is about 1.5 s, because the hero intro hides the title before first paint and `split.revert()` re-inserts the span when the timeline ends. That is not what costs the score, though. A throwaway build without the title intro brought the observed LCP to about 50 ms, and the simulated LCP stayed at 4.3 s and the score at 85.
- Lighthouse's simulation charges LCP for every request started before it. Here that is 202 KB of preloaded fonts and 224 KB of JS on a 1.6 Mbps link, so only cutting early bytes moves LCP.

Follow-ups that would cut early bytes. Each one is a design or platform decision, so none of them is in this change:

1. Don't preload Nunito Sans on the landing (31 KB). Its `next/font` instance lives in the root layout's `LearningTheme`, so this means moving the product fonts into the product layouts.
2. Reconsider Inter as the landing body font, or its full variable axis (132 KB with latin-ext). Czech text needs latin-ext.
3. Load the GSAP/Lenis layer (64 KB) after first paint. Today the intro sets its hidden states in JS before first paint when the chunks arrive early. Loading the layer later would show the content and then hide it, so the intro would have to change with it.

### Reproduce

```bash
npm run build && npx next start -p 3462
npx -y lighthouse@13.5.0 http://localhost:3462/ --only-categories=performance --form-factor=mobile --chrome-flags="--headless=new"
```

## Phase 7: fonts and KaTeX CSS (checked 2026-10-18, issue #46)

Fonts were settled in #47: the root layout loads only Manrope and Inter through `src/styles/fonts.ts`, both with `latin` + `latin-ext` and `display: "swap"`. Nunito Sans and `LearningTheme` are gone, so Phase 6 follow-up 1 no longer applies. `/` and `/sign-in` preload four font files: Inter and Manrope, each in Latin and Latin Extended, so Czech diacritics arrive with the first paint.

`katex/dist/katex.min.css` (24.8 KB, 4 KB gzip) was imported by the root layout, so every page downloaded it. It is now imported by the two components that render formulas, `FormulaBlock` and `GuidedBlock`. In the production build the KaTeX chunk is referenced only by `/learn/[moduleSlug]/[lessonSlug]` and the dev-only `/dev/design-system`. `/`, `/sign-in`, `/sign-up`, `/privacy` and the 404 page no longer link it. `test:log-returns-browser` asserts that KaTeX's rules still apply in a lesson.
