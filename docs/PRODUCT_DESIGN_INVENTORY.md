# investi — Product and UI inventory for design migration

Inventory date: **8 October 2026**. Repository baseline: **`main`, `107248f`** (`fix: compact progress page layout`). The working tree was clean at the start of inspection.

This is a functional handoff for Sol's authenticated-product design work in Pen. It records the existing product; it does not authorize a redesign of its behavior, new routes, or new features. Application code, database contents, migrations, and provider configuration were not changed during this inventory. The only requested deliverable is this document.

## Evidence and reading conventions

- **Implemented** means verified in application source, with tests referenced where relevant. It does not mean verified against a deployed service.
- **Planned** means explicitly marked unavailable in the curriculum, documentation, or implementation.
- **Not implemented in the inspected product** means no route or connected user flow was found. A dependency's generic capability is not a product feature.
- **Unverified** marks deployment, data availability, browser rendering, or external-design facts that this inspection cannot establish.
- File paths are repository-relative. Symbols identify the behavior to preserve. Source and current tests take precedence over historical prose when describing what the application does today; policy conflicts are recorded, not resolved here.

Inspection covered `src/app`, `src/components`, `src/features`, `src/lib`, `src/db/schema.ts`, `src/db/seed.ts`, SQL migrations `drizzle/0000`–`0009`, repository docs, package/config files, and relevant unit/browser/persistence test definitions. Bundled Next.js guidance for pages, layouts, and loading boundaries was consulted under `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/`.

**Runtime limits:** no authenticated browser session or database harness was run. Visiting the authenticated application is not necessarily read-only: layout access can record unlocks, first portfolio access can create a generation, and the shell can initialize a timezone. Existing browser and database suites also create or mutate accounts. Responsive and accessibility observations below describe source behavior and available test coverage, not newly performed visual acceptance. Actual production migrations, OAuth consent/token exchange, provider entitlements, active environment selection, and the Pen V14.1 file were not verified. No Pen artifact was supplied or inspected.

## 1. Route and screen matrix

### Shared route behavior

There are **17 `page.tsx` entrypoints**, including two dynamic page templates and two development previews, and **one catch-all API route**. Route-group names `(app)`, `(auth)`, and `(marketing)` are filesystem organization, not URL segments.

| Code / layout | Responsibility and dependencies |
| --- | --- |
| `src/app/layout.tsx`, `RootLayout` | Every route: Czech document language, title template, mobile viewport/safe-area configuration, global CSS, and `LearningTheme`. |
| `src/components/learning/learning-theme.tsx`, `LearningTheme` | Nunito Sans and KaTeX CSS; shared product colors/focus/reduced-motion styling. Also wraps marketing. |
| `src/app/(app)/layout.tsx`, `ApplicationLayout` | Reads session; redirects unauthenticated users to `/sign-in`; redirects new users without onboarding/history to `/onboarding`; loads Portfolio Lab entitlement; renders `AppShell`. These guards still apply to focused lessons. |
| `src/components/app-shell.tsx`, `AppShell` | Sticky header, account menu, Learn/Lab/Progress navigation, mobile bottom navigation. Returns lesson children without the visible shell for exact available-lesson paths. It can initialize a missing profile timezone. |
| `src/app/(app)/loading.tsx` | Shared authenticated-page skeleton with status text and motion-safe pulse. No separate lab, settings, module, progress, or lesson loading files. It does not cover the same layout's own session/profile/unlock work. |
| `src/app/onboarding/loading.tsx` | Simple preference-loading status for onboarding subtree. |
| `src/app/error.tsx`, `src/app/not-found.tsx` | Shared page-failure/retry and unavailable-page/back-to-Learn UI. These are boundary states, not independently addressable routes. No route-specific error files or `global-error.tsx` found. Root-layout failures are not covered by a child error boundary. |
| `src/app/(marketing)/layout.tsx` | Marketing-scoped CSS and Nunito 800 display font; does not provide the authenticated shell. |

In the matrices, **App** means Root + ApplicationLayout/AppShell, including auth/onboarding guards and the shared loading boundary. **Focused lesson** keeps those server guards but bypasses visible AppShell navigation. **Root** means the common theme only. **E** means the shared error boundary; **N** means unavailable-page handling. A missing empty state is not a missing screen requirement if the screen is a form or redirect.

### Public, authentication, and onboarding screens

| Actual route / source | Main components; user purpose and actions | Authentication / redirects | Loading, empty, error states | Layout and existing responsive behavior |
| --- | --- | --- | --- | --- |
| `/` — `src/app/(marketing)/page.tsx` | `MarketingHeader`, `Hero`, `JourneyIntro`, `ProductShowcases`, `FinalCta`, `MarketingFooter`. Learn about investi; navigate to auth/product, start demo through connected demo CTAs. | Public; product links encounter app guards. No authenticated redirect at this page. | Demo CTA pending/error where rendered; E; no catalog-empty state. | Root + MarketingLayout. Marketing CSS has separate navigation and stacked mobile sections. Showcase illustrations are marketing demonstrations, not authenticated screens. V14.1 parity is unverified. |
| `/sign-in` — `src/app/(auth)/sign-in/page.tsx` | `AuthLayout`, `SocialSignIn`, `SignInForm`, `DemoButton`. Email/password login, available Google/Facebook login, demo, registration, home. | Public; an existing session redirects to `/learn` (including anonymous demo sessions). Success enters `/learn`, whose layout can require onboarding. | Submitting and network/API alerts; OAuth `?error=` allowlisted message; unavailable providers are hidden; E. No dedicated route skeleton. | Root + component-level AuthLayout, no auth group layout. Single column, max 496px, 20px gutters/32px at `sm`, viewport-height centering. |
| `/sign-up` — `src/app/(auth)/sign-up/page.tsx` | `SignUpForm`, same auth primitives. Enter name/email/password; social registration/login; demo; sign-in/home links. | Public; existing session → `/learn`. Email success → `/onboarding`; social success → `/learn` then server gate. | Submitting, validation/network/API alerts, provider-hidden and OAuth-return errors; E. | Same auth layout/reflow as sign-in. |
| `/onboarding` — `src/app/onboarding/page.tsx` | `PersonalizationFlow`, `PreferenceFields`, `AnswerOption`. Goal → interests → experience → session length → diagnostic introduction/five questions; Previous, Continue, skip. | Session required. Personalized users normally → `/learn`; `?personalize=1` → plan for already-personalized users. `?retake=1` starts diagnostic-only mode if personalized. Legacy history bypasses initial gate; optional personalization still available. | Route/client draft-loading status; required-goal/unanswered-question disabled action; pending submit; preserved draft and save/network/session error; E. | Root; no normal shell. Max 2xl, full-height, narrow gutters. Actions stack below 420px. User/mode-scoped sessionStorage draft recovery. |
| `/onboarding/plan` — `src/app/onboarding/plan/page.tsx` | `Recommendation`, saved goal/tempo summary. Start recommended lesson; view all Learn. Labeled step 6 of 6. | Session required; no onboarding completion marker → `/onboarding`. Plan itself does not require a stored diagnostic. | Shared onboarding loading/E; default labels for missing preferences; recommendation complete/unavailable variants. | Root; no normal shell. Max 2xl, wrapping copy/actions, single column. |

### Authenticated product screens

| Actual route / source | Main components; user purpose and actions | Authentication / availability | Loading, empty, error states | Layout and existing responsive behavior |
| --- | --- | --- | --- | --- |
| `/dashboard` — `src/app/(app)/dashboard/page.tsx` | `DashboardPage` redirects to `/learn`. **No separate dashboard UI.** | App guards precede redirected destination. | Shared App loading/E; no independent screen states. | App route, then Learn. Do not design an additional dashboard as an existing feature. |
| `/learn` — `src/app/(app)/learn/page.tsx` | `LearnerGreeting`, `LearningStats`, `Recommendation`, `PersonalizationPrompt`, `JourneyOverview`. Choose next learning action, resume link when it differs from recommendation, inspect curriculum/modules, open labs, personalize/dismiss prompt. | App. Recommendations do not confer access. | New learner (zero completions), active lesson, partial progress, all-available-complete, unavailable recommendation, personalization prompt/dismissed; App loading/E. | `PageFrame` standard. Header/stats wrap; CTAs fill mobile width. Journey is horizontal above 1100px, vertical at ≤1100px. Journey nodes are status displays; module links lead to actionable lesson lists. |
| `/learn/[moduleSlug]` — `src/app/(app)/learn/[moduleSlug]/page.tsx` | `ModuleOverview`, `ModulePath`, `LearningProgressBar`. Read module purpose/progress; start, resume, or review any available lesson; return to Learn. Foundations additionally displays XP/Lab unlock state. | App; only `investing-foundations` and `returns` currently render; unknown/planned module → N. No sequential lesson-access lock. | Not started/recommended, active, completed/review, module complete; planned checkpoint behavior varies by module (below); App loading/E/N. | Focused-width `PageFrame` **inside** shell. Vertical path, wrapped copy/actions; unlock details two columns at 420px. |
| `/learn/[moduleSlug]/[lessonSlug]` — `src/app/(app)/learn/[moduleSlug]/[lessonSlug]/page.tsx` | `GuidedLesson`, `LessonProgress`, `GuidedBlock`, `GuidedQuestion`, explorers, `CompletionScreen`. Read/interact/check/retry/save Continue/Previous; explicitly finish; next lesson, Lab on completion, or return to Learn/module. | Session + onboarding guard. `getAuthoredLesson` must resolve a registered lesson or N. No Foundations prerequisite guard for direct Returns URLs. | Started/resumed/review, unanswered/invalid, correct/incorrect feedback, saving/save failed, final step, completed/review completed, XP award, newly unlocked Lab; App loading/E/N. Completion is an in-place state at the **same URL**. | Focused lesson; no normal header/account/bottom nav. Max 4xl; mobile 12px then 20px gutters; small navigation stacks below 420px; explorer grids reflow at sm/md. |
| `/progress` — `src/app/(app)/progress/page.tsx` | `ProgressOverview`, `weeklyActivity`, `Progress`, `Surface`, stats. View XP/unlock progress, completed lessons, streak, virtual capital, daily goal, latest completed lesson, current calendar week; continue, review, module links, unlock conditions, explanation disclosure. | App. Stored/grandfathered/demo unlock can be true independently of displayed XP threshold. | Zero/partial/complete progress, XP threshold without prerequisites, locked/unlocked, empty recent lesson, empty week; App loading/E. | Wide `PageFrame`; CSS container queries at 22/40/56/60rem. Stats 1→2→4 columns; daily goal precedes journey on narrow layouts; sidebar emerges on wide layouts; special reflow below 20rem. |
| `/lab` — `src/app/(app)/lab/page.tsx` | `AppHeader`, links and an illustrative allocation graphic. Choose Portfolio Lab or Backtesting Lab; inspect portfolio unlock conditions. | App. Portfolio CTA varies by entitlement; Backtesting is not gated by Portfolio unlock. | Locked/unlocked Portfolio entry; App loading/E. No saved-lab list/empty-results state. | Standard PageFrame. Portfolio intro becomes two columns at sm; Backtesting remains a text/link section. 60/30/10 graphic is decorative and not this user's holdings. |
| `/lab/portfolio` — `src/app/(app)/lab/portfolio/page.tsx` | `PortfolioLab` or `LockedPortfolioLab`; internal `PortfolioHero`, `HoldingsList`, `ActivityList`, `SearchStep`, dialogs. Inspect value/cash/holdings/P&L; Invest/search/detail navigation; sell; reset; return to Lab. | App + `loadPortfolioLabUnlock`. Locked response renders before portfolio loading. Mutations independently require session/unlock. | Locked, zero capital, capital with no holdings, funded/holdings, incomplete valuation, unavailable holding, closed/stale quote, search states, trade/reset pending/error/success, performance-history placeholder; App loading/E. | Wide PageFrame with 80rem override. Hero splits at lg; desktop table at lg, structured mobile list below; full-width header actions on mobile. Search/sell dialogs are full-height full-width sheets, capped/right-aligned at sm; reset centered. |
| `/lab/instruments/[instrumentId]` — `src/app/(app)/lab/instruments/[instrumentId]/page.tsx` | `InstrumentDetailView`, `InstrumentPriceChart`, `EquityKeyMetrics` or `EtfAnalytics`, `BuyReview`, order dialog. Explore instrument/quote/history, select `?range=`, line/candles/zoom/data, help disclosures, own position, buy more/sell. | App + same Portfolio entitlement. `resolveInstrumentRouteParam` rejects malformed identity → N. Well-formed unavailable instrument renders a warning screen rather than necessarily a 404. | Quote/history/fundamentals/ETF datasets fail independently; missing/partial/single-point history, disabled candles, market states, own position/no position, preview loading/error, order/review/execution pending/error/success; App loading/E/N. | 80rem override; responsive chart heights; controls wrap; metrics/fund sections reflow; order sheet same responsive pattern as portfolio search. |
| `/lab/backtesting` — `src/app/(app)/lab/backtesting/page.tsx` | `BacktestingLab`, lazy `BacktestChart`. Choose fixed sample strategy/year range/initial amount, run, compare four metrics/growth with stock benchmark, expand data/methodology, answer metric question, return to Lab. | App only; no XP/module/Portfolio unlock requirement. | Pre-run introduction, invalid input, result, dirty-input warning, chart-loading status, checked correct/incorrect educational answer; App loading/E. | Wide PageFrame. Form 1→2→4 columns; date controls split from 375px; metrics 1→2→4; chart 256px→320px; fixed-layout accessible value table. |
| `/settings` — `src/app/(app)/settings/page.tsx` | `PersonalizationEditor`, `PreferenceFields`, `AccountSecurity`. Edit goal/interests/experience/tempo; save; optional personalization/diagnostic retake; view credential/social methods; connect/disconnect social accounts. | App plus explicit session/onboarding check. No profile-identity/password-management form here. | Save pending/success/error with attempted inputs retained; diagnostic absent/present; account load/pending/error, connected/disconnected/provider unavailable; OAuth `?error=`; App loading/E. | Reading PageFrame; stacked field groups; full-width small-screen save action; account rows split at 420px. Account menu provides sign-out elsewhere in shell. |

### Utility routes and absent screens

| Actual route / file | Scope, states, actions, and layout |
| --- | --- |
| `/dev/design-system` — `src/app/dev/design-system/page.tsx` | Development only (`NODE_ENV === development`), public preview with `DesignSystemShowcase`, illustrative controls/rewards/achievements/shell. Root + explicit LearningTheme. No app auth guard. Responsive showcase; production calls `notFound()`. No learner persistence implied by preview controls. |
| `/dev/etf-analytics` — `src/app/dev/etf-analytics/page.tsx` | Development only, public deterministic ETF preview. `?state=partial` removes country dataset; `?state=failure` removes snapshot. Root + PageFrame/EtfAnalytics; production N. Preview is not a separate product analytics destination. |
| `/api/auth/[...all]` — `src/app/api/auth/[...all]/route.ts` | Better Auth GET/POST handler via `toNextJsHandler(auth)`. Includes configured login/session/social/anonymous/account operations; it is an API, not a screen. Auth callbacks are handled here, not separate App Router pages. |

**No product route or connected screen found** for forgot/reset password, email verification/resend, password change, MFA, session-device management, user deletion, profile name/avatar editing, billing, scenario/challenge catalog, saved backtests, multiple named portfolios, transaction-history browser/export, course certificates, leaderboard, or an editorial CMS. The verification DB table and generic Better Auth handler do not prove an implemented recovery flow. There are no dedicated lesson-completion, module-completion, or all-course-completion routes. `src/app/icon.svg` is metadata, not a screen.

### Concrete module and lesson URLs

These lists come from `src/features/learning/catalog.ts`, `src/features/lessons/{foundations,returns}/manifest.ts`, and `src/features/lessons/registry.ts`. **12 lessons are available: seven Foundations and five Returns.** Lesson count/minutes in available module headings exclude planned checkpoints.

| Actual available URL | Current title | Main interaction coverage |
| --- | --- | --- |
| `/learn/investing-foundations/why-invest` | Spoření vs. investování | Saving/investing, time horizon, growth examples and questions. |
| `/learn/investing-foundations/stocks` | Akcie a vlastnictví firmy | Ownership, market capitalization, quantity × price, questions. |
| `/learn/investing-foundations/etfs-and-indexes` | ETF a indexy | Index/fund distinction, illustrative ETF holdings, questions. |
| `/learn/investing-foundations/bonds-and-cash` | Hotovost a dluhopisy | Principal/coupon/maturity, asset/liquidity comparison, questions. |
| `/learn/investing-foundations/how-markets-work` | Jak funguje trh: bid, ask a spread | Bid/ask/spread, buy/sell choice, liquidity, questions. |
| `/learn/investing-foundations/risk-vs-reward` | Výnos a složené zhodnocení | Current title differs from historical slug; return/compounding/recovery and risk context. |
| `/learn/investing-foundations/your-first-portfolio` | Portfolio, váhy a diverzifikace | Hypothetical portfolio weights/returns, concentration, diversification, horizon/risk-capacity scenarios, Lab bridge. |
| `/learn/returns/what-is-a-return` | Co je výnos? | Nine guided steps; absolute/relative change, prediction, editable return calculator, numeric/choice questions. |
| `/learn/returns/simple-returns` | Jednoduché výnosy | Ten steps; adjacent dated observations, losses, decimal/percentage representation, multi-number practice. |
| `/learn/returns/compounding-and-cumulative-returns` | Složené a kumulativní výnosy | Ten steps; growth factors, cumulative returns, 2–5-period explorer, recovery, questions. |
| `/learn/returns/comparing-investments` | Cenový a celkový výnos: férové porovnání | Eight steps; price vs cash distributions vs reinvested total return, common comparison basis, mastery question. |
| `/learn/returns/log-returns` | Logaritmické výnosy | Eight steps; simple/log conversion, summation through time, approximation limits, mastery question. |

The authored Foundations content/step map is `src/features/lessons/foundations/content.ts` (`foundationsContent`, `foundationsSteps`); Returns content is in the corresponding slug-named files. Prediction/mastery are positions/kinds in this existing lesson flow, not separate challenge routes.

**Planned identifiers, not available screens:** Foundations `foundations-checkpoint`, Returns `returns-checkpoint`, and modules `volatility`, `correlation`, `diversification`. The module route rejects planned modules; the lesson registry does not contain either checkpoint. Foundations `ModuleOverview` hides its planned checkpoint; Returns shows its checkpoint as an unavailable row. Learn's `JourneyOverview` currently includes registered checkpoints as status markers in available modules. Progress lists all five modules, with future modules labeled “Připravujeme.” These presentation differences must not accidentally publish content.

## 2. Feature inventory

### 2.1 Lessons and learning loop

**Architecture:** `AuthoredLesson`/`LessonBlock` in `src/features/lessons/types.ts` describes content, stable IDs/slugs, positions, estimated minutes, sections, optional navigation metadata, and blocks. `authoredLessons`/`getAuthoredLesson` resolve content. `getStepDefinitions`/`getGuidedSteps` in `src/features/lessons/returns/guided-flow.ts` groups block IDs into sequential screens for both modules. The path's historical name does not mean it is a Returns-only engine. `GuidedBlock` renders content; `GuidedQuestion` owns question interaction; `GuidedLesson` orchestrates persisted navigation/completion.

| Actual block or step type | Rendered behavior |
| --- | --- |
| `heading`, `paragraph` | Concept hierarchy and explanatory text. |
| `formula` | `FormulaBlock`: KaTeX HTML + MathML, variable legend; render-failure message/source fallback. |
| `workedExample` | Labeled values/steps using `MetricResult`, introduction/conclusion. |
| `conceptCallout`, `explanation`, `takeaway` | `ConceptCard`; static explanation or summary, distinct from checked feedback. |
| `interactiveFigure` | One of the registered explorers listed below; computed locally. |
| `multipleChoiceQuestion` | Native radio group; recognized option required; compare option ID. |
| `numericQuestion` | One labeled string input, authored numeric answer and absolute tolerance. |
| `multiNumericQuestion` | Several labeled string inputs; every value must meet its own tolerance. |
| `labBridge`, `lessonSummary`, `checkpoint` | Educational bridge/summary/checkpoint copy. A `checkpoint` block does **not** imply either planned checkpoint lesson exists. |
| `kind: mastery` | Existing step eyebrow/counter for designated mastery questions; no separate mastery score store. |

`evaluateQuestion`, `parseNumericAnswer`, `isQuestion` in `src/features/lessons/question-evaluation.ts` are shared evaluation. Blank/non-finite/unknown-choice values return no evaluation; a valid wrong answer returns false. Numeric answers normalize a Czech comma to a decimal point. Check displays authored correct/incorrect explanations and disables inputs. Incorrect → Retry clears ephemeral answers; correct → Continue submits answer values and next position to the server. No correctness flag, XP amount, or capital amount is submitted as authority.

Server `validateMove` in `src/features/progress/transition.ts` prevents skipping ahead by more than one step and checks the outgoing question again. UI Previous moves one step back. `saveLessonProgress` stores only status/cursor/update time; answers, failed attempts, and explorer values are **not persisted**. The current step remounts on navigation; reloading/revisiting it resets its local exercise input. `markLessonInProgress` inserts a missing progress row without moving an existing cursor/recency.

`validateCompletion` requires the persisted final step (or an already completed lesson). Reaching that step does not itself complete the lesson: the learner explicitly selects Finish. `completeLesson` atomically sets completion and creates a one-time receipt under the account row lock. `GuidedLesson` displays completion only after successful persistence; failure retains the lesson and provides retry. Completed lessons enter review at position zero; review navigation/finish do not change completion/cursor or give another award. Review is captured for that attempt so server revalidation does not relabel a successful first completion as review.

The progress header counts guided steps **plus the completion state**. Back in that header goes to Learn; it is distinct from Previous. Completion has next/return/module actions. A newly unlocked Portfolio Lab takes CTA precedence over all-complete/next-lesson actions. Otherwise all available lessons completed leads to `/lab` in completion navigation. This is not a certificate or separately stored course-completion record.

### 2.2 Existing interactive learning tools

All are educational local state, separate from personal portfolio trades. Explorer inputs are not gates unless a separate authored question follows them.

| Component / source | Existing controls and output |
| --- | --- |
| `ReturnCalculator` — `src/components/lesson/return-calculator.tsx` | Start/end price strings; reactive absolute change and simple percentage return; input error. |
| `PriceSeriesExplorer` — `src/components/lesson/price-series-explorer.tsx` | Fixed synthetic dated closes 100→103→101→106; select adjacent period, chart, desktop table/mobile list, N prices→N−1 returns, denominator/change explanation and multi-day gap warning. Uses `historicalPriceReturns` in `src/features/finance/historical-price-returns.ts`, not a live provider call. |
| `CompoundingExplorer` — `src/components/lesson/compounding-explorer.tsx` | Starting value, 2–5 editable period returns, add/remove period; arithmetic sum vs cumulative return, value chart, disclosed period-by-period calculations. |
| `RecoveryExplorer` — `src/components/lesson/recovery-explorer.tsx` | Loss input, 10/20/50% presets, required recovery return; excludes 100% loss because finite recovery is impossible. |
| `GrowthComparison`, `ShareExplorer`, `StockPositionExplorer`, `BondCashflowExplorer` — `src/components/lesson/foundations-explorers.tsx` | Editable starting amount/rate/time; ownership or market-cap variables; position quantity/price; principal/coupon/years. Derived values and explanations. |
| `IndexEtfVisual`, `EtfHoldingsVisual`, `AssetComparison`, `MarketQuoteExplorer`, `LiquidityComparison` — same file | Illustrative comparisons, selectable asset/buy-sell/liquidity context. No real order submission. |
| `RiskScenarioExplorer`, `DrawdownExplorer`, `DiversificationPreview`, `TimeHorizonExplorer`, `DiversificationImpact`, `PortfolioHorizonScenario`, `RiskCapacityScenario` — same file | Fixed scenario/context choices and/or editable peak/current values; explanatory educational outcomes. No persisted challenge, prediction-lock ledger, or score. |
| `PortfolioBuilder` — `src/components/lesson/portfolio-builder.tsx` | Stocks/bonds/cash sliders and editable weight strings, 100% stocks or 60/30/10 presets, explicit total/remainder validation, editable one-period hypothetical returns, weighted result and allocation bar. Each slider edits that category; it does not automatically redistribute the others. |

Financial teaching helpers live in `src/features/finance/{returns,foundations,historical-price-returns}.ts`. They use numeric calculation for educational scenarios, with explicit invalid/overflow handling; they are not the canonical portfolio money ledger. `rebalanceAllocation` and `portfolioScenario` exist in `src/features/lab/portfolio.ts` with tests, but are not evidence of an additional routed allocation-editor feature. The active builder validates manual totals; Backtesting uses fixed strategy weights and `portfolioWeightedReturn`.

### 2.3 Progress, rewards, persistence, and unlocks

**Material source/policy conflict — requires product clarification before reward design.** The supplied `AGENTS.md` describes current per-first-lesson capital of 2,000 Kč and replacement of visible XP. The committed application, current tests, and `docs/product-reset.md` implement the following different behavior. This report documents it without changing either policy or implementation:

| Item | Current implemented contract and evidence |
| --- | --- |
| First eligible lesson completion | `LESSON_XP = 60` in `src/features/gamification/domain.ts`. Policy v2 receipt has `LESSON_PRACTICE_CAPITAL_MINOR = 0n` and `REWARD_POLICY_VERSION = 2` in `src/features/rewards/practice-capital.ts`. |
| Review/repeated completion | No additional XP or capital. Composite user/lesson primary key on `lesson_award`; completion transaction is idempotent. |
| Portfolio Lab unlock | All **seven available Foundations lessons** completed **and total receipt XP ≥420**. `evaluateUnlock`, `progressionUnlocks` in `src/features/progression/unlocks.ts`. XP from other lessons can contribute to threshold, but cannot replace Foundations prerequisite completions. |
| Unlock capital | One `progression_unlock` receipt grants `500_000n` minor units = **5,000 Kč**. Recorded entitlement keeps access. Existing portfolio generation grandfathers access with a zero additional grant; anonymous demo access can grant independently of prerequisites. |
| Practice Capital source | Sum of stored lesson receipt capital **plus stored unlock grants**, not XP conversion and not a mutable account balance. `getPracticeCapitalSummary`, `loadPracticeCapitalSummary`, repository `entitlement`. Historical v1 receipts keep their actual 2,000 Kč values. |
| Visible reward UI | XP appears in completion, Progress, Foundations module, and Lab/locked conditions. Learn's compact `LearningStats` displays virtual capital and streak; current Czech copy generally calls Practice Capital “virtuální kapitál.” |

`getLearnerSummary` (`src/features/learning/learner-summary.ts`) counts only available lessons. Overall completion percentage is `round(completed / 12 × 100)`. Module UI derives completed available rows; repository `getModuleProgress` counts completed published DB lessons in that module. Static manifests, authored registry, and seeded DB publication must stay synchronized. Planned content does not increase completion denominators.

Continuity precedence is latest in-progress lesson → first unfinished lesson in the most recently completed module → recommended module → curriculum order. `recommendLearning` (`src/features/personalization/recommendation.ts`) independently recommends the first eligible unfinished lesson, preferring Foundations before Returns. **Learn's dominant Recommendation CTA is recommendation-based; an active lesson can instead appear in the secondary resume link.** Progress and completion use continuity summary. This is an existing distinction, not proof of one shared next-action algorithm.

`getGamification` deduplicates lifetime lesson receipts, derives total XP, today's first completions, and consecutive learning days. Streak remains active if today or yesterday has an award; review alone does not maintain it. Learning date is recorded using the validated profile timezone (UTC fallback). `dailyLessonTarget` uses `ceil(minutes / 10)` with a minimum of one: 5/10→1, legacy 15/current 20→2, 30→3. This is a completed-lesson target, not measured time spent. `weeklyActivity` in `src/components/progress/activity.ts` uses completion timestamps converted into the current profile timezone for the Monday–Sunday week; it is not a seven-day rolling chart or the award-date streak calculation.

Persistence: `lesson_progress`, `lesson_award`, `learning_profile`, and `progression_unlock` in `src/db/schema.ts`. There is no course-score/achievement ledger. `AchievementBadge` is used in the development showcase, not an implemented achievements screen. `loadPortfolioLabUnlock` can repair/record entitlement on access inside a transaction; it is not a pure read despite its name.

Migration evidence: `0003_chunky_sphinx.sql` creates/backfills XP receipts; `0004_awesome_sebastian_shaw.sql` adds/backfills v1 capital; `0005_sweet_anthem.sql` adds portfolio generations/trades; **`0006_flowery_nightmare.sql` adds FX provenance**; **`0007_complex_deadpool.sql` adds/backfills unlock receipts**; `0008_overconfident_shape.sql` permits zero-capital receipts; `0009_brainy_madame_masque.sql` adds personalization fields. Some prose references unlock migration as 0006; the actual SQL filename is 0007. No migration was run, and the deployed DB's migration status is unverified.

### 2.4 Onboarding and personalization

The connected UI uses `src/features/personalization`, while `src/features/onboarding` still provides profile/history reads, legacy types/contracts, and compatibility operations. Do not mistake legacy helper functions for a second current onboarding screen.

- Goal: one of CONFIDENCE, LONG_TERM_ETF, COMPANIES, PORTFOLIO, QUANT. Flow requires a choice; preferences schema permits null for defaults/legacy/settings.
- Interests: zero or more of STOCKS, ETFS, PORTFOLIO, FUNDAMENTALS, DATA, QUANT, BACKTESTING (unique, maximum seven).
- Experience: BEGINNER, BASIC, INVESTOR; legacy ADVANCED reads as INVESTOR.
- Tempo: persisted 5/10/20/30 minutes; 20 is labeled “15–20 minut,” 30 “30+ minut”; legacy 15 reads as 20.
- Diagnostic: versioned `FOUNDATIONS_DIAGNOSTIC_V1`, five choice questions on return, compounding, weight, bid/ask, diversification. `evaluateDiagnostic` computes evidence/server correctness: 0–1 correct = foundations_needed, 2–3 = partial_foundations, 4–5 = strong_foundations. It awards nothing, skips nothing, and unlocks nothing.
- Recommendation varies reason, example-context copy, scaffold-description copy, approximate session lesson IDs (max three), and whether a lesson spans sessions. It **does not change lesson bodies, question difficulty, step gates, access, or financial rewards**. Session lesson IDs do not implement a multi-lesson session runner.
- Initial submission is a conditional one-row upsert storing preferences and server-evaluated diagnostic. Stale/duplicate initial saves do not overwrite completed personalization. Skip writes neutral defaults and initial gate completion, leaving personalized completion absent. Settings edits preserve diagnostic and original completion timestamps. Explicit retake replaces only the latest diagnostic; no diagnostic history log.
- `sessionStorage` holds a validated draft keyed by user and initial/retake mode. Disabled storage still permits use but loses refresh recovery. `PersonalizationPrompt` dismissal is a user-keyed `localStorage` UI preference, not a server completion marker.

Evidence: `profile.ts`, `diagnostic.ts`, `draft.ts`, `recommendation.ts`, `repository.ts`, `actions.ts` under `src/features/personalization`; `PersonalizationFlow`, `PersonalizationEditor`, `PreferenceFields`, `Recommendation`, `PersonalizationPrompt` under `src/components/personalization`.

### 2.5 Portfolio Lab

**Implemented persistent paper portfolio:** one active generation per learner, lazily created; CZK base currency; long-only fractional equity/ETF/bond trades; server-derived price and reference FX; positions folded from immutable trades; current valuation; buy/sell/reset; recent activity. There is no separate Save Portfolio button: successful server mutations persist automatically.

Supported instruments depend on provider. Deterministic `deterministicInstruments` in `src/features/market-data/deterministic/fixtures.ts` includes AAPL, MSFT, NVDA (USD equities), VWCE (EUR ETF), CZGB35 (CZK educational bond), CZK cash, and SPX index. The portfolio search action filters cash/index; execution also rejects them. Thus **five deterministic instruments are tradeable**, with cash managed as an account amount. Names/tickers of real companies do not make their fixture prices real market data. FMP normalizes profile-supported equities/ETFs, excludes unsupported currencies and non-ETF mutual funds; a real-bond workflow is not verified by that adapter. Search can return `assetType: null` until metadata resolves it.

Main interaction: Invest → native search dialog → ≥2-character query (250ms debounce, latest-result guard) → select exact instrument identity → instrument route → Invest → load preview → quantity → Review → Confirm → returned portfolio/notice. Search supports arrows and Enter; symbol alone is not an identity. **Current purchase entry is quantity-only**, default 0.25, with up to eight decimal places and estimated CZK cost. No cash-budget mode, order type, limit price, market-order queue, leverage, shorting, or margin UI exists. Insufficient cash is rejected by server; the client review does not guarantee execution.

Sell is available in holding overflow actions and instrument position actions. It starts with the entire held quantity; learner may edit a fractional amount, inspect proceeds estimate, and directly confirm (no separate buy-style review step). Server rejects overselling or unavailable execution. Reset is behind portfolio options and a confirmation dialog. It closes the current generation, opens a clean one, restores full earned entitlement as cash, and preserves prior generations/trades, lessons, and receipts. Closed generations are audit data, not currently browseable UI.

**Canonical calculations:**

```text
earned entitlement = Σ lesson receipt capital + Σ unlock grant capital
cash = earned entitlement + Σ immutable trade cash deltas
buy cash delta = -(gross amount + fee)
sell cash delta = gross amount - fee
holding market value = round(quantity × quote × FX to CZK minor units)
portfolio total = cash + Σ holding market values (only if all available)
investment gain/loss = portfolio total - earned entitlement
holding unrealized gain/loss = holding market value - remaining cost basis
holding weight = holding market value / total invested holdings value
```

`foldTrades` in `src/features/portfolio/domain.ts` implements weighted-average cost. Partial sales allocate cost proportionally; full sales remove remaining cost and compute realized gain. The domain tracks realized gain, but the current UI has no separate realized-P&L report. Fees are represented in schema/math but currently execution writes **zero fees**. Holding weights exclude available cash; the displayed “portfolio weight” is not weight divided by total cash-inclusive portfolio value. New contributions increase capital and cash together without changing investment gain/loss. Portfolio percentage P&L is simple gain/earned-capital basis points, not CAGR/time-weighted return.

`decimal.ts`: quantity/price scale 8 decimals, FX scale 12 decimals, bigint minor-unit money; centralized rounding half away from zero. Server `grossBaseMinor` applies full precision; buy UI estimates use an already rounded one-unit CZK amount and can differ. Quantity parser expects a decimal **point**, unlike lesson numeric answers that accept comma. Keep input strings and final server amounts distinct from formatted Czech output.

`executeTrade`/`resetActivePortfolio` in `src/features/portfolio/repository.ts` lock the user's row, derive ownership/current ledger/entitlement, check duplicate keys and balances, and append a trade or new generation. Keys are UUIDs from the client; trade uniqueness is per generation/key, reset uniqueness per user/key. Lesson completion uses the same account lock. UI refs retain a key across a failed attempt and renew it when quantity changes. Do not replace this flow with optimistic balance edits. Trade input schema is strict and accepts only instrument ID, quantity, and idempotency key; price, FX, P&L, and cash are never authoritative client input.

`loadPortfolioView` in `src/features/portfolio/service.ts` serializes money as strings, computes valuations concurrently, and returns the last **eight trades of the active generation** in reverse order. Missing quote/FX/provider-compatible identity returns explicit unavailable holdings. If any holding cannot be valued, aggregate holdings value, portfolio total, aggregate P&L and allocations become unavailable; known cash and individually valued holdings remain displayable. No zero substitution or fallback price.

**Charts/allocations:** the personal Portfolio page's performance area explicitly says history is not available. 1M/3M/6M/YTD/1Y/Max labels there are static spans, not interactive filters. There is no persisted portfolio performance series, personal allocation donut, editable target allocation, automatic rebalance, named portfolio manager, saved strategy, or “Backtest this portfolio” action. Actual allocation exists as per-holding calculated weights. Instrument history and ETF composition are separate implemented views.

### 2.6 Market data and instrument analytics

Provider boundary: feature/UI → `MarketDataService` (`src/features/market-data/service.ts`) → normalized provider interfaces (`provider.ts`, `contracts.ts`) → adapter. Server-only composition/configuration are `composition.ts`, `environment.ts`; Portfolio wraps them in `src/features/portfolio/environment.ts`/`market-data.ts`.

| Concern | Actual implementation / limit |
| --- | --- |
| Security sources | Default configuration enum is deterministic; optional FMP (Financial Modeling Prep) adapter has search/profile/quote/daily EOD history and equity/ETF analytics. Active deployment selection/API permissions are unverified. |
| FX sources | Independently configured deterministic or Frankfurter reference-rate provider. FMP selection requires explicit FX provider. Supported currencies CZK/USD/EUR. Frankfurter is a dated fixing/reference rate, not executable intraday broker FX. |
| Provenance | Stable identity, quote currency, exchange/MIC when known, observation/retrieval dates, provider/dataset, deterministic/sample kind, adjustment/completeness; independent FX reference date/provider. Switching security providers does not silently remap old holdings. |
| Availability | Typed normalized failures (provider config/auth/rate-limit, instrument, quote, FX, malformed data). Instrument loader uses independent settled results so price/chart remain when analytics fail. |
| Caching/fetching | External HTTP clients request `cache: no-store`; normalized process-local cache and in-flight coalescing in service. Defaults: search 5m, metadata/history 24h, quote 30s, fundamentals 6h, ETF info/sectors/countries 24h, ETF holdings 12h; Frankfurter composition uses 1h FX TTL. Not a persistent/distributed DB cache. No UI streaming/polling/live subscription found. |
| Quote usability | `evaluateQuoteUsability` in `market-session.ts` distinguishes fresh, closed-market-reference, stale, unavailable and valuation vs execution. Default freshness 15m, generic unavailable threshold 24h. US equities MICs XNAS/XNYS/XASE have a New York regular-session/full-day holiday calendar; early/ad hoc closures excluded. Other exchanges have unknown-session, age-based handling. Closed-market reference can value holdings but cannot execute immediately. |
| Price basis | Instrument chart requests daily UTC **split-adjusted, dividends-excluded** OHLC. FMP rejects reinvested total-return history; corporate actions capability exists in the contracts but FMP implementation explicitly throws unavailable. Personal holdings are not automatically adjusted by a corporate-action processor. |

`loadInstrumentDetail` in `src/features/instruments/detail.ts` first resolves metadata, then quote/history/equity fundamentals/ETF analytics independently. Chart ranges are `1M`, `3M`, `6M`, `YTD`, `1Y`, `5Y`, `Max` (default 1Y). Max requests from 1900; it only displays actual available observations. Synthetic histories have finite coverage; changing range is not a promise of that many years of data.

`InstrumentPriceChart` shows a Recharts area/line of adjusted closes, custom SVG candlesticks only when valid OHLC exists, and daily/weekly/monthly/quarterly aggregation selected by `candleInterval` in `price-chart-presentation.ts`. Zoom uses native start/end sliders and reset; no gesture/pinch/drag zoom is implemented. Zoom changes visible points, while selected-period endpoint return/change/extremes remain based on the full selected range. Line extrema use closes; candle extrema use OHLC. The raw-data disclosure shows full range rows, not only zoomed rows. Endpoint return is price return in quote currency; it is not personal CZK portfolio P&L, dividend-inclusive total return, or maximum drawdown. One point yields a price but no return; gaps are not filled. Range navigation remounts chart state via a key.

Equity `EquityKeyMetrics` (`src/components/lab/equity-key-metrics.tsx`) exposes 18 metrics:

- Valuation: market cap, P/E TTM, P/S TTM, P/B TTM, EV/EBITDA TTM, price/FCF TTM.
- Profitability: gross/operating/net margins, ROE, ROIC (TTM).
- Financial health: debt/equity, current ratio, net debt/EBITDA (TTM).
- Business performance: annual revenue, net income, free cash flow, diluted EPS, with report currency/fiscal date when supplied.

Metric help toggles, missing “—”, not-meaningful “N/M”, source-period context and educational signal ranges are meaningful existing states. `equityMetricSignal` in `src/features/instruments/fundamentals-signals.ts` provides neutral/positive/caution/unavailable/not-meaningful states; it is not a composite investment rating or buy recommendation. FMP mapping/period/currency decisions remain in server adapter code.

ETF `EtfAnalytics` (`src/components/lab/etf-analytics.tsx`) exposes expense ratio, AUM/currency, NAV/currency, source holdings count, inception year, top ten loaded holdings, largest/top-ten concentration, loaded vs source count, sector and country breakdowns, explanations and source freshness. Datasets can fail independently. Weights are not renormalized to hide missing rows; top-ten aggregate is unavailable when fewer than ten valid rows are loaded. Bars are scaled relative to the largest displayed weight, **not** a 0–100% portfolio-width axis. There is no interactive ETF holdings drill-down or standalone fund screener.

### 2.7 Backtesting Lab: implemented sample tool

**It exists and calculates results.** `src/components/lab/backtesting-lab.tsx` calls pure helpers in `src/features/lab/backtest.ts`; it does not call the security provider, persist results, or inspect personal trades.

| Input/action | Actual supported behavior |
| --- | --- |
| Strategy | Three fixed samples: 60/30/10 stocks/bonds/cash, 100% stocks, 100% bonds. No arbitrary allocation/instrument editor. |
| Dates | Inclusive January–December year selectors, 2015–2025; equal start/end year valid; reversed years rejected. No arbitrary dates or intraday frequency. |
| Initial amount | Positive finite numeric string; default 100,000 Kč. Display unit only, no FX conversion and no deduction from Practice Capital. |
| Run | Synchronous client calculation; stores result snapshot in component state, focuses result heading; chart chunk loads separately. |
| Change inputs | Existing result stays visible with dirty warning until rerun. Invalid rerun produces alert and can retain previous result. Successful rerun resets question/checked state. |
| Follow-up question | Choose which metric represents largest peak decline; Check locks choices and supplies explanation for both outcomes. No lesson credit/reward/save; rerun resets it. |

Data: `syntheticMonthlyData` (`src/features/lab/sample-data.ts`) contains **132 invented monthly returns**, Jan 2015–Dec 2025, with deterministic cycles/shocks. These dates are illustrative, not verified historical market observations. Benchmark is the same synthetic stock series, not a named real index dataset.

Calculations:

- Monthly mix return is the weighted sum of simple asset returns; mix returns to target weights each month, implying cost-free monthly rebalancing.
- Growth compounds sequentially and includes the initial value: 132 intervals yield 133 values for the full period.
- `calculateCagr`: `(final / initial)^(1 / (intervals / 12)) - 1`.
- `calculateMaxDrawdown`: positive largest loss magnitude from a running peak, including initial investment and month-end observations.
- `calculateVolatility`: sample standard deviation (`n−1`) of simple monthly returns × √12.
- `selectMonthlySample` rejects missing/duplicate/unsorted/non-finite/incomplete months; helper calculations reject overflow and returns below −100%, preserving a valid total-loss path.

Outputs: four described metrics (final value, CAGR, max drawdown, annualized volatility), `BacktestChart` with mix vs dashed stock benchmark, tooltips and a full monthly-value table, benchmark final value/drawdown commentary, assumptions disclosure, educational question. No drawdown chart, risk distribution, Sharpe ratio, optimization, strategy scripting, comparisons of saved runs, recurring cash flows, fees, taxes, inflation, withdrawals, or currency effects. Assumption copy describes reinvested total-return assumptions for **synthetic** samples; it does not supply real total-return data.

Future integration of real historical instruments, frozen personal allocation snapshots, or saved experiments is separate product scope. An implemented generic historical-return helper/provider history is not evidence that those are connected to Backtesting.

### 2.8 Authentication, accounts, sessions, and demos

`src/lib/auth.ts` configures Better Auth (`better-auth/minimal`), Drizzle PostgreSQL adapter, email/password, optional Google/Facebook, anonymous plugin, Next cookie integration, safe OAuth error destination, and enabled rate limiting (anonymous sign-in limited to five/minute). `src/lib/auth-client.ts` provides the React client with anonymous support. `getCurrentUser` in `src/lib/session.ts` reads session using awaited Next headers.

Email login uses email/password; registration adds name, HTML required/email validation, password minLength 8, and server Better Auth validation. Forms have pending state, friendly errors, router replace/refresh. Social providers appear only with a complete server credential pair from `createSocialAuthConfig`; only availability booleans cross to UI. Social login is a full-page redirect, guards duplicate submission immediately, handles return errors, and resets pending lock on browser Back/pageshow. Callback destination does not preserve an arbitrary originally requested protected URL in these forms.

`AccountSecurity` lists Better Auth accounts client-side and provides explicit Google/Facebook link/unlink. Credential method is status-only. Provider unavailable rows remain visible in Settings; auth-page buttons hide. Failures are allowlisted messages, including last-login-method protection; no raw tokens/provider internals rendered. Implicit linking retains Better Auth verified-email safeguards (confirmed in installed package/docs), without a trusted-provider override. An existing unverified local email can cause social `account_not_linked` rather than silent merge. No email verification sender, reset-password sender, or corresponding user-facing route/form is configured. No product password recovery/verification workflow should be designed as already implemented.

Protected route enforcement is server layout/actions; no middleware/proxy guard file found. Hiding navigation is not authorization. Normal session lifetime/update semantics use Better Auth defaults, not a project-specific UI contract; actual deployed cookies/expiry were not measured. Anonymous sessions explicitly expire after 24 hours. Session/account/verification records live in `src/db/schema.ts`; there is no active-device management UI.

`DemoButton` reuses an existing session or creates a separate anonymous identity. `ensureDemoSeed` runs before demo session creation; one-time transaction seeds six first completions (360 XP), UTC-relative four-day history, and an active Foundations return lesson near its end; profile uses a 20-minute goal and completed initial onboarding. Demo still lacks personalized onboarding and can show its prompt. Unlock is independent of incomplete Foundations. In deterministic mode, first portfolio access can seed AAPL and VWCE buys **only if total cost fits opening capital**; provider/session conditions can prevent that. Existing profile/portfolio changes are not overwritten on each visit. Do not guarantee specific demo holdings across provider configurations.

Cleanup is an operator CLI, `scripts/cleanup-demos.mjs` / `npm run demo:cleanup`, dry-run default, deletion only with `--apply` for stored anonymous users older than seven days. No automatic cleanup scheduler was verified. User-owned learning/auth/portfolio records cascade on deletion; shared fixtures/process caches are not user-owned DB rows. No verified “convert demo to permanent account with all progress transferred” UI flow was found.

## 3. Component inventory and UI architecture

### 3.1 Organization and reuse

Routes assemble server data and components; `src/components` groups presentation/controllers by area; `src/features` contains pure/domain rules, typed contracts, server services/actions/repositories, and tests; `src/lib` owns auth/environment/formatters/utilities; `src/db` owns persistence/schema/seed. There is no global client state store or query-cache library in dependencies; controllers use React state/refs/effects/transitions. No React Hook Form/SWR/TanStack Query/Zustand integration found.

| Family / concrete files | Reusable responsibility | Coupling to protect |
| --- | --- | --- |
| `src/components/ui/{button,form-controls,surface,badge,progress,feedback}.tsx` | `Button`, `ButtonLink`, `IconButton`, native `Input`/`Textarea`/`Select`/`Slider`, `Surface`, `Badge`, accessible `Progress`, `Feedback`. CVA variants + `cn` (`clsx`/tailwind-merge). | Lowest-risk presentation layer; preserve default button type, disabled/loading semantics, refs, labels, progress clamping, focus styles. |
| `src/components/learning/{learning-button,lesson-progress,text-input,finance-input,answer-option}.tsx` | Compatibility exports/wrappers, labeled string inputs, choice states, lesson navigation/progress. | Preserve raw-string parsing ownership, native radio/checkbox behavior, hint/error associations and action callbacks. |
| `src/components/learning/{concept-card,formula-block,metric-result,lesson-summary,lesson-feedback,completion-screen,page-state}.tsx` | Concept/explanation/formula/metric/feedback/completion/error presentation. | Completion/feedback auto-focus and next callbacks are functional; mathematical basis and feedback states must stay readable. |
| `src/components/learning/learning-chart.tsx`, `motion.ts` | Shared single-series Recharts style/data table; reduced-motion duration helper. | Charts require finite values, named units, proper scales and accessible alternatives. |
| `src/components/shell/navigation.ts`, `src/components/shell/{mobile-nav,page-frame,app-header}.tsx` + `src/components/app-shell.tsx` | Three-destination IA, gutters/widths, header/account/mobile shell. | AppShell has lesson bypass, timezone mutation and sign-out routing; retain these while reskinning markup. |
| `src/components/learning/{journey-overview,module-overview,learner-greeting}.tsx` | Curriculum/lesson path and greeting. | ModuleOverview routes lesson IDs using manifest; available/planned/review distinctions. JourneyOverview status nodes are not currently lesson links. |
| `src/components/gamification/{learning-stats,daily-goal,streak}.tsx` | Receipt-derived capital/momentum presentation. | No independent counters. `practice-capital-counter.tsx` and `achievement-badge.tsx` currently serve showcase use; no new balance/achievements behavior implied. |
| `src/components/progress/progress-overview.tsx`, `activity.ts`, `.module.css` | Real learner overview, local-week activity, container-query layout. | Counts/timezones/unlock/fallback state selection are mixed into render code. |
| `src/components/lesson/{guided-lesson,guided-question,guided-block}.tsx` | Controller, evaluated question, authored-block adapter. | High coupling: persistence sequencing, review, server gates, reward response, focus, retry. |
| `src/components/lesson/*-explorer.tsx`, `foundations-explorers.tsx`, `portfolio-builder.tsx` | Existing educational interaction templates. | Local draft, field parsing, calculation imports and explanations; moving component boundaries can reset drafts. |
| `src/components/lab/{portfolio-lab,instrument-detail,buy-review,locked-portfolio-lab}.tsx` | Portfolio screen, search/sell/reset/order sheets, instrument state and review. | High coupling: transitions, UUID reuse, pending cancellation protection, estimates vs authority, response refresh and focus restoration. |
| `src/components/lab/{instrument-price-chart,equity-key-metrics,etf-analytics,backtesting-lab,backtest-chart}.tsx` | Instrument/synthetic charts and analytics presentation/calculation controllers. | Range/zoom basis, dataset states, currency/period/signal rules, result snapshots. |
| `src/components/personalization/*` | Flow, preferences, recommendations, prompt. | Draft validation/storage keys, conditional writes, diagnostic-only retake, pending/retry. |
| `src/components/auth/*` | Auth page wrapper, forms, optional social methods, demo and linking controls. | Session operations, full redirects, error normalization/provider availability, lock/reset. |
| `src/components/design-system/*`, `src/components/marketing/*` | Development demonstrations and expressive marketing. | Preview controls/data are not product contracts; do not import illustrative achievements, allocation/history, share/video controls as existing product features. |

**shadcn/Radix reality:** the architecture policy mentions them “where appropriate,” but the current `package.json` has no Radix/shadcn dependency, and no `components.json` was found. These UI primitives are local native-element/CVA components. Modals use HTML `<dialog>`; disclosures/account menus use `<details>/<summary>`; analytics help uses details or inline toggle buttons. A design must not assume an already installed dialog/tooltip/menu/form library.

### 3.2 Styling, typography, theme, forms, motion

- Tailwind v4: `src/app/globals.css` imports Tailwind and `src/styles/learning-tokens.css`; `postcss.config.mjs` uses `@tailwindcss/postcss`. No legacy JS Tailwind config found. Tokens live in CSS `@theme`.
- Canonical semantic roles: background/foreground/surface/surface-muted, primary/hover/soft, secondary, border/control, success/warning/danger/info and data colors. `ql-*` is a compatibility alias layer still consumed heavily by lessons/labs/auth; changing/removing aliases is a cross-screen migration risk.
- Palette matches AGENTS: warm white #F8F6F0, blue #2498F3, deep blue #1667B2, navy #17324A, pale blue #DFF2FF, green #42C98A, warm accent #FFB85C, data dark #102D4C. Accessible status ink colors differ from bright brand fills. Primary button copy uses Data Dark on bright blue, white on deep-blue hover.
- Nunito Sans loaded weights are **400/500/600/700**. Some UI classes request 800; a new typography specification must consider actual font loading/synthesis. Marketing separately loads Nunito 800, not an authenticated product display font.
- Current type tokens: microcopy 13px, small 15px, body 16px, emphasis 18px, card title 20px, section title 28px, page title clamp 36–48px. Some Progress/financial headings locally override sizes. Four-pixel spacing rhythm; radii 10/12/16/24/30px and pill; three elevation levels.
- No functional theme switch/dark token overrides were found. Dark OS `themeColor` metadata does not implement a dark product theme. Do not require two live themes as an existing feature.
- Forms are controlled strings/native form submission and Better Auth or server actions. Zod validation happens at feature/action/repository boundaries. FinanceInput intentionally leaves strings unchanged; each domain parser owns precision/locale. Auth uses FormData/native validity; lesson/onboarding choices use native radio/checkbox groups.
- Motion library is `motion/react`. Semantic durations 180/270/400ms; `useLearningDuration` removes duration for reduced motion; CSS disables nonessential animation/transitions under that preference. Recharts series animation is disabled. Shell/buttons use CSS state transitions; there is no mandatory animated chart transition.

### 3.3 Responsive and accessibility conventions

Intended validation widths are 1440/1024/768/390/375/320 plus 200% text. Actual layout rules combine Tailwind sm/md/lg/xl, 375/390/420px controls, 1100px Journey reflow, and Progress container widths. They are not one universal desktop/mobile breakpoint. `PageFrame` provides reading/focused/standard/wide widths and consistent gutters; portfolio/detail override maximum width to 80rem.

Implemented patterns include semantic main/nav/section/ol/table/dl; scope/captions on data tables; native fieldset legends; label/description/invalid associations; live status vs alert; non-color correctness labels/icons; global 3px focus-visible outline; skip link; `aria-current` navigation; modal titles/descriptions and native `showModal()`; Escape/pending handling and explicit focus return; 48px default controls and ~44px specialized controls; safe-area bottom navigation; `min-w-0`, wrapping financial text, separate mobile holdings/price-series lists; coarse-pointer input size ≥16px; `touch-action: manipulation`.

**Limits to retain in acceptance planning:** no new screen-reader or physical-device testing was performed. Custom portfolio overflow menus use `role=menu/menuitem` but do not implement a complete roving-arrow menu pattern. Long holding identities/search names use truncation. Instrument candle-data table has local `overflow-auto` and five columns, so mobile/200% readability requires explicit review. Formula/KaTeX width, chart currency labels, dialog sticky actions with virtual keyboard/safe area, tall feedback/autofocus, long auth errors, and 320px/200% Progress remain migration-sensitive. Focus trap/Escape behavior follows native dialog plus local handlers; do not assume all library-menu/dialog behaviors are implemented.

### 3.4 Data loading and mutation map

| Boundary / concrete source | Existing data flow and update behavior |
| --- | --- |
| Server route composition — `src/features/learning/load-learner.ts`, `loadLearner` | Reads session, then progress rows/profile/gamification/capital concurrently with `Promise.all`; derives recommendation and continuity summary. Learn, Progress and lesson composition consume server results; no global client store is the source of progress. |
| Lesson server actions — `src/features/progress/actions.ts` | `markLessonStartedAction`, `saveLessonPositionAction`, `completeLessonAction` validate session and known available lesson IDs; repositories persist under existing contracts. Return structured responses; completion serializes reward/momentum/next action. Revalidate Learn layout, legacy Dashboard and Progress; start also Portfolio; completion also Lab layout. UI waits for responses before moving/completing. |
| Portfolio server actions — `src/features/portfolio/actions.ts` | `searchPortfolioInstrumentsAction`, `loadInstrumentPreviewAction`, `buyPortfolioAction`, `sellPortfolioAction`, `resetPortfolioAction` check session/unlock and validate inputs. Trade/reset commit through repository, reload `PortfolioView`, then revalidate `/lab/portfolio`. The detail controller consumes the returned view and refreshes; PortfolioLab depends on refreshed server props. A failure after commit during view loading can still report an error: retaining the same idempotency key across retry is essential. |
| Instrument server loader — `src/features/instruments/detail.ts`, `loadInstrumentDetail` | Metadata determines type/currency and instrument validity; remaining datasets settle independently. URL range requests a new server history slice. Client chart state controls presentation/zoom, not provider requests or pricing authority. |
| Personalization server actions — `src/features/personalization/actions.ts`, repository | Session/validated preference and diagnostic submissions drive conditional initial save, skip, settings update or diagnostic retake. Client drafts survive recoverable failures; refresh/revalidation exposes saved profile. Diagnostic answers are evaluated server-side. |
| Better Auth — `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts` | Client auth/account operations use the configured Better Auth handler. Session checks remain server-side; redirecting OAuth and ordinary server-action forms are different interaction mechanisms. |
| Local-only experiments — `BacktestingLab`, lesson explorers | React state plus pure calculation imports; no persistence/network mutation for a backtest run or explorer edit. Rerender/remount behavior matters because there is no persisted experiment to restore. |

## 4. Existing user flows

1. **New email learner:** public home/auth → sign-up → new session → onboarding preferences/diagnostic or skip → saved plan (or Learn on skip) → recommended Foundations lesson. Skipping is supported; new user cannot simply bypass server onboarding without a completed marker/history.
2. **Returning learner:** sign-in → Learn → recommendation or distinct resume action → focused lesson at stored cursor → answer/check → incorrect/retry or correct → persisted Continue → explicit Finish → saved completion/60 XP → next. Browser refresh restores cursor/completion, not arbitrary exercise values. Review starts fresh and yields no repeat award.
3. **Portfolio unlock:** complete each available Foundations lesson + ≥420 XP → one durable unlock/grant → completion advertises newly unlocked Portfolio → empty funded portfolio → Invest. Legacy/grandfathered and demo users enter through existing entitlement without the normal prerequisite journey.
4. **Practice buy:** Portfolio → search sheet (idle/loading/results/empty/error) → select instrument → detail → order preview → quantity → review/back-edit → confirm/pending → server execution or recoverable rejection → holding/value/cash impact and success notice. There is no additional Save or broker confirmation.
5. **Practice sell:** holding menu or detail position → native sell sheet → edit quantity/proceeds estimate → confirm → append ledger sale → remaining holding or no holding; cash/P&L refresh. Trigger fallback matters if the last holding disappears.
6. **Reset:** portfolio options → confirmation → pending → close generation/create successor → available earned capital/no positions → success/focus to Invest. Old trades remain recorded but not exposed in an archive screen.
7. **Synthetic experiment:** Lab → Backtesting → strategy/years/amount → Run → metric explanation/benchmark curve/table → metric question → change inputs/dirty warning → rerun. No portfolio mutation or reward.
8. **Progress review:** shell Progress → daily/unlock/curriculum/activity overview → continue lesson, review latest completed lesson, visit available module or unlock conditions. Future modules are passive planned rows.
9. **Preferences/account methods:** account menu → Settings → edit/save learning preferences or diagnostic retake → success/plan; separately load/link/unlink social methods → OAuth return/errors. Sign-out runs in the account menu and sends user to sign-in.
10. **Demo:** demo button → isolated anonymous session and one-time seed → Learn (recommendation plus near-end resume) → immediately usable labs → mutate own learning/portfolio → revisit without reseed → 24-hour session expiry. Long-term anonymous deletion is the operator cleanup flow.

## 5. UI state checklist for Pen handoff

These are variants of existing screens, not proposals for new routes. Specify mobile/desktop, keyboard focus, reduced-motion handling, and long text alongside each relevant variant.

| Screen/system | Required existing variants and state distinctions |
| --- | --- |
| Shared shell | Learn/Lab/Progress active; Settings no primary nav active; account open/closed; long user name; demo badge; Portfolio-locked indicator; sign-out pending/error; focused lesson with shell absent. |
| Shared boundaries | Authenticated loading skeleton; onboarding loading; page failure/retry; unavailable route/back to Learn. Avoid asserting saved local drafts were persisted when save fails. |
| Auth | Idle/native invalid; submit pending/API/network error; social providers 0/1/2; OAuth-return error; browser-Back restored buttons; demo pending/failure. |
| Onboarding/plan | Four preference types; required goal; optional interests; diagnostic introduction/selected/unanswered question; back; restored/unavailable local draft; submit/retry/skip; retake; recommendation/default/complete/unavailable plan. No live correctness reveal during diagnostic. |
| Learn/module | Fresh, active/resume, recommended, completed/review, all available complete; optional/dismissed personalization; available vs planned; module progress; Foundations unlock state; Returns planned checkpoint. |
| Lesson content | Text/example/formula; formula error; interactive local valid/invalid; choice and single/multiple numeric; unanswered Check disabled; selected; checked correct/incorrect; retry; saving; failed save; Previous; final explicit Finish. |
| Lesson completion | First completion XP; newly unlocked Lab + grant; all-complete Lab action; next lesson; review/no reward; stats/daily goal. Do not add a guaranteed per-lesson capital animation pending policy decision. |
| Progress | Zero, partial, prerequisite-complete, XP-threshold-met-but-prerequisites-missing, recorded unlocked including legacy/demo, all available complete; goal progress/satisfied; empty recent/week; explanatory disclosure. |
| Portfolio | Locked conditions, zero-capital return-to-Learn, capital/no holdings, populated, all sold, positive/negative/neutral P&L, incomplete total, unavailable position, closed/stale quote, recent activity present/absent; history placeholder. |
| Search | <2-character idle; loading; results with unknown type; no results; provider/session failure; keyboard active result. Selection navigates to detail. |
| Instrument | Metadata unavailable; quote independent failure/stale/closed/open/unknown; full/partial/single/absent history; line/candles-unavailable/candles; range/zoom/reset/data; no own position/own position; equity vs ETF vs bond content. |
| Analytics | Equity neutral/positive/caution/—/N/M/help open; ETF dataset-specific unavailable/partial, unknown count/currency/date, <10 holdings/top-ten unavailable, source labels. |
| Order/sell/reset | Preview loading/unavailable; editable quantity/invalid estimate; review/back; insufficient cash/oversell; execution-disabled; submitting/cancellation-protected; retry same request; success/focus return; destructive confirmation cancel/confirm/error. |
| Backtesting | Pre-run, valid result, dirty inputs with old result, invalid rerun with retained result, chart loading, value-data/assumptions open, question unanswered/checked right/checked wrong. |
| Settings | Initial/legacy values; saving/success/failure preserving draft; diagnostic absent/present; account loading/error; credential method status; each social provider connected/disconnected/unavailable/linking/unlinking/error. |

## 6. Actual functionality versus future scope

| Area | Available today | Explicit planned or unimplemented scope |
| --- | --- | --- |
| Home/dashboard | Marketing and Learn entry; `/dashboard` redirect. | A standalone authenticated dashboard is absent. Marketing illustrations are not an acceptance contract for product screens. |
| Curriculum | Seven Foundations/five Returns; correct-answer gated progress, review, persisted completion. | Both checkpoints and Volatility/Correlation/Diversification modules are planned; no CMS. |
| Personalization | Preferences, five-question server-scored diagnostic, recommendation copy, session planning outputs. | Adaptive lesson content/difficulty, bypass/mastery credit, diagnostic history, session orchestrator absent. |
| Rewards | Current XP-only first lesson receipt; one Lab unlock capital grant; retained historical capital. | AGENTS v1 policy conflict unresolved; no implemented achievement ledger/leaderboard. |
| Portfolio | One CZK active paper portfolio, equity/ETF/sample bond quantity trades, cash/P&L/weights/activity/reset. | Performance-history chart, multiple portfolios, target allocation/rebalance, full transaction history UI/export, real broker integration, dividends/splits processor absent. |
| Instruments | Configured source quotes/daily adjusted history, line/candles/zoom, equity metrics, ETF composition. | Full non-US market calendars, total-return/corporate-action FMP support, standalone screeners absent. Configured live access unverified. |
| Backtesting | Three synthetic strategies, inclusive years, amount, four metrics, benchmark chart/table. | Real-market integration, saved runs, cash flows, personal allocation import, transaction-history backtest, optimization absent. |
| Scenario challenges | Local illustrative scenario widgets within lessons. | Separate scenario portfolios, decision/prediction lock/reveal/scoring persistence, challenge catalog/routes absent. |
| Account | Email/password, optional Google/Facebook, anonymous demo, social linking, sign-out. | User-facing recovery/verification/change-password, MFA, account profile/deletion/session screens absent. |

## 7. Design constraints

1. Preserve **Learn → decision/practice → feedback → saved continuation → completion → reward → next**, without turning speculative features into product requirements. The primary authenticated IA remains Learn/Lab/Progress; account/settings behind account controls; focused lessons remain separate from normal shell presentation.
2. Use **investi**, educational paper capital, and beginner-readable explanations/units. Do not present the app as a broker, actual funds, advice, or a forecast. Keep data provenance and limitations in context.
3. Reward design must describe current committed v2 behavior until product explicitly resolves the AGENTS discrepancy. Historical capital, demo grants, and grandfathered access require distinct legitimate states.
4. Financial quantities, minor-unit money, native quote currency, CZK holding valuation, percentage vs decimal returns, selected-range price return, synthetic total-return assumptions, and investment P&L are different values. Labels/design must not silently merge them.
5. Unavailable is not zero; unknown is not closed/open; sample is not live; a partial series is not complete history; metric color is not a buy signal. “Live” wording cannot be inferred from a real ticker or an FMP adapter being installed.
6. A UI-only migration must not change schemas/migrations, receipts, auth/session/linking safeguards, unlock rules, provider contracts, action inputs, precision/rounding, row locks, or idempotency. No rewrite is required for a new presentation.
7. Retain Nunito Sans and semantic token roles; keep marketing display font/art/scenery separate. The supplied marketing V14.1 approval is context, not verified visual input for this document. Use it later as a supplied reference, not as evidence of missing functionality.
8. Screen specifications need responsive reflow and accessibility states, including dialogs, long financial values/copy, 200% text, touch/virtual keyboard, focus order/return, non-color labels and reduced motion. Essential text must not be shrunk to hide overflow.

## 8. Migration risks and safe presentation boundaries

| Risk / owning symbols | What a visual migration must preserve | Safe presentation scope |
| --- | --- | --- |
| **High: lesson state machine** — `GuidedLesson`, `GuidedQuestion`, `validateMove`, `validateCompletion`, progress actions/repository | Check/retry vs correct Continue, save-before-move, final Finish, review mode, server answers/position gates, one receipt, response-driven next/unlock. Reordering steps changes persisted cursor meaning. | Reskin wrappers, typography, content/feedback spacing and responsive action layout around existing callbacks. Preserve stable lesson/block/step IDs and ordering; moving logic is separate work. |
| **High: reward-policy conflict** — `LESSON_PRACTICE_CAPITAL_MINOR`, `completeLesson`, `evaluateUnlock` | Current v2, legacy receipts, one grant, demo/grandfathered access, XP threshold+prerequisites. | Restyle existing values/states; resolve copy before designing different reward behavior. |
| **High: portfolio financial authority** — `executeTrade`, `foldTrades`, `valuePortfolio`, `grossBaseMinor`, `tradeInputSchema` | Exact arithmetic, ownership, source provenance, no overspend/oversell, immutable trades, contributions excluded from gain. | Render `PortfolioView` and preview estimates; keep calculations/service contracts and authoritative mutation payload intact. |
| **High: request retry/reset** — `tradeKey`, `resetKey`, `mutationPending` in PortfolioLab; `tradeKey`/`pending` in InstrumentDetailView | Same UUID across retry, new key on edited order, no cancellation while mutation pending, generation reset with retained history. | Reskin sheets/confirmation while retaining native modal/controller semantics; do not create new keys on every render. |
| **High: auth/OAuth** — `ApplicationLayout`, `getCurrentUser`, `SocialSignIn`, `AccountSecurity`, `auth` | Server protection, correct redirects, provider availability, immediate duplicate lock, pageshow recovery, safe linking and last-method handling. | Layout/form/control appearance; keep API calls, error allowlists and callback destinations. |
| **Medium/high: client/server serialization** — `PortfolioView`, `CompletionRewardPresentation`, `loadLearner`, actions | Server-only DB/provider secrets; decimal strings/money serialization; exact raw string input; no provider objects/secrets moved into client bundle. | Thin prop-driven visual components. Keep feature actions/repositories behind current boundaries. |
| **Medium/high: chart meaning** — `historicalRequest`, `periodStatistics`, `InstrumentPriceChart`, `aggregateCandles`, `calculateBacktestMetrics` | Price basis/currency, partial/one-point states, zoom vs full-range statistics, candle OHLC, synthetic interval conventions, accessible data table. | Colors, axis/tooltip legibility, responsive spacing/controls without altering data transformation or metric labels. |
| **Medium: local controller state** — `PersonalizationFlow`, `PersonalizationEditor`, BacktestingLab, explorer components | Draft recovery/error retention, skip/retake distinctions, local outputs, result snapshot/dirty flag, controlled input reset prevention. Remounting changes user state. | Keep component keys/state ownership; reskin fields/groups around existing callbacks. |
| **Medium: refreshed portfolio state** — PortfolioLab props vs InstrumentDetailView local `portfolio` | Portfolio page depends on server revalidation; instrument detail explicitly replaces local portfolio from action result and refreshes router. No shared store. | Preserve both response paths; test cross-navigation/back/refresh to avoid stale holdings/cash after a new wrapper/key strategy. |
| **Medium: navigation/focus** — AppShell exact-path bypass, dialog refs/fallbacks, `LessonFeedback`, CompletionScreen | Shell omission only for available lessons; account Escape; correct/retry/heading focus; focus restoration after last holding/reset trigger disappears. | Alter layout while keeping named refs/IDs or equivalent tested focus paths; native elements help retain behavior. |
| **Medium: catalog vs persistence** — manifests/registry/seed, `getModuleProgress` | Available counts vs planned rows, published DB lessons, historical IDs/slugs and module title changes. | Keep existing route/ID mapping; status treatments can change appearance without granting access. |
| **Medium: responsive/token blast radius** — `learning-tokens.css`, `ql-*`, `.module.css`, PageFrame | Shared auth/marketing/product theme, existing alias consumers, container-query ordering, lg table/list swap, chart/table/form overflow. | Introduce/adjust semantic presentation deliberately, validate every affected family; avoid global marketing typography bleed. |

**Recommended migration seam:** preserve the existing route loaders, typed read models, feature actions/services/repositories, and pure calculation/evaluation functions. Lowest-coupling changes are semantic tokens and UI primitives followed by display-only sections (headers, metric rows, module/portfolio summaries) supplied with existing data/callbacks. Controller-heavy screens can keep their state/action code while their render trees adopt approved designs. A complete codebase rewrite is neither needed nor implied.

## 9. Missing information requiring product decisions

| Decision / uncertainty | Why it matters for Pen design | Present baseline to use until resolved |
| --- | --- | --- |
| **Current reward policy and naming** | AGENTS v1 vs committed v2; XP is visible; virtual-capital zero-state copy still implies finishing another lesson grants capital. | Explicitly show current 60 XP / one 5,000 Kč unlock behavior and preserve historical capital; mark alternative reward designs as pending decision. |
| **Dominant returning-learner CTA** | Recommendation can differ from latest saved active lesson; north-star instructions favor Continue learning. | Show both existing recommendation and conditional resume states; do not assume they always match. |
| **Personal holding-weight wording** | Current denominator excludes cash despite “weight in portfolio” wording. | Treat weights as allocation among invested holdings; changing denominator is a financial/product change. |
| **Checkpoint/planned-row consistency** | Foundations overview hides checkpoint; Learn journey includes it; Returns displays a locked checkpoint. | Preserve unpublished access and record the current variants before deciding visibility rules. |
| **All-lessons-complete destination** | Completion/Progress lead to Lab; Learn Recommendation has no next lesson and falls back to curriculum. | Design current all-complete variants; unifying the CTA is a separate behavior decision. |
| **Performance placeholder** | Personal portfolio chart has no series/actions. | Specify unavailable-history state; do not draw a functioning history chart as current scope. |
| **Quantity-only/locale input** | No cash-budget mode; quantity parser uses point while Czech lesson parser accepts comma; buy estimates may differ from execution. | Keep quantity and clearly estimated costs; budget mode/locale normalization needs explicit implementation scope. |
| **Provider deployment and geography** | FMP/Frankfurter implemented but active credentials/permissions unknown; US-only session calendar; old provider IDs can become unavailable. | Specify sample/market, partial/unavailable, closed/open/unknown separately; do not claim real-time universal coverage. |
| **Recovery/verification/account controls** | Account-security section manages login methods only. | Do not add functioning password/account/session controls to the inventory; decide separate scope if required. |
| **Adaptive learning and scenarios** | Recommendation metadata exists, but lesson adaptation/challenge persistence does not. | Reuse present lesson templates; defer new adaptive/challenge screens. |
| **Demo conversion and cleanup policy** | No verified permanent-account transfer flow; cleanup is manual operator command. | Label private demo/session lifetime and preserve isolation; do not promise conversion/transfer. |
| **Dark mode / languages** | Czech UI, light product theme, English fragments in technical previews/period labels; no locale/theme switch. | Design current Czech/light states with adequate string lengths; broader theming/i18n is separate scope. |
| **Pen V14.1 reference and final art assets** | External approved file was not available to this inventory. | Functional requirements here; obtain the approved visual reference for actual design work, without inferring its product functionality. |
| **Visual/assistive acceptance evidence** | Current browser scripts are defined but not run in this read-only audit; physical devices/screen readers and real OAuth are unverified. | Plan explicit browser/accessibility/provider acceptance during later UI migration; no claim of current universal compliance. |

These are decisions/verification needs, not recommended new features. Sol can design the verified baseline without inventing answers; unresolved behavior changes must be labeled separately from the migration.

## 10. Recommended order for designing existing screens in Pen

This is a handoff sequence, not a visual redesign proposal. For each group, specify the variants in section 5 and retain the data/action contracts above.

1. **Resolve reward/copy baseline and shared foundations.** Confirm v2 vs AGENTS, then map semantic colors/type/controls/focus/loading/feedback; distinguish product from approved marketing style. No need to redesign the completed landing page.
2. **Authenticated shell + Learn.** Establish Learn/Lab/Progress navigation, account menu, desktop/mobile frames, fresh/resuming/complete Learn, recommendation/resume distinction, and module journey display. This establishes product hierarchy for remaining screens.
3. **Module overview + complete lesson template family.** Available/active/completed/planned paths, focused lesson header, explanatory/formula/example blocks, numeric/choice/multi-numeric questions, correct/incorrect/retry/save states, explorer layouts, explicit Finish, completion/review/unlock. Use actual Foundations and Returns content, not invented lesson widgets.
4. **Portfolio unlock + Lab entry + Progress.** Design verified prerequisite/XP states, one-time grant context, daily/week progress, empty/latest completed lesson, all-complete variants. These connect learning to practice before financial screens.
5. **Portfolio page + search + reset/sell overlays.** Zero/funded-empty/populated/incomplete portfolio, desktop holdings/mobile lists, search keyboard/results/errors, sell quantity/error/pending/success, reset confirmation and focus return. Keep performance history visibly unavailable.
6. **Instrument detail + buy flow + analytics.** Equity/ETF/sample-bond variants, independent quote/history/analytics failures, line/candles/range/zoom/table, own position, quantity/review/execution, data freshness/provenance. These are part of the existing buy journey, not an optional later add-on.
7. **Backtesting sample tool.** Form, pre-run/results/dirty/error, four metrics, benchmark chart/data table, assumptions and metric-question state. Do not substitute real-instrument parameters or saved experiments.
8. **Onboarding, plan, optional personalization, retake, Settings.** Reuse approved lesson/form primitives; design actual preference/diagnostic steps and persistence/recovery states, account-method loading/link/unlink/provider-hidden variants.
9. **Sign-in/sign-up/demo entry + global boundaries.** Align auth forms/social/demo and error/loading/unavailable variants with product primitives; no invented recovery/verification flows. Check shell-free/auth/onboarding transitions against the earlier screens.
10. **Cross-screen state/responsive handoff audit.** Reconcile 320–1440px and 200% text, safe areas/virtual keyboard, focus/trap/Escape/return, chart alternatives, long values and missing-data semantics. Mark previews and planned curriculum as such. Attach each Pen frame to an actual route/component/state from this inventory.

## 11. Verification performed and later migration regression references

During this inventory:

| Check | Result |
| --- | --- |
| Initial git status/diff/stat/log/branch | Clean baseline, `main`, `107248f`; six recent commits inspected. |
| Source route/config/domain/UI/test/migration inspection | Completed; findings above reference concrete files and symbols. |
| `npm run lint` | Passed. |
| `node_modules/.bin/tsc --noEmit --incremental false` | Passed; no incremental build-info write. Equivalent project type check without emitting files. |
| `npm test` | Passed: **65 files, 633 tests**. This is Vitest node/mocked/static coverage, not browser or real DB proof. |
| Production build | Not run for this documentation-only inventory; production compilation/runtime acceptance remains unverified. |
| Database/migration/integration/concurrency harnesses | Inspected, not run; no database writes/migration/seed/cleanup performed. |
| Browser/responsive/accessibility/provider smoke | Scripts inspected, not run; no screenshots/new visual acceptance or external provider/OAuth requests. |

Relevant existing regression definitions for the later UI migration:

- Lessons/content/math: `src/features/lessons/{registry,question-evaluation}.test.ts`, Foundations content tests, Returns flow/content tests, `src/features/progress/{transition,actions}.test.ts`, `src/features/finance/*.test.ts`.
- Rewards/unlocks/continuity: `src/features/{rewards,progression,gamification,learning,personalization}/*.test.ts`; tests explicitly protect current v2 rewards, prerequisites, legacy and recommendations.
- Money/ledger/providers/charts: `src/features/portfolio/{decimal,domain,market-data,actions,presentation}.test.ts`; decimal cases include 0.1, 0.25, 1.3333 and exact FX/minor-unit rounding. `src/features/market-data/**/*.test.ts`, `src/features/instruments/*.test.ts`, lab chart/analytics tests, `src/features/lab/backtest.test.ts` protect source and calculation semantics.
- Persistence/concurrency: `scripts/validate-persistence.mts`, `validate-practice-capital-migration.mts`, `validate-portfolio-{persistence,migration,closed-market}.mts`, `validate-progression-persistence.mts`, `validate-personalization-persistence.mts`, `validate-log-returns-persistence.mts`, `validate-curriculum-seed.mts`. Portfolio suite includes concurrent buy/sell/reward, duplicate request, reset retention, demo isolation and cascades. Inspect each script's guards before using a disposable QA database; do not run migration fixtures against the normal development DB.
- Browser: `scripts/validate-product-shell.mjs` covers shell/Backtesting; `validate-progress.mjs` covers fresh/partial/threshold/unlocked overview and eight widths; `validate-foundations.mjs`, `validate-returns-flow.mjs`, `validate-log-returns.mjs` cover lesson loop/persistence-facing UI; `validate-portfolio-lab.mjs`, `validate-portfolio-closed-market.mjs`, `validate-instrument-unavailable.mjs` cover sheets/trades/valuation; `validate-personalization-{browser,compatibility}.mjs`, `validate-auth.mjs`, `validate-design-system.mjs`, `validate-marketing.mjs` cover their areas. Many include keyboard, reduced-motion and 200% text checks. Auth suite intercepts external OAuth navigation rather than completing real Google/Meta consent.

Later implementation should use a fresh isolated acceptance runtime after build, validate relevant suites without weakening assertions, and audit the diff. For this inventory no commit/push was requested. The expected final working-tree change is this report only.
