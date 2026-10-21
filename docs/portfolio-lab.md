# Persistent Portfolio Lab accounting

Portfolio Lab is an educational paper portfolio. Its base currency is CZK. It consumes the configured normalized market-data service: deterministic mode supplies reproducible sample security/FX data, while live mode composes FMP security observations with Frankfurter dated reference FX rates. No value represents withdrawable money or guaranteed broker execution.

## Generations and contributions

Each learner has at most one active portfolio generation. Reset closes that row, links a new generation through `reset_from_portfolio_id`, and retains every prior trade. `opening_capital_minor` is the exact receipt entitlement observed when the generation opened; it is an audit baseline, not a mutable balance.

Current contributed Practice Capital is always the lifetime sum of legitimate `lesson_award.practice_capital_minor` receipts and `progression_unlock.practice_capital_minor` grants. Cash for the active generation is:

```text
receipt and unlock-grant entitlement + sum(active-generation trade cash deltas)
```

This makes a later lesson reward available as cash without counting it as investment performance. Reset starts with no active-generation trade cash flows, so it restores the same lifetime entitlement without copying or double-counting rewards.

Portfolio total is cash plus current holdings market value. Investment gain/loss is portfolio total minus current contributed Practice Capital. A missing quote or FX rate makes valuation incomplete; it is never substituted with zero.

## Portfolio performance (LAB-03 / #138)

The Kč gain/loss is labeled **Zisk / ztráta od otevření portfolia**. There is no longer a portfolio percentage obtained by dividing this amount by lifetime earned capital (#106): an extra learning reward must not dilute a displayed investment return. Per-holding percentages remain unrealized gain divided by the all-in cost of the open holding, using central half-away-from-zero rounding.

`features/portfolio/performance.ts` provides shared pure TWR and dated MWR calculations for Lab and future lesson 3.1.6. Both measure the **whole generation, including uninvested cash**, in CZK, net of recorded transaction/FX costs. They exclude unrecorded dividends, cash interest and taxes; they are not total-return series. Existing corporate-action handling limitations still apply. The UI shows the period dates and conventions in a keyboard-accessible disclosure. The lesson link resolves only when #204 publishes `/learn/returns/time-vs-money-weighted`; until then it says the lesson is being prepared.

### External contributions and read consistency

The saved `opening_capital_minor` is one opening contribution. Positive lesson receipts and unlock grants after `opened_at` contribute at their original `awarded_at` / `unlocked_at` timestamps; zero receipts create no boundary. Same-instant receipts are combined. A receipt sharing the opening millisecond joins the initial contribution only to the extent it is not already in the opening baseline. Resets begin a new series with restored entitlement, without replaying earlier receipts or trades. A user starting with no capital begins measurement at the first positive contribution.

Trades and fees affect cash and holdings internally. A sale is **not** a withdrawal and a purchase is **not** a new external contribution. Withdrawals are not supported. Contributions, their exact entitlement sum and ordered generation trades are read in a single read-only repeatable-read PostgreSQL transaction; existing mutation locks, retries, reward versions and receipt amounts are unchanged. An inconsistent opening/receipt total is unavailable, not an invented flow.

### TWR and historical coverage

For each contribution after the first, reconstruct pre-flow cash and holdings from earlier immutable trades. Link `valueBefore / previousValueAfter` geometrically, then link the final portfolio value. Products and money stay `bigint`; the rational product is reduced and rounded at the return boundary. The terminal Kč value uses the ordinary complete portfolio valuation. A missing terminal value makes both returns unavailable.

Providers expose daily history rather than intraday snapshots. When holdings exist at a flow, `performance-loader.ts` requests **raw** daily prices from `MarketDataService`, takes the latest close from a fully completed prior UTC day, and uses dated reference FX for that close. Such TWR is visibly labeled **odhad** (estimate): it cannot claim to remove intraday contribution-timing effects exactly. All-cash boundaries need no market data. No adjusted close, current FX, execution price, deterministic fallback or future observation fills a gap. History must be complete and match the instrument/currency/adjustment; neither price nor FX may be more than seven calendar days old. This is a conservative coverage guard, not a market-calendar guarantee. Missing data, failed providers, a zero-value intermediate boundary or an ambiguous trade sharing a contribution timestamp makes TWR unavailable. MWR remains independent of historical-boundary coverage.

### MWR, period labels and numerical limits

MWR solves `endingValue = Σ contribution × exp(logGrowth × remainingTime / totalTime)`. Only dimensionless ratios derived from exact minor units enter numerical exponentiation. Because all external flows are positive contributions followed by one terminal portfolio value, this function is monotonic and has at most one solution. Bisection uses log-growth bounds `[-36, 36]`, at most 200 iterations, a normalized residual tolerance of `1e-13` or log-interval tolerance of `1e-13`. A root outside that range, invalid/negative flows or lack of convergence is unavailable. A complete terminal loss is −100%; zero duration or no positive contributions has no defined return. The one-contribution case uses the same exact growth ratio as TWR.

Both metrics return cumulative basis points. For periods of at least **365 elapsed days**, both also return annualized basis points using **ACT/365**, and the UI compares those annual rates while disclosing cumulative returns. Shorter periods show both **za období**, with no annualization. It never compares the reference example's +8% cumulative TWR directly to −6.05% annual MWR. Dates use UTC instants for elapsed time, with Europe/Prague display dates.

The #204 reference (10,000 Kč, +20%, 50,000 Kč added after 365 days, then −10% over another 365 days) gives TWR **+8% cumulative / +3.92% annually** and MWR **−11.74% cumulative / −6.05% annually**. Differences can reflect cash-flow timing; they do not diagnose a behavioral mistake or prove real-money readiness.

Method references checked 2026-10-21: [CFA Institute GIPS handbook, input data and calculation methodology](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/) and [Microsoft XIRR, dated flows and 365-day convention](https://support.microsoft.com/en-us/excel/functions/xirr-function). These inform conventions; the daily-close estimate is not a claim of GIPS compliance or intraday precision.

## Exact arithmetic

- Money is stored as `bigint` minor units.
- Quantities use `numeric(24,8)` and accept at most 8 decimal places.
- Execution prices use `numeric(24,8)`.
- FX rates use `numeric(24,12)`.
- New trades retain separate immutable security and FX provenance; Frankfurter observations preserve a calendar reference date rather than a fabricated intraday timestamp.
- The server converts normalized market observations once at the ledger boundary, then uses scaled `bigint` arithmetic.
- Money products and proportional cost-basis allocations round to the nearest minor unit, with half values rounded away from zero.

Holdings are folded from the immutable trade ledger using weighted-average cost. No mutable position table exists. Allocation is each holding’s current market value divided by total invested holdings value; available cash is deliberately excluded.

## Transaction boundary

Buy, sell, reset, and lesson completion lock the learner’s `user` row. Under that lock a trade re-reads receipt entitlement, active-generation trades, cash, and quantities. This serializes competing buys, competing sells, and reward/trade races. Client input is limited to instrument identity, quantity, an idempotency key, and optionally the reviewed profile identity (only a stale-profile guard); execution price, FX, cash effects, and performance are server-derived.

## Fictional broker costs (LAB-01 / #136)

New executions use immutable, versioned fictional tariffs from `features/portfolio/costs.ts`:

| Profile | Commission on reference notional | Minimum / maximum | FX markup |
| --- | --- | --- | --- |
| Investník standard (`investi-standard-v1`, default) | 0.10% | 10 / 200 Kč | 0.50% |
| Investník nižší konverze (`investi-low-fx-v1`) | 0.20% | 25 / 300 Kč | 0.10% |

These are illustrative educational settings, not real broker prices or recommendations. V1 commission is denominated in CZK. CZK instruments incur no conversion markup. Custody requires simulated time (#139) and is excluded; bid/ask spread and slippage are not fabricated from single-price observations. Real broker execution is not modeled.

The learner can choose a profile in the order panel. The server validates the registry identity and saves it in `learning_profile.broker_fee_profile_id` under the learner lock; a missing selection resolves to the default. Reset preserves this user-level preference. The future IPS (#127) can reference the same identity. Changing a tariff requires a new versioned id; changing a selection never reprices existing trades.

`computeTradeCost` is the pure shared boundary for Lab review, execution, allocation planning and lesson cost calculations. It accepts scaled integer quantity, price and reference FX, side, quote currency and a tariff; it returns exact minor-unit reference notional, commission, conversion cost, execution notional, cash delta and total cost. **Lesson 2.2.2 is not authored/published in the current registry**; its future calculator must import this function rather than duplicate it. This infrastructure change does not add or publish curriculum or change lesson identities/rewards.

Commission is the reference notional times the basis-point rate, bounded by the CZK minimum/maximum. Execution FX is reference FX × `(1 + markup)` on buys and `(1 − markup)` on sells, rounded to the ledger's 12 dp FX precision. Each notional and commission money product rounds once to minor units, half away from zero; calculations never multiply a rounded unit price. The conversion cost is the adverse difference between rounded reference and execution notionals. Buy cash delta is `−(execution notional + commission)`; sell delta is `execution notional − commission`. A sale whose commission exceeds proceeds requires enough existing cash to cover the difference. Valuation continues to use reference FX. Separately rounded executions and remaining holdings can leave minor-unit residuals.

Both buy and sell require a server-calculated review before UI confirmation. Review is an estimate, not a price lock; confirmation re-observes market data and calculates costs under the same learner lock as cash/holdings. A changed reviewed tariff is refused and requires a new review. No client amount, fee, price or rate is accepted as authority.

Migration `0016_portfolio_costs` adds nullable audit fields without updating old trades. Every new trade (including newly seeded demos and allocation executions) snapshots profile id, commission rate/minimum/maximum/currency, applied FX markup, markup amount, reference FX and reference notional alongside existing execution FX and fee. A completeness/consistency check rejects partial snapshots. Legacy trades retain NULL cost metadata and their original fee/cash values. Idempotent retries return the original trade, even after a profile change. No receipt, grant or contributed capital is recalculated.

## Target mixes

A mix ("Uložit portfolio") is the learner's intent: integer basis-point weights for up to 12 instruments (equities, ETFs, bonds) plus a cash weight, summing to exactly 10 000. It is stored append-only in `portfolio_allocation` and `portfolio_allocation_line`, scoped to a generation; the latest version is the current target, older versions stay for audit, and a reset leaves the old generation's mixes with it. A mix holds no money: `applied_value_minor` is an audit snapshot of the value the weights were applied to and is never read back as a balance.

Executing a mix produces ordinary ledger trades. Under the same learner-row lock as trades, resets and rewards, the server re-reads receipts and trades, takes one fresh execution observation per instrument the mix touches (every target line and every current holding; a holding outside the mix has a 0 % target and is sold in full), and plans:

```text
total          = cash + Σ holding value at the execution observations
target_i       = floor(total × weight_i / 10 000)
sells first    : surplus value → quantity floored to 8 dp (a 0 % target sells everything)
buys after     : min(shortfall, cash above target reserve) → quantity affordable INCLUDING fees/FX
```

An exact monotonic quantity search includes commission and conversion in each buy budget. Each total buy debit is therefore at most its target budget, cash never goes negative, and every rounding remainder stays as cash. Differences under 1 Kč are not traded. The client sends only instrument identities, integer weights and an idempotency key; trades use derived keys `allocation:<key>:<n>`. If any involved quote is not usable for execution (market closed, stale, unavailable, other provider), nothing is written. `reviewAllocation` runs the same plan without writing, as an estimate for the review step.

## Price and FX attribution

The investment gain/loss is split read-only, from the ledger and the same observations as the valuation:

```text
reference basis = remaining purchase notional at reference FX (excluding costs)
price effect    = round(reference basis × current quote-currency value / cost in quote currency) − reference basis
FX effect       = market value − reference basis − price effect
cost effect     = reference basis − cost basis (open positions only, negative)
gain/loss       = Σ price effect + Σ FX effect + Σ cost effect + realized gain/loss of sells
```

Cost in quote currency is folded with the same weighted-average allocation as the CZK cost basis, so the implied purchase rate represents reference FX without confusing commission or the conversion markup with market movement. Both reference and all-in bases allocate proportionally on sells; realized gain/loss already includes the sold portion's buy costs and sale costs, which are not counted again as open-position costs. The parts sum exactly to the investment gain/loss. CZK-quoted holdings have no FX effect. Attribution is absent while the valuation is incomplete; nothing is estimated.

Holding weights in the Lab are shares of the whole portfolio value including cash, so they compare directly with the mix targets. The earlier `allocationBasisPoints` (share of invested value only) is unchanged.

## IPS target intent

[Investiční plán (IPS)](ips.md) can append a target-only mix after explicit confirmation, without executing any trades. Its `ips:<artifact UUID>:<request UUID>` key records the source version; `appliedValueMinor` is zero because no capital was applied. It shares target validation and the learner lock, verifies owned current plan/generation and server instrument metadata, and preserves cash, ledger, capital and returns. The ordinary allocation execution flow remains unchanged.
