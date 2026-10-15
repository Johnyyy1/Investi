# Product learning and persistence contracts

This document records current behavior and the historical migration rationale needed to preserve existing learners. The public landing page stays public. Authenticated navigation is Learn, Lab, and Progress; account controls expose Settings. `/dashboard` is a compatibility redirect to `/learn`. Active lessons omit the ordinary app shell.

## Learning continuity and completion

The learner summary selects the latest active published lesson, then incomplete learning in the last completed module, then the recommended module, then curriculum order. Ties use curriculum order; unknown/unpublished progress is ignored. The current Learn recommendation also uses the personalization engine, with a link back to a different active lesson. Completion uses the shared continuity result and sends a fully completed learner to Lab.

Twelve lessons are published: seven Foundations and five Returns. Checkpoints remain planned. [Foundations](investing-foundations.md), [Returns](returns.md), and [onboarding](onboarding.md) describe their current contracts.

Clients send only lesson identity, cursor, and answer IDs. The server derives the owner from the session, bounds cursor moves to one forward authored step, and requires a correct evaluated answer when crossing a question. Completion requires the final persisted step. Attempts and explorer inputs remain ephemeral; cursor and completion persist. Reviewed completed lessons do not mutate their receipt, cursor, or original completion timestamp.

The completion transaction locks the user row, preserves an existing completion time, and inserts at most one lifetime `(user_id, lesson_id)` receipt. Award failure rolls back completion. Refresh, retry, review, and concurrent calls cannot repeat an award. Internal first-completion XP remains 60; the client cannot choose the amount.

## Current reward policy and historical rationale

The committed application uses policy v2: new lesson receipts contain **zero Practice Capital**. Completing all seven Foundations and reaching 420 internal XP creates one Portfolio Lab entitlement with **500000 CZK minor units (5,000 Kč)**. Stored entitlements grandfather existing access. Anonymous demos receive one `demo_access` grant with the same amount, independently of lesson prerequisites. Neither repeated completion nor reset repeats a grant.

Practice Capital is the sum of authoritative stored lesson receipts **and unlock grants**. Historical v1 lesson receipts retain their original 200000 minor units (2,000 Kč each); their amount is never recalculated from XP. There is no mutable balance counter. These are virtual educational funds, not withdrawable money.

Some repository agent instructions still describe v1 as the current approved reward policy. This hygiene audit preserves committed runtime/tests and records that discrepancy for a separately authorized product-policy decision.

Historical migrations remain necessary:

- `0003` backfills missing 60-XP receipts for actual completed published lessons, preserving stored completion/update time and using UTC where no historical timezone exists. Composite receipt identity makes reruns idempotent.
- `0004` expands receipts with Practice Capital fields, reconciles missing eligible receipts, backfills v1 amounts, then adds non-null/value checks.
- `0006` adds the persistent unlock ledger; migration code preserves legacy access and original capital.
- `0008` permits nonnegative receipt capital for v2 without rewriting historical receipts.

All migrations and metadata are retained. Apply the entire committed chain before running the app, then run the idempotent curriculum seed; do not rewrite old migrations or reset user progress.

## Streak and daily lesson goal

`learning_date` is the learner's local date at first completion. Multiple first completions on a day count once for streak, separately for that day's lesson target. A run ending today is active; a run ending yesterday remains active through today; earlier gaps reset the active streak. Reviews create no learning day and there are no freezes.

A validated IANA timezone is pinned on the profile; demo history uses UTC. Historical backfill uses UTC because prior timezone is unknown. Minutes map to a lesson target (5/10 → one, 15/20 → two, 30 → three, missing → one); this is a preference, not measured time-on-task.

## Demo identity and operations

Better Auth creates an isolated anonymous user/session. Server initialization verifies anonymous ownership and transactionally seeds a deterministic profile, six completed lessons with matching v2 receipts, and one in-progress lesson. Repeated/concurrent initialization is safe; rollback permits retry. Existing demo mutations are not overwritten on subsequent visits.

The seed derives 360 XP and a four-day streak from its rows. Its receipts grant zero capital under current policy; the independent one-time demo entitlement grants access and 5,000 Kč. Browser/device identity flags cannot authorize a normal account.

A demo is one-time: its session ends 24 hours after it started, because the session update hook caps every Better Auth refresh at that end (`demoSessionExpiry`); a demo extended before this cap ends on its next request. Guest sessions last seven days and extend while used. `test:demo-session` covers both against a running server. Retention follows sessions, not age: an anonymous identity is removed, with its cascading user-owned data, once it has had no valid session for over a day. A daily Vercel Cron job runs this through `/api/cron/cleanup-anonymous` (protected by `CRON_SECRET`); `demo:cleanup` is the same rule as a dry run, and `demo:cleanup -- --apply` applies it. `test:anonymous-cleanup` covers the rule, cascades, skipped row locks, batching and concurrent runs.

## Labs

[Portfolio Lab](portfolio-lab.md) is a persistent CZK paper portfolio: append-only trades, exact arithmetic, retained reset generations, server-derived execution, and explicit unavailable valuations. Contributions never become investment gain. The pure stocks/bonds/cash allocation exercise remains used by the lesson builder and Backtesting Lab; it is not an abandoned personal-portfolio implementation.

Backtesting Lab compounds a frozen mix of synthetic monthly simple returns over inclusive calendar years. CAGR uses monthly intervals divided by 12. Annualized volatility uses sample standard deviation (`n−1`) multiplied by `√12`. Maximum drawdown includes the initial value and month-end peaks. It supports −100% returns but rejects lower, non-finite, missing, duplicate, unordered, incomplete-month, and overflowing inputs.

The Jan 2015–Dec 2025 fixture is invented educational data. The UI labels it synthetic/demo, exposes a textual monthly-value table, and assumes monthly rebalancing without costs, tax, inflation, cash flows, or FX. It does not backtest the learner's transaction history.

## Validation and limits

Run the static gates plus persistence, reward migration, progression, portfolio, log-return, and curriculum-seed suites. Browser scripts cover production flows and development-only design previews under their appropriate runtimes. [Environment settings](environment.md) describes guarded disposable QA.

Safari, Firefox, physical devices, and screen-reader hardware remain outside automated Chromium coverage. Lessons persist position/completion rather than explorer answers. Demo cleanup is an operator command. Sample and live providers retain different provenance; neither missing quotes nor FX become zero.
