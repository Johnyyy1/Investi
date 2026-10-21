# Investiční plán (IPS)

Issue #128 extends the versioned learner artifacts from #127. **Lab → Můj investiční plán** (`/lab/plan`) works before Portfolio Lab unlock. The learner writes their own goals, readiness categories, allocation, instruments and platform, planned monthly CZK contribution, rebalancing rule, drawdown action/safeguard, check frequency and review month. The builder offers no recommended allocation. A saved goal map supplies editable initial goals; editing these does not overwrite the goal map.

## Payload and compatibility

The existing database enum kind is **`investment_plan`**, not `ips`. It stays unchanged. `artifactPayloadSchemas.investment_plan` accepts both the exact original #127 shape and the extended **`schemaVersion: 2`** shape in `src/features/ips/schema.ts`. Artifact `version` counts edits and is independent of payload schema version. No migration, backfill or new table is required. Original rows, revision numbers, timestamps and source lesson attribution remain intact.

The v2 payload contains `goals[]`, `foundation {emergencyFund, highCostDebt}`, `allocation {lines[], cashBps}`, `instruments[]`, `platform`, `contribution {amountMinor, dayOfMonth}`, discriminated `rebalancing`, `drawdownRule {action, text}`, `checkFrequency`, `reviewMonth`, `changeReason` and `signedAt`. The acknowledgement timestamp is learner-declared at confirmation; `createdAt` is the authoritative server save time. Neither is evidence for an award, milestone, crisis exercise or lesson completion.

Allocation lines describe either distinct asset classes or distinct stable instrument IDs. Mixing those representations is rejected to avoid ambiguous/double-counted exposure. All weights use integer basis points and sum to exactly 10,000 including cash. A cash-only IPS is valid. No automatic asset-class-to-instrument mapping exists. Rebalancing is calendar (month 1–12), band (positive integer bps) or contributions. This records a rule; it does not monitor a band or schedule any trades. Contribution days are explicitly limited to 1–28 so every month contains the chosen day.

Money is a canonical nonnegative integer minor-unit **string**, with at most 15 digits. The CZK editor parses comma/dot decimal text with bigint; 0.1 becomes `"10"`, 0.25 becomes `"25"`, and 1.3333 is rejected rather than silently rounded. Planned contributions are never deposits or a source of Lab capital. Readiness stays categorical; income, debt amounts, reserve amounts and account identifiers have no fields.

The original payload remains readable in history and export. Opening it pre-fills its goals, allocation, check frequency and crisis text. Newly required fields remain for the learner to supply; saving appends a v2 revision. The original rebalance text remains in its historical snapshot rather than being guessed into a structured rule.

## Persistence and controls

The builder shares the #127 server-validated save/delete operations, explicit unchecked consent, request UUID and user-row lock. Each changed draft creates a fresh request; retrying the same draft reuses its payload, acknowledgement time and request ID. An edit after a successful save clears the previous change rationale. Versions include a full readable snapshot and the stated rationale. A draft remains local until saving; leaving/reloading the page loses unsaved edits.

The dedicated `/api/ips/export` attachment includes all owned plan versions, including legacy shapes, without owner/request keys, with `Cache-Control: no-store`. Account export also includes every revision through the existing generic contract. Deletion removes all plan revisions; account and demo deletion cascade through the existing table. Guests cannot save, read history, export or apply plans; the page directs them to save an account. Isolated demo identities can practice normally.

## Target-mix handoff

The old `savePortfolioAllocationAction` **executes trades**. An IPS handoff must not call it. `applyIpsTargetAction` therefore uses a separate target-only operation with the same pure `validateAllocation`, existing allocation tables, append-only semantics and shared learner lock. It checks the session, recorded Lab unlock and market-data request budget. The repository re-reads the current owned IPS and active owned portfolio generation under the lock. The request contains only an artifact ID, expected generation ID and retry UUID; it cannot supply weights, prices, FX, fees, capital or quantities.

Only a v2 IPS with concrete supported instruments can become a Lab mix. Metadata resolves through `MarketDataService`; authoritative identities, instrument types and currencies are checked. Closed markets and missing prices do not prevent saving an intent. Class-only and cash-only plans remain valid IPS documents, but need concrete instrument lines for the existing Lab target contract. The page explains this limitation; it never invents a mapping or a trade.

The operation appends `portfolio_allocation` / `portfolio_allocation_line` only. Its key `ips:<artifact UUID>:<request UUID>` records source provenance and cannot collide with the UUID-only action that executes a mix. A retry is checked against the source ID and exact target. `appliedValueMinor = 0` explicitly means **no capital was applied**, not a portfolio valuation. Target ordering is monotonic under the user lock. A stale/deleted IPS, foreign artifact, changed generation or changed input under the same request is rejected. Reset retains old target mixes and trades and never applies a stale handoff to the new generation.

The latest saved mix remains the generation's target. Deleting the IPS does not delete this independent Lab audit record. The handoff never changes trades, cash, contributed capital, holdings, fees, FX, P&L, learning receipts, XP, streaks or recorded access. It provides no funding, reward, recommendation or automatic rebalance. Drift/band monitoring and contribution rebalancing remain #144; #144 is downstream of #128.

## Validation

Run the static gates and `npm run test:ips-persistence`, `npm run test:artifacts-persistence`, `npm run test:portfolio-allocation`, `npm run test:portfolio-persistence`, `npm run test:progression-persistence` and `npm run test:persistence` against a dedicated loopback PostgreSQL database named `investi_artifacts_qa`. The new IPS suite requires `IPS_QA_DISPOSABLE=1` and deterministic providers; artifact tests require `ARTIFACTS_QA_DISPOSABLE=1`. Never point these at the development database.

On a fresh production runtime using that same disposable database, run `IPS_QA_DISPOSABLE=1 IPS_TEST_URL=http://localhost:<port> npm run test:ips-browser`. It covers the complete real action flow, pre-unlock planning, keyboard search and consent, inline search failure recovery, save retry, refresh, precise decimals, rationale/version history, target-only handoff, exports, delete/cancel/focus, guest restrictions, 320/375/390/768/1024/1440px reflow and 200% text. Screenshots are written to ignored `test-results/ips/`. Browser automation uses Chromium; physical devices and screen-reader hardware are outside this coverage.
