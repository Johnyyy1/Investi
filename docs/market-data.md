# Market data

Investník accesses market data through the server-only normalized `MarketDataService` boundary. Security and FX capabilities may be supplied by different providers; provider response objects and credentials must not enter client components.

## Configuration

Set `MARKET_DATA_PROVIDER` to one of:

- `deterministic` — the default synthetic dataset for local development, demos, and reproducible tests.
- `fmp` — Financial Modeling Prep Stable API for discovery, metadata, quotes, history and equity fundamentals, with TickerInside for ETF analytics. FMP still requires the server-only `FMP_API_KEY` variable. TickerInside needs no key or additional environment configuration.

Set `FX_DATA_PROVIDER` to one of:

- `deterministic` — reproducible educational FX fixtures;
- `cnb` — Czech National Bank daily fixing (`denni_kurz.txt`). No API key is required. Recommended for live mode.
- `frankfurter` — Frankfurter API v2 blended reference rates. No API key is required.

The normal local/test configuration explicitly selects `deterministic` for both. Live Portfolio Lab configuration uses `MARKET_DATA_PROVIDER=fmp` and `FX_DATA_PROVIDER=cnb`. Selecting FMP without an explicit FX provider or without `FMP_API_KEY` fails during composition. Invalid values fail environment validation. Investník never silently falls back between providers, and deterministic FX is never mixed into FMP mode unless it was explicitly selected. Never prefix the FMP key with `NEXT_PUBLIC_`.

`DETERMINISTIC_MARKET_NOW` is an optional server-only ISO UTC instant for reproducible session-state demos and browser QA. When omitted, deterministic mode keeps its fixed open-session fixture clock. It does not affect FMP or Frankfurter selection.

The current free FMP plan permits the security datasets used by Investník but returns HTTP 402 for FMP forex. Portfolio Lab therefore obtains security data from FMP and reference FX data from Frankfurter instead of upgrading FMP or substituting sample rates.

Portfolio Lab uses the composed service through one server-only composition point and does not select either provider itself. Fully deterministic mode keeps its reproducible educational flow. There is no provider fallback.

Persisted deterministic IDs remain unchanged. In FMP mode they are shown as unavailable rather than silently reinterpreted as FMP instruments; similarly, deterministic mode does not remap `FMP:` identities. New FMP trades retain the provider-qualified ID returned by search.

## Current FMP support

The adapter currently normalizes:

- ticker/company-name discovery through Stable `search-symbol`;
- instrument profiles through Stable `profile`;
- current/last quotes through Stable `quote`;
- daily raw and split-adjusted OHLC history through the corresponding Stable historical EOD routes;
- normalized provider errors without using FMP forex for Portfolio Lab.

An FMP instrument ID includes both the provider exchange code and provider symbol, for example `FMP:NASDAQ:AAPL`. Search results retain provider identity and the original provider symbol. A known exchange code is also mapped to a MIC where Investník has a reliable mapping. Profile lookup determines equity versus ETF because the search response does not reliably supply that distinction.

## ČNB FX support

The server-only ČNB adapter (`features/market-data/cnb`) downloads `denni_kurz.txt?date=DD.MM.YYYY` for the calendar day of the requested observation. ČNB answers with the last fixing declared on or before that day, so weekends, holidays and mornings before the ~14:30 Prague declaration resolve to the previous working day's fixing. The file's first line is the declaration date (kept as `referenceDate`); each row is `země|měna|množství|kód|kurz` with a decimal comma, and the rate is divided by `množství` (JPY is quoted per 100, IDR per 1000). Only `X/CZK` pairs are served; other pairs are unavailable rather than triangulated. Responses are reused for one hour (Next fetch revalidation plus the process-local cache). Failures are logged server-side with a `[market-data:cnb]` prefix and surface as unavailable valuations, never as zero.

FX is always requested for the date of the quote observation, not "latest": a rate dated after the observation is rejected by `MarketDataService`, which is why requesting the newest rate for yesterday's closing price used to fail.

## Frankfurter FX support

The server-only [Frankfurter API v2](https://frankfurter.dev/) adapter calls the single-pair endpoint, `/v2/rate/{base}/{quote}`. It requests the direct pair and never silently inverts or triangulates it. Frankfurter requires no credential.

An Investník FX rate is always expressed as quote-currency units per one base-currency unit. Thus `USD/CZK = 20.90` means `1 USD = 20.90 CZK`. Frankfurter rates are blended, dated reference/mid-market rates—not live broker execution quotes. Investník does not invent an FX spread, bid, ask, or intraday timestamp.

Frankfurter supplies a calendar `date`. The normalized `FxRate` preserves this as `referenceDate`; it remains distinct from the UTC retrieval timestamp. A local same-currency identity conversion is exactly `1`, uses the request's calendar date, and makes no provider request.

Historical `close` is the end-of-day session close under the series' declared adjustment policy. It is not a current quote, bid, ask, or execution price. Points are validated at the provider boundary and sorted in ascending calendar order.

## Portfolio Lab semantics

Portfolio Lab simulates immediate execution using a fresh server-observed current/last security quote and a dated reference conversion into CZK. Neither is a promise of broker execution, and Investník does not invent bid/ask, FX spreads, or slippage. The browser submits only the instrument ID, quantity, and idempotency key; authoritative price, market-session state, and FX observations are resolved server-side.

Each new trade permanently stores its execution price, quote currency, exact FX rate to CZK, CZK gross amount, security observation/provenance, and separate FX provider, dataset, kind, reference date, deterministic flag, and retrieval time. The additive fields remain nullable only for pre-4E.4 executions. Later market changes never rewrite those values or the resulting cost basis.

Current valuation is separate. It obtains a current/cached FMP quote and a current/cached Frankfurter reference rate, then computes `quantity × last usable market price × current reference FX`. Security observation time, session-aware usability, and FX reference date are displayed separately. A holding with an unusable security or FX observation remains unavailable and is never valued at zero.

## Security quote usability and market sessions

`MarketDataService` calculates structured quote usability after reading a normalized provider observation. The result distinguishes observation age, market-session state, calendar identity, valuation eligibility, and immediate-execution eligibility. Usability is recalculated against the injected current clock on every service read; it is not frozen into the cached quote.

The first supported calendar is U.S. cash equities for `XNAS`, `XNYS`, and `XASE` equity/ETF instruments. Regular hours are 09:30–16:00 in the IANA `America/New_York` timezone, so daylight-saving changes do not rely on a fixed UTC offset. Saturdays, Sundays, and recurring full-day U.S. equity holidays are non-trading days. The calendar includes New Year's Day, Martin Luther King Jr. Day, Washington's Birthday, Good Friday, Memorial Day, Juneteenth (from 2022), Independence Day, Labor Day, Thanksgiving, and Christmas, including the exchanges' normal observed-date rules.

During an open supported session, a quote must satisfy the 15-minute freshness policy to be usable for valuation or immediate simulation. When the market is closed, a valid observation near the close of the most recently completed session is a `closed-market-reference`: it may value a holding and retains its real provider `observedAt`, but it is never executable. Thus Friday's close may value an AAPL holding on Saturday, Sunday, a recognized Monday holiday, or Monday before the open; no simulated trade is accepted at that old close. Once a newer regular session is underway, the old observation is stale and unavailable for valuation.

Unknown exchanges never inherit U.S. hours. Their session state is `unknown`, and Investník retains a conservative explicit age fallback: up to 15 minutes is valuation- and execution-eligible, 15 minutes through 24 hours is valuation-only and labeled stale, and older observations are unavailable. This fallback does not claim that the venue is open.

Extended hours, unscheduled exchange closures, and early-close sessions are not modeled. In particular, the recurring holiday rules do not shorten post-Thanksgiving or Christmas Eve sessions. Those limitations must be addressed before Investník claims complete U.S. exchange-calendar coverage.

If one holding cannot be valued, that holding is marked unavailable and is never treated as zero. Other holdings retain their individual values, while aggregate portfolio value, allocation, and gain/loss remain incomplete until every open holding has a valid valuation. Authentication, rate-limit, provider, instrument, quote, and FX failures remain distinct on the server and are reduced to concise UI messages.

## Lesson history

Portfolio Lab also uses normalized raw daily history and the existing date-based `getFxRate` capability to reconstruct contribution-boundary valuations for TWR. This is a labeled prior-daily-close estimate, with explicit unavailable states; it is not an intraday snapshot or a daily portfolio FX series. [Performance conventions and limitations](portfolio-lab.md#portfolio-performance-lab-03--138) define coverage, dates, costs and annualization. MWR uses dated receipt/grant flows and the final complete valuation independently of historical TWR coverage.

The lessons *Jednoduché výnosy* and *Složené a kumulativní výnosy* each have one ungraded exercise on the history of a stock and a broad ETF (`src/features/lessons/real-history`). The real history is not committed to the repository: FMP's terms do not allow copying or redistributing its data without a separate licence. The lesson page therefore loads it on the server through `MarketDataService`, so it uses the same cache and normalized failures as the instrument detail.

Determinism comes from a fixed plan instead of a stored file. Each provider has a fixed past window and fixed anchor dates (FMP: AAPL and SPY at the 2023 year-end and every 2024 quarter-end; deterministic mode: the AAPL and VWCE sample fixtures). Each anchor takes the last split-adjusted close on or before it, at most 7 days earlier. A missing anchor, unsorted or duplicate dates, a non-positive close, or a different basis makes that instrument unavailable. A gap is never filled. Answers are checked against the frozen points shown on screen, so the result does not depend on the date of the visit. SPY stands in for a world ETF because VT and VWCE are not on the current FMP plan.

The label follows provenance. Only non-deterministic `historical` data is shown as „Historická data · {zdroj} · stav k {datum}“, always with „jen cena, bez dividend“ and the retrieval date. Deterministic fixtures are shown as „Ukázková data“. The exercises do not affect lesson completion or rewards.

The Volatility lessons *Anualizace volatility* and *Největší propad a zotavení*, and the Correlation lesson *Korelace na reálných datech*, use a second plan (`risk-window.ts`): every split-adjusted daily close of calendar year 2022 (FMP: AAPL and SPY; deterministic mode: the NVDA and SPX sample histories). The first and last close must lie within 7 days of the window's edges and the year must have at least 240 closes; anything else makes that instrument unavailable. Volatility and the largest drawdown come from the instrument detail's own `priceMetrics`: the sample standard deviation (n − 1) of daily simple returns × √252, skipping returns across gaps longer than 4 days. A number in the lesson therefore matches what the Lab computes for the same closes. The correlation exercise pairs the two instruments' frozen closes with the comparison's own `returnCorrelation` (common dates only, gaps longer than 4 days excluded, at least 20 paired returns, otherwise no coefficient). Deterministic sample histories are independent, so sample mode shows a weak correlation, labelled "Ukázková data"; the feedback text is derived from the coefficient, never authored for one provider.

## Backtesting history

The Backtesting Lab loads split-adjusted daily closes of one fixed instrument per provider (FMP: SPY 2007–2025; deterministic: the synthetic SPX series 2015–2025) through `MarketDataService` on the server, plus the chosen buy-and-hold benchmark when it is another instrument (FMP: AAPL or NVDA; deterministic: the synthetic NVDA series 2015–2025). It resamples them to month-end closes without filling gaps and runs in the quote currency without FX. The same provenance rule applies as for lessons. See `docs/backtesting.md`.

## Cache policy

External providers use the existing bounded process-local TTL/LRU cache and shared PostgreSQL cache of normalized successful results. PostgreSQL is fail-open: if it is unavailable, the local cache and providers continue to work. The shared entries retain their original expiry, source dates and attribution:

| Data | TTL |
| --- | ---: |
| Instrument search | 5 minutes |
| Instrument profile | 24 hours |
| Quote | 30 seconds |
| Completed daily history | 24 hours |
| Frankfurter reference FX | 1 hour |
| Corporate actions hook | 1 hour |
| ETF info, sectors, countries | 24 hours |
| ETF holdings | 12 hours |

FX cache keys include provider identity, base currency, quote currency, and request calendar date, so deterministic and Frankfurter entries cannot collide. Identical simultaneous loads are coalesced. Provider errors and malformed responses are not cached. The application composition supplies `PostgresMarketDataCacheStore` for cross-instance reuse. Provider identity is part of ETF cache keys, so older FMP analytics cannot collide with TickerInside entries. The existing JSONB contract needs no migration; the optional metadata extensions remain backward compatible.

The quote cache stores only normalized provider observations. Its 30-second TTL does not determine whether a quote is usable: session/calendar policy is evaluated again after every cache read.

## Operational readiness

The server-only readiness diagnostic reports the selected security and FX providers, whether required configuration is present, normalized capabilities, and supported calendar metadata. It is side-effect-free and does not call either provider. Its shape never includes `FMP_API_KEY`, credential values, sensitive headers, or credential-bearing URLs. The manual smoke command includes this safe result alongside live observations.

## Deferred limitations

Cross-provider security-identity migration, live provider health monitoring, early-close/ad-hoc-closure calendars, additional exchange calendars, daily historical portfolio FX series and exact intraday contribution valuations, corporate-action processing, total-return series, wider Investník currency support and background refresh are deferred. Equity fundamentals and ETF analytics are current Instrument Detail capabilities. Equity snapshots normalize valuation, profitability, business performance, and balance-sheet metrics with observation/reporting dates and explicit unavailable fields; ETF snapshots normalize holdings/concentration and allocation/exposure metadata. Deterministic fixtures remain unchanged. FMP supplies equity fundamentals and TickerInside supplies live ETF analytics behind the service boundary. The older FMP ETF adapter is retained for explicit use and tests; the default live path never calls its restricted endpoints or falls back to it. `npm run smoke:fmp-fundamentals` (`scripts/smoke-equity-fundamentals.mts`) remains a manual-only provider/cache check. Estimates, ratings, DCF, news, intraday data, crypto, and streaming remain outside the current scope.

## Manual FMP smoke test

Set `MARKET_DATA_PROVIDER=fmp`, `FX_DATA_PROVIDER=frankfurter`, and `FMP_API_KEY` locally, then run `npm run smoke:fmp`. This manual-only command searches for one instrument, resolves its profile, fetches its security quote from FMP, fetches USD/CZK from Frankfurter, and—when valuation is eligible—calculates one example CZK value with Investník's fixed-point arithmetic. It prints the exchange/calendar, market-session state, quote usability, valuation/execution eligibility, separate security/FX provenance, FX reference date, and safe readiness result without printing the credential. A weekend result with valuation allowed and immediate execution denied is successful. Automated tests never make external network calls.


## TickerInside ETF analytics

In live (`fmp`) mode the split is explicit:

| Capability | Provider |
| --- | --- |
| Discovery, profiles, quotes, daily historical prices | FMP |
| Equity fundamentals | FMP |
| ETF info, holdings, sectors, countries | TickerInside current fund snapshots |
| Reference FX | Existing configured ČNB / Frankfurter provider |

The server-only adapter calls only `https://tickerinside.com/api/v1/fund/{ticker}.json`, without authentication. It validates the ETF's provider-qualified FMP ID, symbol, USD quote currency and verified US MIC (`AMEX`/`XASE`, `NASDAQ`/`XNAS`, `NYSE`/`XNYS`), then checks the returned ticker and available identity metadata. AMEX is FMP's existing listing convention for SPY and several NYSE Arca ETFs; source NYSE Arca metadata does not imply a different security. Unknown or conflicting exchanges, European listings and UCITS funds such as VWCE and SXR8 are explicitly unavailable. A ticker on a foreign exchange is never mapped to its US namesake. This conservative boundary can exclude additional US venues until their FMP exchange metadata has been verified.

The optional live smoke check covers SPY, VOO, IVV, QQQ and VTI. Analytics availability is independent of FMP quotes, historical charts, orders and portfolio accounting. There is no sample-data or paid-FMP analytics fallback. No schema, reward, trade or portfolio persistence changes are required.

### Normalization and dates

- `expense_ratio` is in percentage points: 0.09 becomes 0.0009 internally (0.09% when displayed). Zero is valid; missing and invalid fields stay null.
- `aum_b` is billions of USD, converted to absolute USD with its `aum_date`. For Vanguard it can cover all share classes, which is labeled explicitly. When `etf_class_net_assets_b` is supplied, prefer the ETF share-class assets and its own date, labeled as such. `net_assets` from an SEC filing is a different, often aggregate measure and is never substituted. The AUM date is the provider's market-data read date, not a newly invented valuation date.
- `positions` counts the holdings map's keys, not the fund's authoritative position count. The official count remains null. The full valid holdings map is retained and sorted, including dotted/international identifiers. Display names are identifiers when the API provides no company name. ISIN, market values and share counts are never inferred.
- NAV, NAV currency and inception date remain null. `last_close` is a market closing price, not NAV; FMP remains the price source.
- Holdings and both breakdowns use `holdings_as_of`, which can be months older than `as_of` (the provider's price/return date). The latter is not used for composition. Info has no single `asOf`: expense ratio and assets retain their separate optional field dates, including unknown dates. Every dataset also keeps the actual HTTP retrieval timestamp. Cached reads do not advance it.
- Sector classification names are preserved in the normalized data; UI labels are translated without regrouping. Country codes become display labels without changing geography. These are classifications of holdings, not country revenue or currency exposures. `sector_coverage_pct`, `no_sector_pct`, `no_country_pct`, rejected rows, unmapped/listed holdings weights and incomplete totals inform completeness. Missing exposure is never fabricated or rescaled to 100%. Sector results below the provider's stated coverage threshold are labeled as inferred. The UI shows known and unclassified coverage.

A recently downloaded file can contain an old SEC N-PORT snapshot. The UI displays its holdings date, identifies regulatory snapshots and warns when composition is at least 90 days old, using the rendering date even on cache hits. Missing sections remain unavailable independently through `Promise.allSettled`. Empty or malformed holdings/breakdowns do not invalidate otherwise usable info. HTTP 404 is unsupported coverage; 429 is rate limited; 5xx/network/10-second timeout failures are provider unavailable; invalid JSON or conflicting identities are malformed responses. These request failures are not cached.

The four adapter methods coalesce requests for the same fund. A bounded 50-fund, one-minute TTL/LRU snapshot bridge also avoids duplicate downloads when independent shared-cache misses finish at slightly different times. It does not retain unused flows, history, HTML or weekly-price fields. Missing sections of an otherwise valid file can be retried after this short bridge expires; normalized successes retain the 12/24-hour service TTLs above. Separate instances can still download simultaneously on a shared-cache cold miss; there is no distributed request lock or background refresh.

### Attribution and reuse

API schema and source conventions: [TickerInside API](https://tickerinside.com/api/). Terms checked on 2026-10-19: [TickerInside legal notice](https://tickerinside.com/legal/).

TickerInside licenses its own work in current snapshots under CC BY 4.0, permitting commercial use with attribution. This grant does **not** grant the original issuers' rights to their holdings publications or third-party rights to prices. Review the original issuer terms before bulk redistribution or commercial reuse; do not assume a free API removes those obligations. There is no guarantee of coverage, timeliness or correctness.

The ETF interface visibly credits “Zdroj ETF dat: TickerInside”, links to the verified fund page when supplied (otherwise its specific current JSON source), and exposes the provider's plain-text citation and license. Each cached dataset preserves this attribution. Provider `cite_html` is discarded; citations are escaped React text and source links are constructed from the validated ticker. Changes in Investník are unit conversion, display formatting, sorting and filtering invalid rows; no missing holdings or weights are invented.

Holdings-history and flows endpoints have separate terms and are outside this integration. Although current fund JSON can include a `flows` object, it is not retained or exposed by the adapter.

### Optional live smoke check

Run `npm run smoke:tickerinside` to fetch current SPY, VOO, IVV, QQQ and VTI fund snapshots. No environment variables or API key are required. It verifies one HTTP request per fund across all four methods and prints normalized availability, metric dates, coverage and attribution. A missing metric is allowed; required fund info/holdings failures make the check fail. This command is manual only; the standard test suite uses mocked HTTP responses and never calls TickerInside. FMP price/discovery checks still use `npm run smoke:fmp` and require the existing FMP key.
