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
