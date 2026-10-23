# Krizový nácvik (simulated time)

Issue #139. **Lab → Krizový nácvik** (`/lab/training`) lets a learner step through a crisis month by month with fictional training money and check whether they keep their own IPS (#128). It is the shared engine for lessons 2.5.2, 2.5.4, B.1.1, B.1.2, B.1.10 and Capstone A; wiring those lessons to it is separate work.

## Isolation

Training never reads or writes the persistent portfolio, its trades, Practice Capital, reward receipts or unlocks. Every session starts with a fixed 100 000 Kč (`TRAINING_INITIAL_CAPITAL_MINOR`) of training money. Training earns no XP or Practice Capital. It does not require the Portfolio Lab unlock, but it requires a saved v2 IPS. Guests are sent to save an account; isolated demo identities can practice.

## Scenarios and data

- `model-crisis-v1`: an exact, hand-written index path: −30 % over six months, back to 100 after ten more, then a slow rise (24 months). Labelled "Modelový scénář". Its calendar starts in January 2000 only to fix month lengths for MWR/TWR and the calendar rebalancing month.
- `history-2008-v1`, `history-2020-v1`, `history-2022-v1`: 24 month-end closes of the Backtesting plan instrument (SPY on FMP, the SPX sample on the deterministic provider) through `MarketDataService`, with the same split-adjusted request as Backtesting Lab. Closes are rebased to an index of 100 in CZK: **price return without dividends and without the CZK/USD rate**. A scenario is offered only when the provider plan covers its whole window, so the deterministic provider has no 2008 scenario. A missing month-end close refuses the start with the month named (`alignMonthlyCloses`); nothing is filled.

The series (dates and 8 dp index prices) and its provenance are frozen in `training_session.series` at the start, so a replay never depends on later provider data or cache contents.

## Persistence and replay

`training_session` stores the scenario, the frozen series, a snapshot of the structured IPS rules (`TrainingPlan`: version, contribution, invested target = 100 % − IPS cash target, rebalancing, drawdown action; never the learner's free text), the fee profile id and the starting capital. `training_action` is append-only: `(sequence, month, kind, amountMinor | quantity, clientIdempotencyKey)`. There is no stored balance.

`replayTraining` derives cash, holdings, contributions and trades from the session and its ordered actions. The client sends only a choice: a buy amount in haléře, a sell quantity, or "advance", plus the month it saw and a UUID. The server locks the session row, answers a repeated key from the log (a changed payload under the same key is refused), refuses a stale month, replays and validates the new action, then appends it. Concurrent requests serialize on the row lock; `(session_id, sequence)` is the primary key.

- Advancing to the next month adds the IPS contribution to cash. Contributions are external flows, never returns.
- A buy floors to whole 8 dp units so the gross never exceeds the chosen amount; the fee from the learner's broker fee profile (#136) is added and must fit in cash. The index is quoted in CZK, so there is no FX markup.
- A sell cannot exceed the held quantity or be smaller than its fee.

## Evaluation

Shown after the last month. Process first, no composite score:

- **Prodeje mimo pravidla**: a sell is within the plan only if it brings an overweight index back: band mode, the invested share before the sell is above target + band; calendar mode, it is the plan's rebalancing month and the share is above target; contributions mode, every sell is outside the plan.
- **Podíl v indexu** at the end against the IPS target, with in/out of band for band plans.
- **Náklady** (fees), **obrat** (traded gross / ending value, the Portfolio Lab process convention) and the trade count.
- **TWR and MWR** from `src/features/portfolio/performance.ts` (#138) over the month-end dates, with the start capital and every contribution as flows.
- The index's largest drawdown in the period, final value against the amount contributed.

Dividends, taxes and interest on cash are not modelled.

## Lifecycle

Both tables cascade with the user. Deleting an IPS revision keeps the session and its snapshot (`ips_artifact_id` is set to null). Account export includes every session with its actions, without owner and request keys.
