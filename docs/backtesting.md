# Backtesting Lab

Backtesting answers *how would this idea have behaved?* It never reads or changes the learner's Practice Capital, reward receipts, trades or portfolio generations.

The Lab has two data sources. The learner picks one in step 1 of the setup.

| Source | Data | Computed | Label |
| --- | --- | --- | --- |
| Ukázkový vzorek | `src/features/lab/sample-data.ts`: 132 invented monthly returns of stocks, bonds and cash | in the browser, unchanged since the redesign | „Ukázková data · syntetické výnosy“ |
| Cenová historie | daily split-adjusted closes through `MarketDataService` | on the server (`runHistoryBacktestAction`) | follows provenance, see below |

The synthetic sample stays the default. It keeps deterministic tests and demos stable and needs no market data.

## Layers

`src/features/backtesting/` separates the steps:

1. **Specification** (`spec.ts`). The Zod `BacktestSpec` lists the instruments with integer basis-point weights (cash is the remainder, so the mix is always exactly 100 %). It also holds the rule (`fixed-weights` with rebalancing `none` / `monthly` / `annual`, or `trend-filter` with an SMA window), the start and end month, the initial amount, `frequency: "monthly"`, the quote `currency`, `adjustment: "split-adjusted"` and the `costs` per trade (see [Transaction costs](#transaction-costs)). The benchmark has its own `BuyAndHoldBenchmark` spec, see below.
2. **Catalog** (`catalog.ts`). There is a fixed plan per market-data provider: the instrument, the benchmark choices, the year range, the fetch window, the strategies and the period presets. The browser sends only a strategy id, a benchmark id from the plan, a rebalancing rule, an amount, years and, when switched on, the costs as typed. It never sends a price or a value.
3. **Normalized history** (`run.ts`, `monthly.ts`). The server loads the plan's whole window once per run, validates it like the instrument chart does, and takes the **month-end close**: the last close inside each calendar month. That close must lie within 7 days of the month end. Instruments are paired by calendar month. A month that is missing, or whose data stops mid-month, refuses the run with a message naming the month. Nothing is forward-filled or interpolated.
4. **Simulation** (`simulate.ts`). The simulation runs month by month without look-ahead. The value at month *t* uses closes up to *t*. A trend-filter decision for month *t* uses closes up to *t − 1*: it holds the instrument when the previous month-end close was above the mean of the last 10 month-end closes (about 200 trading days), otherwise cash. Annual rebalancing happens at each December close. No rebalance is counted after the last month.
5. **Metrics** (`metricsFromValues` in `src/features/lab/backtest.ts`). The sample and history runs share one function, see [Metrics](#metrics).
6. **Presentation** (`src/components/lab/backtest-source.ts`, `backtesting-lab.tsx`). Copy, labels and the chart's currency and benchmark come from the result's source.

## Metrics

Every metric is computed for strategy A and benchmark B from the month-end values and the simple monthly returns between them.

| Metric | UI label | Convention | Annualized |
| --- | --- | --- | --- |
| `finalValue` | Konečná hodnota | last month-end value | – |
| `totalReturn` | Celkový výnos | final value ÷ initial amount − 1 | no |
| `cagr` | CAGR | (final ÷ initial)^(12 ÷ months) − 1 | yes |
| `maxDrawdown` | Největší propad | largest fall from a previous peak, including the start value | – |
| `volatility` | Volatilita | sample standard deviation (n − 1) of monthly returns × √12 | yes |
| `sharpeRatio` | Sharpeho poměr | mean monthly excess return ÷ sample standard deviation (n − 1) of the excess returns × √12 | yes |

The labels keep total return and CAGR apart: total return is the whole period, CAGR is per year.

**Sharpe ratio.** Excess return is the monthly return minus the monthly risk-free rate, `(1 + annual rate)^(1/12) − 1`. The annual rate is `BACKTEST_RISK_FREE_RATE`, a fixed **0 %**. That matches the simulation, where cash earns nothing too; it is a stated simplification, not a market rate, and every result carries the rate it used (`riskFreeRate`) so the UI can say it. With a constant rate the deviation of excess returns equals the volatility above. The ratio is `null` („Nedostupné“) when there are fewer than 12 monthly returns or the returns never vary (for example a trend filter that stays in cash all period). It is never shown as 0 or infinity. The methodology warns that a Sharpe ratio over a short period is unstable. A historical rate series (for example the CNB 2T repo rate, or US T-bills for USD runs) would need its own provenance and is not part of this change.

## Benchmark

Every result compares strategy A with benchmark B, a **buy and hold**: the whole amount buys one instrument at the start value's close, and then nothing is rebalanced or traded. The UI calls it „Buy-and-hold {symbol}“.

- **Choice.** In history mode the learner picks B from the plan's `benchmarks` (step 2, „Benchmark B · koupit a držet“). The first entry is the default: the broad index the strategies use (SPY, or the SPX sample). The other entries are single stocks with history on the same plan. A run, the period comparison and „Vybrat toto období“ all keep the chosen benchmark.
- **Same terms.** `buyAndHoldFor(strategy, instrumentId)` builds B from the strategy's own period, amount, currency and return semantics. `backtestComparisonSchema` refuses a pair that differs in any of them, including a total-return or raw benchmark against a price-only strategy. At run time, a benchmark series in another quote currency or with another adjustment mode is refused (`BacktestDataError`), never converted or mixed in.
- **Same months.** B's month-end closes are resampled like the strategy's and paired by calendar month from the start value to the last month. A month missing only in B's history refuses the run.
- **Same simulation.** `simulateBuyAndHold` runs B through `simulateBacktest` as one holding at 100 % with no rebalancing. A strategy that holds the benchmark's instrument at 100 % without rebalancing therefore has an identical curve (`simulate.test.ts`, `run.test.ts`).
- **Comparison.** The chart draws A and B. The metric table shows A, B and the difference A − B: money for the final value, percentage points (p. b.) for total return, CAGR, drawdown and volatility, and a plain number for the Sharpe ratio (unavailable when either side is). The difference is neutral: no colour or wording says which path „won“. The prediction stays optional and is never scored.
- **Labels.** A run is „Historická data“ only when both series are historical. When B is another instrument, the source notes, the chart note and the explanation name both symbols, and the explanation says that the difference includes the difference between the instruments.

The synthetic sample has no instruments. Its benchmark is the stock sample bought once and held („Buy-and-hold akciového vzorku“), and it is not selectable.

## Transaction costs

Issue #31. History runs can pay costs on every trade; the synthetic sample cannot (it has returns, not instruments). Costs are **off by default**: step 5 of the setup („Náklady obchodů“) switches them on and asks for a rate (default 0,1 %) and an optional flat fee per trade in the run's currency.

- **Spec.** `costs: { rateBps, fixedFee }`. The rate is integer basis points, 0–200 (at most 2 %), so 0,1 % and 0,25 % are exactly 10 and 25. The flat fee is 0–1 000. `parseCostRate` / `parseFixedFee` (`costs.ts`) read the typed strings („0,1“ or „0.1“, at most two decimals) without floating point and refuse anything else before history is loaded. The benchmark inherits the strategy's costs, and `backtestComparisonSchema` refuses a pair with different costs.
- **Trades.** One trade is one purchase or sale of one instrument; cash is never traded. The strategy trades at the initial purchase, at every rebalance and at every trend-filter switch; benchmark B only at its purchase. Nothing is sold at the end (a sale would cost a fee too, and the UI says so).
- **Model.** `tradeToTargets` brings the book to its target weights and pays the costs out of it, so that afterwards it sits exactly at the target weights of what is left: `value − after = rate × Σ |traded value| + fixedFee × trades`. With known trade directions this has a closed form; the directions are re-read at the value after costs until they stop changing. Costs that would use the whole portfolio refuse the run.
- **Timing.** A month-end value is the value before that close's trades. The start value stays the initial amount, and a trade's costs show in the next month's return, so total return and CAGR are measured against what the learner put in.
- **Zero costs.** With `{ rateBps: 0, fixedFee: 0 }` the arithmetic is bit-for-bit the same as without a cost model (`simulate.test.ts`, `run.test.ts`).
- **With and without.** A run with costs is simulated a second time with `NO_COSTS` on the same closes; the result carries both (`withoutCosts`) and `trading` (trades, turnover, costs paid) for A and B. The result view has a switch „S náklady / Bez nákladů“ for the chart, metrics and reflection, and a section „Co stály náklady“: the final-value difference and CAGR difference in a headline („Náklady tě u strategie A stály X (Y p. b. ročně)“), then trades, turnover (obrat), costs paid and the impact on final value, total return, CAGR and Sharpe ratio for A and B, and a short explanation why more rebalancing costs more. `costImpact` computes every impact as with costs minus without; the UI only formats.

## Return semantics

Split-adjusted closes give a **price return without dividends**. The UI says „jen cena, bez dividend“ next to every history chart and in the data notes. A total-return series is a different mode. If one is added later, it must be explicitly selectable and never silently substituted. FMP's dividend-adjusted closes are not equivalent to Investník's reinvested total-return policy, and the FMP adapter refuses `total-return` requests.

Cash earns no interest. Taxes, spreads, inflation and further contributions are not modelled; trading costs only when switched on (see above).

## Currency decision

A backtest runs in the instrument's **quote currency**. Today that is USD for both plans, and the amount input and every value are shown in USD. There is no conversion to CZK. A historical FX path would add a currency effect that this lesson does not explain, and the market-data boundary has no historical FX series yet. A plan declares its expected currency, and a series in any other currency is refused. Converting to CZK would need a separate, explicitly labelled mode with dated historical FX.

## Plans

| Provider | Instrument | Benchmarks | Years | Label |
| --- | --- | --- | --- | --- |
| `fmp` | SPY (`FMP:AMEX:SPY`) | SPY (default), AAPL, NVDA | 2008–2025, fetched as 2007-01-01…2025-12-31 | „Historická data · Financial Modeling Prep · {od–do}“ |
| `deterministic` | SPX sample (`US-XCBO:SPX`) | SPX (default), NVDA sample | 2016–2025, fetched as 2015-01-01…2025-12-31 | „Ukázková data · ukázková řada SPX · {od–do}“ |

On the current FMP plan, SPY is the only ETF with history (bond ETFs such as TLT, IEF, AGG and BND return HTTP 402). The 60 / 40 strategy therefore pairs SPY with cash instead of a bond ETF. AAPL and NVDA have history for the whole window and are offered only as benchmarks. A benchmark other than the strategy's instrument costs one more cached history request per run. One FMP request returns at most 5,000 daily rows, and the fixed 19-year window stays below that. If a provider ever truncates the window, the missing months refuse the run instead of shortening it.

FMP data is not stored in the repository (see `docs/market-data.md`). It is loaded at run time through the service cache (completed daily history: 24 hours). Results are reproducible because the window is fixed.

The deterministic SPX fixture is an invented weekday series with stress windows in late 2018, early 2020 and 2022. The NVDA fixture has an invented 2015–2025 weekday series too, with a steeper drift and deeper stress windows, so that deterministic mode can offer a second benchmark. It goes through exactly the same pipeline, and its label stays „Ukázková data“ because labels follow provenance (`dataKind`, `isDeterministic`), not the mode.

## Authority and limits

`runHistoryBacktestAction` requires a session and counts against the `market:backtest` rate limit (20 per minute) and the shared daily market-data budget. It accepts at most four periods per call (the period comparison). It imports no persistence, reward, progression or portfolio-ledger module; `run.test.ts` checks this.

## Tests

- `src/features/lab/backtest.test.ts` covers the metrics: a hand-computed Sharpe ratio (√11 ÷ 3 for twelve months alternating +2 % and −1 %), a non-zero rate, negative excess return, zero volatility and short periods (`null`), decimal edge cases, and total return versus CAGR.
- `costs.test.ts` covers the cost model: entry purchase, target weights after costs, conservation (costs = rate × turnover + fees), a full sale, no trade at target, zero costs, costs that use up the portfolio, the input parsing (0,1 / 0,25 / limits) and the impact.
- `spec.test.ts`, `monthly.test.ts`, `simulate.test.ts` cover the specification, the strategy/benchmark comparison rules, month-end resampling and alignment, a missing month, rebalancing rules, the trend filter, buy and hold, no look-ahead, and decimal amounts; with costs: zero costs identical for every rule, entry costs only without rebalancing, 0,1 % and 0,25 % on a rebalance by hand, more rebalancing costing more, trend-filter switches and buy and hold. Monthly rebalancing on price indices reproduces the synthetic Mix 60 / 30 / 10 exactly.
- `run.test.ts` is an integration test with the deterministic provider and with a mocked FMP: labels, the single cached request, identical curves for a benchmark on the strategy's own instrument, another benchmark instrument, refused currency and return semantics, refused input, a missing month in either series, zero costs, the second run without costs and the trade counts per rebalancing rule.
- `npm run test:backtesting-browser` covers the synthetic flow, the history flow in deterministic mode with both benchmarks and the A − B differences, the costs switch (refused input, both views, the cost summary, switching off again), responsive layouts, 200 % text, and an unchanged portfolio and Practice Capital.


## Educational experiments (#143)

The history pipeline (including its truthfully labeled deterministic sample) accepts additive optional spec fields. Existing requests and explicitly disabled settings retain the original simulation and results. The legacy synthetic-return flow stays unchanged. No database migration or persisted backtest is introduced; portfolio trades, rewards, Practice Capital and portfolio clocks are untouched.

| Field | Convention |
| --- | --- |
| `contributions: { monthlyAmount, startMonth?, endMonth? }` | Nonnegative amount in the run currency, credited **after** each month's price move, including the final month. Optional inclusive dates must be inside the run. |
| `lumpSumSplit: { months }` | Entire initial budget belongs to the portfolio from the start. First equal slice invests immediately, subsequent slices at month ends. Unreleased capital stays in a separate, interest-free cash reserve. It is never a second contribution. |
| `annualFundCostBps` | Optional **additional model cost**, 0–2000 integer bps. Invested sleeves are multiplied monthly by `(1 − bps / 10000)^(1/12)` after the price move; cash has no fund cost. This is not a verified TER: historical ETF prices may already reflect actual operating costs. |
| `withdrawals: { monthlyAmount }` or `{ annualRate }` | Mutually exclusive. Annual rate is a fraction of the **initial** budget, divided by 12, with no inflation adjustment. End-of-month cash is used first, then pro-rata sales, with existing transaction costs. Delivered withdrawals are limited by assets after fees. Unmet amounts are reported separately and never borrowed. |
| `outOfSampleStartMonth` | First month of the testing part, with at least two monthly returns on each side. One continuous simulation: holdings, capital, SMA lookback and flow schedule are not restarted. |

Each benchmark inherits the exact same experiment settings. It still has no scheduled rebalancing, but contributions, staged purchases and withdrawals can cause additional benchmark trades. A deposit buys target-weight sleeves without selling existing holdings; a configured rebalance can still sell them. Designated cash for the staged budget is outside those rebalances until released. The final contribution remains cash: there is no final purchase or forced sale. Existing initial/rebalance purchase fees appear in the following monthly return; withdrawal sale fees appear in that month's return. A fee-consuming purchase refuses the run instead of creating debt.

The result reports total contributed capital, actual withdrawals, withdrawal shortfall, transaction fees, fund costs and **gain = terminal value + actual withdrawals − contributed capital**. Transactions inside the portfolio are not external flows. The with/without-cost view removes both transaction fees and the additional fund cost, while retaining the same planned cash flows, period and prices. Actual withdrawals can differ if one path runs out of money.

### Performance with flows

`r[t] = (monthEndValue[t] − contribution[t] + actualWithdrawal[t]) / previousMonthEndValue − 1`. Values include end-of-month flows, but the performance numerator removes them. When the opening balance is zero after withdrawal exhaustion, a month with no invested assets has a zero return; replenishment is not profit. The return index is the product of `(1 + r[t])`. Deposits and withdrawals do not manufacture return, drawdown, volatility or Sharpe. Drawdown is explicitly the drawdown of this **return index**, while unfunded withdrawals report the separate failure to fund consumption.

Flow-enabled results display **TWR for the period**, **annualized TWR**, and **MWR annually** instead of naive balance-based CAGR. The existing `totalReturn` and `cagr` fields hold TWR and annualized TWR in this mode; `finalValue` and `values` remain actual balances. `education.returnIndex` supplies flow-adjusted history to Monte Carlo, so it cannot mistake a deposit for an investment return. Risk metrics use those monthly returns. Each holdout segment has its own TWR, annualized TWR, MWR, volatility, drawdown and Sharpe, with actual start/end balances. Segment drawdown starts at the segment boundary; it does not include an earlier peak.

MWR solves periodic monthly IRR and annualizes geometrically. It uses initial outflow, end-of-month net external flows and terminal value, with a bisection in annual log-growth space (bounded to −50…50). A single sign change ensures a unique candidate; multiple sign changes are conservatively unavailable rather than choosing an arbitrary root. A complete loss without receipts is −100%; a missing/out-of-range root is unavailable. This is monthly IRR, not date-weighted XIRR. TWR linking follows the [GIPS calculation methodology](https://www.gipsstandards.org/wp-content/uploads/2021/03/calculation_methodology_gs_2011.pdf); the single-sign-change IRR limitation is described by [Microsoft](https://support.microsoft.com/en-au/excel/go-with-the-cash-flow-calculate-npv-and-irr-in-excel). These are numerical conventions for an educational simulation, not a claim of GIPS compliance.

### Attempts, holdout and unavailable data

The tab-session counter stores distinct **successful** specifications per selected learning goal in `sessionStorage` (memory fallback if storage is blocked). Amounts and fees use parsed numeric results so formatting changes do not create an attempt; prediction changes and with/without-cost view switches are not runs. Period comparisons also count each executed specification. Reload preserves the tab's count; a new goal has a separate count. Nothing is stored in the learner database, and there is no reward. At five distinct specs, an explicit educational reminder warns about selection and overfitting; five is an interface trigger, not a researched diagnostic threshold. It never blocks a run or labels the learner biased. The broader decision-card framework remains #141, which depends on this counter.

Choosing an out-of-sample split does not erase previous peeking. The UI warns that changing a strategy after seeing the testing part makes that data part of fitting. Preset period comparisons show full independent periods with the same flow/cost settings and omit the original split, which may lie outside another period. There is no optimizer, leaderboard or probability-of-profit claim.

2008–2009, 2020–2021 and 2022 presets use available plan data; missing history refuses the run rather than truncating it. In deterministic mode, unavailable 2008 is called out and sample 2020/2022 are explicitly not actual crises. Live strategies continue to use cash rather than pretend it is bonds; bond data awaits #146. Sortino/Calmar and unpublished lesson links remain deferred.

Tests: `experiments.test.ts` covers known flows/IRR, decimal amounts (0.1, 0.25, 1.3333), initial-budget staging, invested-only fund costs, withdrawal exhaustion/fees, benchmark parity, spec validation and segment boundaries. `run.test.ts` exercises the whole provider→simulation→metrics path for both cost views and rejects invalid experiments before fetching data. Browser acceptance covers TWR/MWR labels, cash-flow totals, holdout, distinct attempts/retries/reload/goals, overfitting notice, responsive widths/200% text, and unchanged persistent financial state.
