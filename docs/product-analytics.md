# Product analytics: funnel to milestone A

Issue #355 adds the minimal measurement the S1 stage gate needs: how many people move from the landing page to their first learning and back again, and where they stop. It is a precursor to the learning-outcome measurement in #130, not a replacement. There is no third-party analytics tool, script, cookie or pixel. Everything stays in our own database, and the report contains aggregate counts only.

## Funnel

| Step | Source | New data? |
| --- | --- | --- |
| Landing-page view | `analytics_landing_view_day`: one counter per Europe/Prague calendar day | yes, no identifier |
| New account or guest | `user.created_at` for saved accounts and guests; demo identities are excluded | no |
| Diagnostic | `learning_profile.personalized_onboarding_completed_at` where a diagnostic result exists | no |
| First completed lesson | earliest `lesson_award.awarded_at` (the append-only completion receipt) | no |
| First lesson output | earliest `learner_artifact.created_at` | no |
| Milestone A | none yet: reported as **unavailable** until #126 records milestone completion | — |
| First Lab mission | none yet: reported as **unavailable** until guided missions (#142) exist | — |
| Return within 7 days | `analytics_early_return`: the first app visit on calendar days 1–7 after the start | yes, one row per learner |

The first Lab trade (`portfolio_trade.executed_at`) is printed as separate context until missions exist. It is not a stand-in for the mission step.

### Counting rules

- **Cohorts.** The 7-day and 30-day funnels take learners who started on the last 7 or 30 Prague calendar days, today included, and count every step each of them has reached by now. Weekly cohorts group learners by the Monday of their start week.
- **Steps are not strictly ordered.** The diagnostic can be skipped, so each step counts everyone who reached it. "Z předchozího" is the share of learners at the previous available step who also reached this step; "Ze startu" divides by the cohort size. Unavailable steps are never counted as zero and are skipped as a base.
- **Views are not people.** The start step's conversion from landing-page views compares learners with page loads, and the report says so.
- **Returns need a closed window.** A learner still within their seven days may yet return, so the return share is divided only by learners whose window has closed or who have already returned. The report shows how many are still in the window.
- **Lesson drop-off** lists every published lesson in Curriculum 2.0 display order, across all current learners: opened (a `lesson_progress` row), completed, **abandoned** (opened, not completed, unchanged for 7 days) and **stopped after** (this is the learner's latest completed lesson and nothing has been completed for 7 days). Lessons with data but no curriculum placement are listed last.
- **Deleted data stays deleted.** The report reads current rows. Deleted accounts and cleaned-up guests or demos drop out of all historical counts. A claimed guest's learning moves to the account, which counts from the account's creation time.

## Recording

- **Landing views.** `LandingViewBeacon` on the marketing page sends one bodyless `navigator.sendBeacon` to `POST /api/analytics/visit` per page load. No cookie or browser storage is used. Browsers sending Global Privacy Control or Do Not Track are not counted. The route ignores cross-site requests and limits counting to 30 per IP per hour (an HMAC'd rate-limit bucket, `LANDING_VIEW_IP_RULE`). It always returns an empty `204`, and failures are logged without details. Bots that do not run JavaScript are not counted, but bots that do run it can be. Treat views as an approximation.
- **Early returns.** The authenticated app layout calls `recordEarlyReturn` through `after()` for accounts and guests, only on Prague calendar days 1–7 after `user.created_at`. The insert is `on conflict do nothing`, so the first return wins and the table holds at most one row per learner. The row cascades with the user, is part of the account export (`productMeasurement.earlyReturnAt`) and is described in the privacy policy.

Migration `0018_product_funnel` only adds the two tables. It changes no existing rows, rewards, progress or Lab state.

## Report

```sh
DATABASE_URL=… npm run analytics:funnel            # text tables
DATABASE_URL=… npm run analytics:funnel -- --json  # the same report as JSON
DATABASE_URL=… npm run analytics:funnel -- --weeks=12
```

The script only reads. User IDs serve as opaque keys inside the computation and never appear in either output format. There is deliberately no in-app dashboard: the product has no admin role, and an authenticated internal page would need its own access design.

## Code

- `src/features/analytics/funnel.ts`: pure step, cohort and drop-off rules, plus the Prague calendar helpers.
- `src/features/analytics/report.ts`: report assembly and text formatting.
- `src/features/analytics/repository.ts`: the two writes and the single read of existing records.
- `scripts/report-funnel.mts`: the CLI.

## Validation

Unit tests cover calendar edges (midnight, day 7/8, the end of daylight saving time), cohort windows, unavailable steps, conversions, pending returns, weekly cohorts, lesson order and drop-off, the route's same-origin check, rate limit and failure handling, the beacon's privacy signals, and the absence of learner keys in the output.

`FUNNEL_QA_DISPOSABLE=1 npm run test:product-analytics` requires an explicit local database named `investi_funnel_qa`. It checks that the migration is additive and reruns cleanly, that concurrent and repeated early returns produce one row, that nothing is recorded outside days 1–7, that concurrent landing views lose no updates and fall on the Prague day, that demo identities are excluded, that the report prints no identifier, and that account deletion cascades. `test:account-deletion` also covers the export and cascade of the early-return row.
