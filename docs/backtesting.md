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

1. **Specification** (`spec.ts`). The Zod `BacktestSpec` lists the instruments with integer basis-point weights (cash is the remainder, so the mix is always exactly 100 %). It also holds the rule (`fixed-weights` with rebalancing `none` / `monthly` / `annual`, or `trend-filter` with an SMA window), the start and end month, the initial amount, `frequency: "monthly"` and `adjustment: "split-adjusted"`.
2. **Catalog** (`catalog.ts`). There is a fixed plan per market-data provider: the instrument, the year range, the fetch window, the strategies and the period presets. The browser sends only a strategy id, a rebalancing rule, an amount and years. It never sends a price or a value.
3. **Normalized history** (`run.ts`, `monthly.ts`). The server loads the plan's whole window once per run, validates it like the instrument chart does, and takes the **month-end close**: the last close inside each calendar month. That close must lie within 7 days of the month end. Instruments are paired by calendar month. A month that is missing, or whose data stops mid-month, refuses the run with a message naming the month. Nothing is forward-filled or interpolated.
4. **Simulation** (`simulate.ts`). The simulation runs month by month without look-ahead. The value at month *t* uses closes up to *t*. A trend-filter decision for month *t* uses closes up to *t − 1*: it holds the instrument when the previous month-end close was above the mean of the last 10 month-end closes (about 200 trading days), otherwise cash. Annual rebalancing happens at each December close. No rebalance is counted after the last month.
5. **Metrics**. These are the same conventions as the sample: final value, CAGR over months ÷ 12, maximum drawdown on month-end values including the start, and sample volatility of monthly returns × √12.
6. **Presentation** (`src/components/lab/backtest-source.ts`, `backtesting-lab.tsx`). Copy, labels and the chart's currency and benchmark come from the result's source.

Each history run is compared with buying and holding the same instrument from the same start value („Jen SPY“).

## Return semantics

Split-adjusted closes give a **price return without dividends**. The UI says „jen cena, bez dividend“ next to every history chart and in the data notes. A total-return series is a different mode. If one is added later, it must be explicitly selectable and never silently substituted. FMP's dividend-adjusted closes are not equivalent to investi's reinvested total-return policy, and the FMP adapter refuses `total-return` requests.

Cash earns no interest. Costs, taxes, spreads, inflation and further contributions are not modelled.

## Currency decision

A backtest runs in the instrument's **quote currency**. Today that is USD for both plans, and the amount input and every value are shown in USD. There is no conversion to CZK. A historical FX path would add a currency effect that this lesson does not explain, and the market-data boundary has no historical FX series yet. A plan declares its expected currency, and a series in any other currency is refused. Converting to CZK would need a separate, explicitly labelled mode with dated historical FX.

## Plans

| Provider | Instrument | Years | Label |
| --- | --- | --- | --- |
| `fmp` | SPY (`FMP:AMEX:SPY`) | 2008–2025, fetched as 2007-01-01…2025-12-31 | „Historická data · Financial Modeling Prep · {od–do}“ |
| `deterministic` | SPX sample (`US-XCBO:SPX`) | 2016–2025, fetched as 2015-01-01…2025-12-31 | „Ukázková data · ukázková řada SPX · {od–do}“ |

On the current FMP plan, SPY is the only ETF with history (bond ETFs such as TLT, IEF, AGG and BND return HTTP 402). The 60 / 40 strategy therefore pairs SPY with cash instead of a bond ETF. One FMP request returns at most 5,000 daily rows, and the fixed 19-year window stays below that. If a provider ever truncates the window, the missing months refuse the run instead of shortening it.

FMP data is not stored in the repository (see `docs/market-data.md`). It is loaded at run time through the service cache (completed daily history: 24 hours). Results are reproducible because the window is fixed.

The deterministic SPX fixture is an invented weekday series with stress windows in late 2018, early 2020 and 2022. It goes through exactly the same pipeline, and its label stays „Ukázková data“ because labels follow provenance (`dataKind`, `isDeterministic`), not the mode.

## Authority and limits

`runHistoryBacktestAction` requires a session and counts against the `market:backtest` rate limit (20 per minute) and the shared daily market-data budget. It accepts at most four periods per call (the period comparison). It imports no persistence, reward, progression or portfolio-ledger module; `run.test.ts` checks this.

## Tests

- `spec.test.ts`, `monthly.test.ts`, `simulate.test.ts` cover the specification, month-end resampling and alignment, a missing month, rebalancing rules, the trend filter, no look-ahead, and decimal amounts. Monthly rebalancing on price indices reproduces the synthetic Mix 60 / 30 / 10 exactly.
- `run.test.ts` is an integration test with the deterministic provider and with a mocked FMP: labels, the single cached request, refused input, and a missing FMP month.
- `npm run test:backtesting-browser` covers the synthetic flow, the history flow in deterministic mode, responsive layouts, 200 % text, and an unchanged portfolio and Practice Capital.
