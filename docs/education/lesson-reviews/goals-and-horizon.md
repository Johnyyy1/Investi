# 0.1.4 · Cíle a investiční horizont

Issue: [#151](https://github.com/Johnyyy1/Investnik/issues/151). Content and source check: 2026-10-23; owner: curriculum maintainer. No tax calculation or regulatory thresholds are taught here. The retirement paragraph is a signpost to a planned lesson, not publication of its tax rules.

| Brief | Implementation |
| --- | --- |
| Stable identity | `before-investing-goals`, storage `module-before-investing`, `/learn/before-investing/goals-and-horizon` |
| Placement | L0, module 0.1, code 0.1.4, recommended; prerequisite `before-investing-budget`; skill `goals-and-horizon` |
| Outcome | Separate goals by time until spending and firmness; choose availability over equity risk for the fictional near-term purchase; save a goal map or explicitly record no specific goal |
| Inputs | Czech fictional situations, today's Kč, no inflation forecast; simulated 30% loss, no fees/taxes; no historical-return claim |
| Assessment | Four-goal categorization (including exactly 3/7 years), faded example, independent car/Lucie decisions, retrieval, reflection with three criteria |
| Transfer | Existing goal-map artifact pre-fills a new IPS at `/lab/plan`; existing plans are preserved. Backtesting link uses the existing max-drawdown metric and identifies sample-data limitations |
| Compatibility | New lesson only; published-step fixture appended. Old IDs, cursors, timestamps, receipts and Lab prerequisites are unchanged |

## Editorial decisions

The 3/7-year bands are explicitly a teaching rule of thumb, not an authoritative threshold, a suitability assessment or a promise of safety. Firmness, access, losses and costs remain relevant in every band. The stock decline is an invented simulation, not a general claim about historical drawdowns. Recovery is recomputed as `300000 / (300000 × 0.7) − 1`, not a predicted time to recover. A long horizon never guarantees a profit. No broker, branded investment product, personal allocation or tax benefit is recommended.

The lesson uses existing question, worked-example, reflection, summary and figure renderers. The requested `goal-map` is a new lazy figure within the existing frame, composed from shared Input, Select, FinanceInput, Button and ArtifactSaveControl. It does not introduce another step kind or a visual system. The editor reflows into one column on narrow screens. Small shared renderer fixes let long worked-example values and evaluated choice text wrap and make the lesson title's line height scale with enlarged text.

## Sources checked

- [FINRA · Investment Goals](https://www.finra.org/investors/investing/investing-basics/investment-goals): goals, time until spending and separate purposes. FINRA's own horizon groupings are not presented as the lesson's 3/7-year bands.
- [Investor.gov · Asset Allocation and Diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation): time horizon and willingness/ability to lose money affect allocation.
- [Investor.gov · Beginners’ Guide](https://www.investor.gov/additional-resources/general-resources/publications-research/info-sheets/beginners-guide-asset): allocation can change as the goal approaches; there is no universal mix for every goal.

These general educational principles need no new dated numerical fact. The retirement signpost deliberately avoids rates, thresholds, eligibility and withdrawal periods; those remain subject to the fact registry and specialist review in their own lessons.

## Goal-map payload and privacy

Existing `{ goals: [...] }` revisions remain valid, including legacy maps with ten goals. Each goal may now also contain `amountMinor` (canonical integer haléř string) and `targetYear` (bounded integer). New editor entries are capped at five; existing larger maps are retained. Amount is optional, and fictional data is explicitly allowed. No account identifiers are requested. The extension is additive JSONB validation, with no DB migration or rewritten revision.

The alternative `{ goals: [], noSpecificGoal: true }` records a conscious choice without inventing a goal. Both forms require explicit consent and retain the existing owner/session checks, user-row lock, revision history, retry UUID and deletion/export lifecycle. The server checks the current lesson's output when crossing the map step and again at first completion. Another owner's map or another source lesson does not qualify. Deletion after completion never revokes completion or repeats rewards.

Year-based horizons are explicitly approximate: calendar-year difference × 12, with 1 month for a current-year goal. They are not a precise spending-date model; review the map as time passes and refine the horizon in IPS. Legacy months remain unchanged until an explicit edit/save. IPS prefill projects only the existing label/purpose/horizon/priority fields; the new metadata cannot invalidate the independently versioned IPS schema. A no-goal choice leaves the IPS's default blank goal instead of an empty invalid array. Saving a map never overwrites a signed IPS or changes portfolio holdings.

Current main uses reward policy v4 (the issue's original implementation notes describe v3). This lesson preserves v4: L0 awards 60 XP once and zero Practice Capital; no Lab unlock is added. No accounting, trade, fee, reset or disbursement logic changes.

## Reproduce validation

Use an isolated local PostgreSQL instance, with database `investi_artifacts_qa`; never reset the normal development database. Apply the committed migrations and seed. Export `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and deterministic provider settings. Start a fresh production server on port 3151 after building.

```sh
npm run lint
npm run typecheck
npm test
npm run build
ARTIFACTS_QA_DISPOSABLE=1 npm run test:artifacts-persistence
ARTIFACTS_QA_DISPOSABLE=1 npm run test:goals-persistence
npm run test:curriculum-seed
CURRICULUM_QA_DISPOSABLE=1 npm run test:curriculum-compatibility
ARTIFACTS_QA_DISPOSABLE=1 npm run test:goals-browser
```

Browser checks cover wrong answer → explanation → retry, persisted continuation/reload, consent, exact amount save/edit, new IPS prefill, all-version export/deletion, retained completion/receipt, keyboard focus, widths 320/375/390/768/1024/1440 and 200% text. It captures every step at 390 and 1440 px. Physical devices and assistive-technology hardware are outside automated Chromium coverage.
