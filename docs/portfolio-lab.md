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

Buy, sell, reset, and lesson completion lock the learner’s `user` row. Under that lock a trade re-reads receipt entitlement, active-generation trades, cash, and quantities. This serializes competing buys, competing sells, and reward/trade races. Client input is limited to instrument identity, quantity, and an idempotency key; execution price, FX, cash effects, and performance are server-derived.

## Target mixes

A mix ("Uložit portfolio") is the learner's intent: integer basis-point weights for up to 12 instruments (equities, ETFs, bonds) plus a cash weight, summing to exactly 10 000. It is stored append-only in `portfolio_allocation` and `portfolio_allocation_line`, scoped to a generation; the latest version is the current target, older versions stay for audit, and a reset leaves the old generation's mixes with it. A mix holds no money: `applied_value_minor` is an audit snapshot of the value the weights were applied to and is never read back as a balance.

Executing a mix produces ordinary ledger trades. Under the same learner-row lock as trades, resets and rewards, the server re-reads receipts and trades, takes one fresh execution observation per instrument the mix touches (every target line and every current holding; a holding outside the mix has a 0 % target and is sold in full), and plans:

```text
total          = cash + Σ holding value at the execution observations
target_i       = floor(total × weight_i / 10 000)
sells first    : surplus value → quantity floored to 8 dp (a 0 % target sells everything)
buys after     : min(shortfall, cash still available) → quantity floored to 8 dp
```

Each executed value is therefore at most its target, cash never goes negative, and every rounding remainder stays as cash. Differences under 1 Kč are not traded. The client sends only instrument identities, integer weights and an idempotency key; trades use derived keys `allocation:<key>:<n>`. If any involved quote is not usable for execution (market closed, stale, unavailable, other provider), nothing is written. `reviewAllocation` runs the same plan without writing, as an estimate for the review step.

## Price and FX attribution

The investment gain/loss is split read-only, from the ledger and the same observations as the valuation:

```text
unrealized    = market value − cost basis
price effect  = round(cost basis × current quote-currency value / cost in quote currency) − cost basis
FX effect     = unrealized − price effect
gain/loss     = Σ price effect + Σ FX effect + realized gain/loss of sells
```

Cost in quote currency is folded with the same weighted-average allocation as the CZK cost basis, so the implied purchase rate is the weighted average actually paid. The parts sum exactly to the investment gain/loss. CZK-quoted holdings have no FX effect. Attribution is absent while the valuation is incomplete; nothing is estimated.

Holding weights in the Lab are shares of the whole portfolio value including cash, so they compare directly with the mix targets. The earlier `allocationBasisPoints` (share of invested value only) is unchanged.
