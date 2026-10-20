# Returns and compounding

Six Returns lessons are published at `/learn/returns`, following Investing Foundations. They use the shared authored lesson registry, guided blocks, question evaluation, persisted cursor, and completion transaction. No provider-specific lesson engine exists.

| Order | Stable ID / slug | Focus |
| --- | --- | --- |
| 1 | `returns-what-is-a-return` / `what-is-a-return` | Amount versus proportional price change; the starting-price denominator |
| 2 | `returns-simple-returns` / `simple-returns` | Adjacent decimal returns, moving denominator, N−1 observations, dates/gaps |
| 3 | `returns-compounding` / `compounding-and-cumulative-returns` | Growth factors, cumulative return, ending value, and loss recovery |
| 4 | `returns-comparing` / `comparing-investments` | Price versus total return and a common comparison basis |
| 5 | `returns-log-returns` / `log-returns` | Positive-price log return, time additivity, conversion, small-return approximation |
| 6 | `returns-checkpoint` / `returns-checkpoint` | Checkpoint on one invented fund (200 → 250 → 200 → 240 Kč, 6 Kč payout): period returns, compounding, recovery, price vs total return, summed log returns |

Published IDs, slugs, and numeric step positions are persistence contracts. The learner summary prioritizes active learning; recommendations use published prerequisites. Planned routes/actions remain unavailable. A streamed Next.js unavailable page may have HTTP 200: validate the unavailable UI, `noindex`, and absence of progress writes rather than assuming an HTTP status alone.

## Canonical calculations

`features/finance/returns.ts` owns simple return, absolute change, adjacent numeric returns, cumulative return, compounding traces/value, recovery, log return, and its inverse. Ratios remain unrounded decimal values. Educational `simpleReturn(100, 0)` is −1; the next denominator cannot be zero. Log return requires both prices finite and positive, handles extreme ratios without division overflow/underflow, and is converted back using `Math.expm1` for small-value accuracy. Explicit input/range errors replace non-finite outputs. These functions are not ledger arithmetic.

`features/finance/historical-price-returns.ts` transforms normalized ordered daily split-adjusted closes into adjacent observed returns without IO, formatting, resampling, filling, or annualization. It preserves instrument, currency, adjustment, requested/actual range, completeness, and provenance. Successful N-price input yields N−1 returns. Insufficient data creates no synthetic zero; invalid dates, order, duplicates, non-positive closes, unsupported basis, and non-finite results produce structured invalid states. The current transformation has no historical session-calendar evidence: adjacent calendar days are marked `none`, multi-day spans are `unknown`. It neither claims a missing trading session nor marks weekends/holidays as scheduled. A multi-day interval is never presented as a one-day return.

The existing price-series explorer shows real endpoint dates, paired observations, an undefined first return, the moving denominator, and explicit educational data. Compounding/recovery explorers share the canonical helpers. `compoundPeriods` is an explanatory trace, not a competing return definition; Foundations `compoundReturn` delegates to cumulative return.

## Return basis and Instrument Detail

A comparison requires matching dates, currency, adjustment, distribution/reinvestment, fees, and tax assumptions. The simplified `(end − start + cash distribution) / start` example is a stated cash-inclusive illustration. It is not a general reinvested total-return series. Split adjustment does not include dividends.

Instrument Detail uses available split-adjusted closes in the quote currency for selected-period **price return**. Its `returnPercent` presentation boundary is in percentage units, distinct from decimal helper output and personal CZK portfolio performance. One close supports a price, not a return. Missing history remains unavailable; partial history preserves actual endpoints. Line/candle views share the same endpoint basis; OHLC extremes are not maximum drawdown. Zoom changes the view while selected-range metrics keep their range inputs.

The detail page loads the instrument's whole split-adjusted daily history (Max) once, under one cache key per instrument and day. Timeframes (1M–Max) are slices of that history taken in the browser by `filterHistoryByTimeframe` in `features/instruments/history.ts`: calendar months back from the latest close (so weekends and holidays do not move the window), YTD from 1 January, and a history that stopped more than a week ago is not stretched into the latest month. Period statistics, extremes with their dates, the largest drawdown with its peak, trough and recovery, and the metrics under the chart are recomputed from the slice. Switching the timeframe or line/candles only replaces the URL query (`range`, `chart`) for reloads; it does not navigate, render on the server or request prices.

Log returns add through time for one return series; they do not substitute for portfolio-weighted simple returns. Simple returns remain the normal performance wording. Rearranging an identical set of returns changes the path but not its final product in the absence of cash flows.

## Correlation

`features/instruments/correlation.ts` computes the Pearson correlation of two instruments' simple **price returns**, never of prices. Each series stays in its own quote currency with split-adjusted closes: it is not a correlation in CZK, applies no FX and excludes dividends. Only dates both series traded are paired; nothing is forward-filled. Daily frequency (the default) pairs returns between consecutive common dates and excludes, rather than bridges, gaps longer than `MAX_VOLATILITY_GAP_DAYS`, as volatility does. Weekly frequency pairs returns between the last common close of consecutive ISO weeks (Monday–Sunday, UTC) and excludes a week with no common date; it softens the close-time mismatch of exchanges such as XNAS and XETR. Fewer than 20 paired returns give `insufficient-data`, and a series without variation gives `no-variation`; both return a `null` coefficient, never 0. The result `{ coefficient, observationCount, startDate, endDate, frequency }` carries the actually paired dates and an unrounded coefficient in [−1, 1]; rounding belongs to presentation. The coefficient itself is `pearsonCorrelation`, which the Correlation lessons also call on their short invented series, so a lesson number and a Lab number follow one formula. `correlation-loader.ts` loads both histories through `MarketDataService` on the server and keeps their provenance, so the coefficient is never computed from client-sent closes.

## Comparing two instruments

`/lab/compare?a={id}&b={id}&range={range}` (entered through „Porovnat s…“ on the instrument detail) compares two instruments by price return, annualised return, largest drawdown, volatility and their correlation. `features/instruments/comparison.ts` uses only the dates both instruments traded (the intersection, no forward-fill) for everything on the page, so the chart, both metric sets and the correlation describe the same days. The chart rebases both series to 100 on the first common date; each series keeps its own quote currency without FX, and every number is price-only (split-adjusted, no dividends). When the common period starts or ends more than 7 calendar days inside the requested range (for Max, inside the longer of the two histories), the page says so. A history that cannot be loaded leaves that instrument's metrics „Nedostupné“, shows no chart and no correlation, never zeros. `comparison-loader.ts` loads both instruments through `MarketDataService` on the server; query IDs are validated like the detail route, and identities the source does not know give a 404. Metric names, explanations, formulas and lesson links come from the metric glossary (see below), shared with the instrument detail. Correlation bands for the reading aid: |r| < 0.3 weak, < 0.7 moderate, otherwise strong.

## Active backlog

The checkpoint remains planned. A future exercise should use a new fixed series with flat and losing intervals, test signed adjacent returns/N−1 and decimal↔percentage conversion, derive cumulative value/recovery, choose a common price/total-return basis, and interpret supplied log values. It can introduce intuitive center/extremes/time order without calculating variance, volatility, or correlation. Reuse existing question types and completion semantics; do not publish future Risk content implicitly.

Read-only market-history lesson integration needs a frozen dataset/basis/provenance so answers stay reproducible. Risk needs return dispersion/frequency conventions; portfolio/backtesting work needs consistent return and cash-flow semantics. Live-provider lesson calls, stochastic calculus, total-return data generation, portfolio optimization, and personal transaction-history backtesting remain separate work.

## Validation

`npm test` includes helper edge cases, historical observations, authored content/flow integrity, registry, recommendations, and transition tests. `test:log-returns-persistence` covers correct-answer gates, premature completion, concurrent one-time policy-v3 reward (60 XP and 2,000 Kč), legacy receipts, L4 preservation, replay, and planned-route rejection.

With deterministic providers and a fresh local app/database, run `test:log-returns-browser` and `BROWSER_CHANNEL=chrome npm run test:returns-browser`. These exercise current lessons, formulas/explorers, retries, resume, Previous, completion/review, sign-in/out, keyboard/focus, reduced motion, six widths, and enlarged text. Screenshots go to `/tmp`; they are not repository fixtures.

## Metric glossary

`src/features/learning/metric-glossary.ts` is the one source for what each Lab metric means: name, short explanation, KaTeX formula, the convention each Lab uses (the instrument detail works from daily closes, the Backtesting Lab from month-end values) and the lesson that teaches it. The instrument detail, the comparison, the Backtesting Lab and Portfolio Lab read their labels, explanations and „Lekce: …“ links from it, so a metric has one explanation everywhere. Formulas are rendered with KaTeX on the server (`components/lab/metric-formula.tsx`), so KaTeX never reaches the browser bundle. A lesson link is built from the curriculum, so it always carries the lesson's current title. A metric without an available lesson (Sharpe ratio, correlation while the Correlation module is planned) has no link. `metric-glossary.test.ts` checks that every link points to an authored, available lesson and that every formula renders.

Lessons link back the other way. A `labBridge` block with `metric` gets „Vyzkoušej v Labu: …“. When the lesson loaded a historical instrument it opens that instrument's detail at the metric (`#metric-<id>`). Otherwise it opens the Lab page that shows the metric: the comparison for instrument metrics, the Backtesting Lab for backtest metrics.
