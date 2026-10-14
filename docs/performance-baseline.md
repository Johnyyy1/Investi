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
