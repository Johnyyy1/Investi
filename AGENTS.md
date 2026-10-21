<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

AGENTS.md

Project: Investník

Investník is an interactive investing-education product built around the principle:

Learn investing by doing.

The product prepares people to start investing and maintain a plan: financial readiness, practical Czech investing workflows, costs, taxes, and behavior come before advanced analysis. Concepts and quantitative tools serve decisions. Investník remains educational, without pretending to be a real broker or giving investment advice.

This file defines how coding agents should work in this repository.

The product direction adopted on 2026-10-21 is recorded in [docs/product-direction.md](docs/product-direction.md). Read it before changing curriculum, learning progression, Lab behavior, rewards, or product priorities. It defines the target direction; inspect code and [docs/product-reset.md](docs/product-reset.md) for current implementation and compatibility contracts. Older descriptions of a metrics-first course or portfolio-value-first hierarchy do not override this direction.

1. Start every task by inspecting the repository

Before editing anything, always run:

git status
git diff
git diff --stat
git log -6 --oneline
git branch --show-current

Then inspect the relevant code, tests, migrations, and bundled framework guidance.

Never assume the working tree is disposable

If there are existing uncommitted changes:

preserve them;

inspect them before editing;

continue from the current state unless the user explicitly asks to reset;

never run git reset --hard, destructive checkout commands, or discard another agent's work.

Do not switch branches unless explicitly requested.

2. Product north star

The primary product promise is milestone A: "Připraven/a začít". A learner can assess financial readiness, verify and compare brokers, understand total costs and Czech tax obligations, and write an investment policy statement (IPS) tested in a simulated crisis.

Prioritize decisions that prevent costly mistakes: financial readiness, costs, taxes, planning, and behavior. Expand stock analysis, valuation, and quantitative methods after the practical path. Advanced tracks are optional; they are not prerequisites for becoming a capable passive investor.

The core learning loop is:

LEARN
→ MAKE A DECISION
→ PREDICT
→ TEST / REVEAL
→ SEE CONSEQUENCES
→ UNDERSTAND WHY
→ SET A PERSONAL SAFEGUARD / UPDATE THE PLAN
→ RETRY / CONTINUE

The major product areas are:

Learn
→ Practice Capital
→ Portfolio Lab
→ Scenario Challenges
→ Backtesting Lab

These should feel like one connected product, not separate tools.

Curriculum architecture

The target is seven levels and one continuous behavioral strand:

| Level | Learner-facing name | Focus |
| --- | --- | --- |
| 0 | Než začneš investovat | Budget, expensive debt, reserve, goals, retirement saving, fraud prevention |
| 1 | Jak investice fungují | Existing Foundations plus fund types and active vs passive investing |
| 2 | Investování v Česku v praxi | Broker/account, total costs, EU products and ETF selection, Czech taxes, IPS and a first practice purchase |
| 3 | Portfolio: stavba, údržba, měření | Returns, risk, diversification, allocation, contributions and rebalancing |
| 4 | Analýza akcií | Base rates before stock picking, business analysis, financial statements, ratios and their limitations |
| 5 | Oceňování a investiční teze | Valuation, scenarios, reverse DCF, thesis, pre-mortem and review |
| 6 | Kvantitativní metody | Return mathematics, factors, risk models, backtest bias and uncertainty |
| B | Investor v zrcadle | Behavioral practice woven through lessons and decisions in Lab |

Optional modules on leverage/derivatives, crypto, and critical examination of technical analysis teach risks and limitations. They do not expand the persistent portfolio's trading permissions.

Milestones:

- A — "Připraven/a začít": readiness outcomes from levels 0–2, behavioral core B1–B4 and B9, IPS, a practice purchase, and the B10 crisis exercise. Level 0 is recommended and can be tested out of; its financial check-up is not pass/fail.
- B — "Samostatný pasivní investor": A + level 3 + the full behavioral strand and portfolio-maintenance capstone.
- C — "Samostatný analytik akcií": B + levels 4–5 and a documented analysis/valuation/thesis capstone.
- D — "Kvantitativní investor": B + level 6. C is not a prerequisite for D.

Do not mark milestone A complete before its practical and crisis outcomes exist, even if foundational content ships in an earlier phase.

Curriculum continuity

Preserve every existing lesson and stable internal ID, saved progress, original completion timestamps, reward receipts, and recorded Lab access. Display codes such as 3.1.1 are not persistence identities. The source brief describes an earlier product inventory; verify current published/authored content in code rather than treating historical counts as a live inventory.

The curriculum registry in src/features/learning/curriculum.ts separates level, pedagogical module, order, prerequisites, skill tags, and required/optional status from stable identity. Reuse this registry and preserve existing routes or provide compatibility redirects when moving lessons.

Map Foundations to level 1; ordinary Returns to 3.1; volatility to 3.2; correlation/diversification to 3.3; log returns to 6.1; real-data correlation to 6.2; correlation vs causation to B8. Do not delete advanced lessons to simplify the beginner path.

Completed lessons count in their new location, but do not imply completion of newly added material. An expanded module can become in progress while its old lesson completions remain intact. Any mastery state is separate from lifetime completion and reward eligibility.

Curriculum placement must not accidentally alter rewards or unlock prerequisites. Policy v4 resolves reward eligibility from the registered curriculum level, independently of the storage module. Preserve its eligibility semantics or change them through a deliberate versioned domain migration. Adding new level-1 lessons must not expand the frozen seven-lesson Lab prerequisite, relock existing learners, or repeat their unlock grant.

Implementation order

1. Foundations for milestone A: lesson registry/remapping, dated fact registry, level 0, costs (2.2), taxes (2.4), broker/account (2.1), IPS template, and explainable process feedback with realistic Lab costs, conversion and tax-lot education.
2. Behavior and maintenance: B1–B4/B9/B10, decision-time cards, MWR/TWR, ETF selection, allocation/rebalancing, spaced review/mastery, baseline measurement, and prospective Practice Capital changes.
3. Complete milestone B: remaining behavior lessons, capstone, adaptive entry assessment, retention checks and evaluation of decision-time cards.
4. Stock analysis, financial statements and contextual ratio limitations.
5. Valuation, reverse DCF and a thesis journal with later review.
6. Quantitative methods, backtest overfitting exercises and optional modules.

This is prioritization for scoped implementation tasks, not a live implementation checklist. Inspect completed work first, reuse the existing curriculum registry, learner artifacts and Portfolio Lab costs, and implement the remaining scope. Complete explicitly requested maintenance or fixes without using the roadmap to expand their scope.

Success measures

The target north star is the share of milestone-A learners who follow their own IPS during a simulated crisis, supported by retained skills at "Zvládnuté" or above. Assess knowledge, delayed retention, rubric-based outputs, and behavior in simulation. Time in app, streak length, trade count, and investment return are not success measures.

Do not infer real-money readiness or a causal education effect from simulated returns. Real-world follow-up is voluntary and opt-in. Review schedules, mastery thresholds, and experiment designs in the brief are design proposals to validate, not research-established constants.

Product positioning

Investník is:

educational;

interactive;

beginner-friendly;

data-aware;

grounded in Czech investing practice;

focused on planning, long-term habits, and explainable decisions;

progressively more analytical through optional advanced tracks.

Investník is not:

a real broker;

a real-money trading platform;

a day-trading simulator;

an investment-advice engine;

a crypto-style gamification product;

a generic SaaS dashboard.

3. Tech stack

Current stack:

Next.js App Router

TypeScript

React

Tailwind CSS v4

shadcn / Radix primitives where appropriate

PostgreSQL

Drizzle ORM

Better Auth

Zod

Vitest

Playwright / browser validation

Recharts

Motion (motion/react)

KaTeX

Lucide

Manrope + Inter (next/font)

Local PostgreSQL has historically used Docker and host port 5433.

Do not change core stack choices without an explicit architectural reason.

4. Information architecture

Primary authenticated navigation:

Learn

Lab

Progress

Settings/account controls live behind the account area.

Active lesson routes intentionally bypass the normal app shell to keep lessons focused.

Do not casually add top-level navigation items.

5. Brand and visual system

Brand

Always write the product name as:

Investník

The product was called investi until 2026-10-21. Use investnik without diacritics only in the domain (https://investnik.cz is canonical; www redirects to it), technical identifiers, slugs and filenames; never write Investnik in visible Czech copy. The wordmark is the shared Wordmark component (the í symbol plus the typeset name); a wordmark link names its target in aria-label ("Investník · úvodní stránka", "Investník · Učení"). docs/brand.md records the identity, assets and domain setup.

Existing technical identifiers that start with investi (browser-storage keys, market-data provider and dataset IDs, fee-profile IDs, the anonymous-kind header, CSS hooks, log prefixes, INVESTI_PERF_DEBUG, QA database names, public/investi-assets) are persisted or relied on elsewhere. Keep them; do not rename them for cosmetic consistency.

UI terms follow the glossary in docs/terminology.md.

Primary line:

Learn investing by doing.

Brand personality

Intelligent

Approachable

Playful

Direct

Optimistic

The product should feel roughly:

50% intelligent learning product

35% playful consumer brand

15% serious finance/data product

Core palette

The palette lives in src/styles/tokens.css as semantic roles; DESIGN.md and docs/design-system.md describe them. The anchors:

Paper (background): #F7F2E8

Surface: #FFFCF7

Ink (foreground): #171717

Action Teal (primary): #236F66

Graphic Teal (progress): #2F8F83

Soft Teal (primary-soft): #E6F0E9

Butter (warning): #F1C75B

Error Ink (danger): #A63D28

Use the semantic tokens; do not hard-code colors. There is one primary action style everywhere: the shared Button component (src/components/ui/button.tsx).

Typography

Use Manrope for headings and Inter for UI and reading text, through the font tokens (--font-display, --font-sans). Do not add another UI font.

Marketing can be expressive and large.

Product UI should be quieter, denser, and more functional.

6. Visual anti-patterns

Avoid:

generic SaaS card grids;

excessive card soup;

gradient text;

glow-heavy interfaces;

neon trading-terminal visuals;

fake social proof;

fake logos;

random color usage;

excessive pills;

glassmorphism everywhere;

generic AI-generated finance decoration;

candlestick charts used as decoration;

crypto-bro visual language;

3D finance objects used without purpose;

decorative AI orbs;

giant marketing typography inside product screens.

Do not make every section a separate bordered card.

Use hierarchy, spacing, typography, and restrained surfaces first.

7. Marketing vs product

Marketing

Marketing may be more expressive, visual, and brand-led.

Product

The authenticated app should be:

calm;

functional;

precise;

readable;

beginner-friendly;

clearly related to the marketing brand, but quieter.

Do not copy marketing clouds, hills, oversized gradients, mascots, tilted cards, or decorative 3D scenes into normal app screens.

Mascot usage, if any, should be rare and purposeful:

onboarding;

lesson completion;

meaningful milestone;

empty state.

Do not place the mascot everywhere.

8. Learn and lesson UX

Before authoring or revising lessons, read [the Lesson 2.0 authoring standard](docs/education/lesson-standard.md). It defines the learning structure, Czech terminology, dated facts, stable IDs and published-lesson compatibility rules, with copyable lesson/test templates and a review checklist.

Before editing a published lesson, also follow [published lesson compatibility](docs/education/published-lesson-compatibility.md): preserve identity, saved-step and grading contracts, completed status, and reward receipts.

Lesson UI comes from the approved design, not from the agent. Compose lessons only from the step kinds in [the step-kind catalog](docs/education/lesson-steps.md) (`fadedExample`, `documentTap`, `findError`, `personaDecision`, `labMission`, `factNotice`, `writtenReflection` and the earlier blocks). Each kind already has a renderer matching the Pen boards exported to docs/design/lesson-steps; preview them at /dev/lesson-steps. When authoring a lesson:

- do not create new lesson components, styles, colors or layouts, and do not restyle the existing renderers;
- copy the data shape from src/features/lessons/specimens/time-test.ts and write new, fictional content;
- take tax/regulatory numbers from the fact registry via `factNotice`, never as literals;
- if the lesson needs a step kind that does not exist, stop and report it in the PR instead of inventing one;
- attach 390 px and 1440 px screenshots of every step to the PR and compare them with the matching PNGs.

Adding or changing a step kind is a separate implementation task: update the design export, types, `evaluateQuestion`/`feedbackFor`/`answer-keys` for graded kinds, the renderer, specimens, tests and the catalog together.

Product screens outside lessons have approved designs too: the Learn level map, entry assessment, module/checkpoint, IPS, crisis exercise, milestone-A project, tax-lot map, decision-time cards, process feedback, backtest attempt counter and skill-based Progress. [docs/design/product-screens.md](docs/design/product-screens.md) lists them with their PNGs, data sources and open questions (NQ-20 to NQ-47). When implementing one, follow its PNGs and components instead of designing your own, take numbers from the authoritative data rather than the illustrative values in the designs, and state in the PR which open-question recommendations you applied. These designs do not authorize domain changes on their own: reward, persistence and financial work keeps its own rules above.

The Learn page must answer quickly:

What should I do next?

For a returning learner, Continue learning is the dominant action.

Do not turn Learn into a dashboard with many equal-priority panels.

Lesson loop

Lessons should preserve:

interaction
→ answer
→ feedback
→ persisted continuation
→ completion
→ reward
→ next

Lesson screens should be focused.

Keep:

clear concept hierarchy;

short explanations;

interaction as the central object;

predictable Continue placement;

secondary Previous navigation;

accessible feedback states;

completion state;

mobile usability.

Do not change lesson completion semantics while doing visual work.

Learning design target

Teach in the order of real decisions. Use a worked example, a partially completed example, an independent task, retrieval questions, and a short self-explanation. Tie each new metric to a decision, its assumptions, and when it misleads.

Modules end in mixed checkpoints; levels end in practical projects assessed with an explicit four-level rubric. Prefer tasks using fictional broker tariffs, KIDs, statements, ETF checklists, IPS templates, and Lab missions over calculation-only quizzes.

The target progression is a prerequisite/skill graph with an adaptive entry assessment (including "Nevím"), a test-out route, and spaced mixed review. Preserve the dominant Continue action while recommending eligible next lessons and relevant review.

Target mastery labels are "Zkoušeno → Známé → Zvládnuté → Ovládnuté". The highest state requires delayed mixed retrieval and may decline with evidence; this must never erase lifetime lesson completion, revoke recorded access, or reissue first-completion rewards. Exact thresholds, question counts and scheduling models belong in an explicit implementation specification.

Behavioral learning follows experience in simulation → explanation using the learner's decisions → a learner-chosen safeguard. Use IPS, automation, checklists, turnover budgets, review frequency, and pre-mortems as concrete outputs. Address home bias and familiarity as well as overconfidence, loss aversion, disposition effect, FOMO, anchoring, and mental accounting.

Decision-time cards should explain relevant consequences at the point of action: turnover and costs, selling winners while holding losers, repeated backtest selection, or a tax-lot timing decision. Triggers need explicit rules and data; do not diagnose a bias as fact from a single action.

9. Practice Capital

Practice Capital is the spendable learning reward for Portfolio Lab. XP measures learning progress, stays visible to the learner, and gates the Portfolio Lab unlock. Issue #35 decided to keep XP visible but secondary: Progress leads with completed lessons and receipt-derived Practice Capital, and shows XP as a quiet learning measure. Do not hide XP or remove it from the unlock condition without a new product decision.

Reward direction

Reward learning, retained understanding, and documented process. Never grant XP or Practice Capital for placing trades, trading frequency, taking more risk, or achieving a return. No return leaderboards, trade confetti, lottery rewards, or prompts to trade because of inactivity. Do not add price-movement notifications. Learning streaks should support learning/review rather than Lab activity.

The target evolution is mastery-linked awards, monthly Practice Capital income in an isolated simulated-time training portfolio (#139), and process milestones such as an IPS or completing a crisis exercise according to plan. Keep the personal portfolio's receipt-derived entitlement intact. Implement these prospectively through a versioned reward/disbursement policy with explicit eligibility, scheduling, idempotency, and migration tests. Distinguish earned entitlement, scheduled disbursements, contributed capital, and available cash; all must remain auditable and contributions must never become returns.

This direction does not retroactively claw back or reschedule earned capital, recalculate receipts, or change the existing lesson-based streak contract. Until a scoped implementation deliberately replaces them, preserve policy v4 and the learning contracts below.

Reward policy

Current policy (reward policy v4, issue #120, 2026-10-21). The code is the source of truth for the amounts and the XP goal: lessonReward in src/features/rewards/practice-capital.ts resolves the curriculum level from the registry; src/features/progression/unlocks.ts defines access. docs/product-reset.md records the decision, alternatives and history.

first completion of a lesson in L0, L1 (including Foundations), or the behavioral strand B
= XP only
= 0 Practice Capital

completing the original seven Foundations lessons and reaching 420 XP
= one-time Portfolio Lab unlock grant
= 500000 CZK minor units
= 5,000 Kč Practice Capital

first completion of a lesson in L2–L6 or V
= 200000 CZK minor units
= 2,000 Kč Practice Capital

The lesson reward follows its registered curriculum level, not its storage module or completion order. Eligible capital earned before the unlock becomes usable once Portfolio Lab opens. A lesson needs a registry placement before it can earn a new receipt; never fall back to storage-module eligibility. The behavioral lesson correlation-not-causation is XP only for new v4 receipts, while its old v3 receipts keep their capital.

Checkpoint 1 and newly published L1 lessons do not expand the frozen seven-lesson Lab prerequisite. Recorded access and grants are preserved.

Review / repeated completion:

0 additional XP or Practice Capital

Stored receipts keep the amount and policy version they were created with (v1: 2,000 Kč per lesson; v2: XP only; v3: XP only in Foundations and 2,000 Kč elsewhere) and are never recalculated or backfilled for v4.

V4 pays the full eligible amount on first completion. Split mastery awards await #122; review-based streak credit awaits the persisted daily-review contract in #123. Until then, the existing first-completion lesson streak remains intact. Process bonuses (IPS, crisis, capstones) require verified outputs, explicit amounts, eligibility and an idempotent receipt policy before activation; v4 introduces none. Monthly disbursements await an isolated training portfolio in #139; the personal portfolio keeps receipt-derived entitlement.

Never award XP, Practice Capital, learning-day credit or streaks for a trade, trading frequency, risk or return. Do not add trade confetti, return leaderboards or price notifications. Apply the reward/process checks in .github/PULL_REQUEST_TEMPLATE.md when reviewing changes.

Practice Capital must never be derived from XP.

Source of truth

Practice Capital is derived from authoritative lesson reward receipts plus recorded progression unlock grants (the Portfolio Lab unlock and the demo access grant).

Do not create a mutable user balance counter unless architecture is deliberately changed later.

Money representation

Use integer minor units for canonical money accounting.

Do not use JavaScript floating-point numbers as the accounting source of truth.

Formatting belongs at presentation boundaries.

10. Portfolio Lab accounting invariants

The persistent Portfolio Lab is an educational paper portfolio.

Important definitions

Earned Practice Capital
= sum of legitimate Practice Capital receipts
+ sum of recorded unlock grants

Cash
= contributed capital
+ sell proceeds
- buy costs
- fees

Holdings market value
= Σ quantity × current quote × FX

Portfolio total
= cash + holdings market value

Investment gain/loss
= portfolio total - contributed Practice Capital

Critical invariant

If the learner earns another 2,000 Kč through learning:

Practice Capital: +2,000 Kč
Cash:             +2,000 Kč
Investment P&L:   unchanged

Learning rewards are external contributions, not investment performance.

Never count them as return.

11. Portfolio persistence model

The portfolio uses generations.

A reset should:

close the active generation;

create a clean generation;

restore all legitimately earned Practice Capital as available capital;

preserve lesson progress;

preserve reward receipts;

preserve old trades;

preserve old generations for auditability.

Only one active portfolio generation may exist per user.

Do not delete old trade history during reset.

12. Trade ledger rules

Trades are append-only.

Do not create or mutate a position table as the source of truth unless a later performance projection explicitly requires one.

Holdings should be derivable from ordered immutable trades.

V1 trading rules

long-only;

no shorting;

no leverage;

no margin;

no negative cash;

fractional quantities allowed;

cannot sell more than held quantity.

Client must never authoritatively submit

execution price;

FX rate;

portfolio value;

cash balance;

cost basis;

P&L;

Practice Capital balance.

The server must determine these values.

13. Financial precision

Current persistence conventions may include:

money: bigint minor units;

quantity: fixed-precision numeric;

price: fixed-precision numeric;

FX: fixed-precision numeric.

Use centralized rounding rules.

Do not introduce divergent rounding behavior in UI, domain, repository, or tests.

When changing financial code, explicitly test decimal edge cases such as:

0.1

0.25

1.3333

FX values with multiple decimal places

amounts that round to non-obvious minor-unit values

14. Idempotency and concurrency

Financial operations must be safe under retries and concurrent requests.

Preserve:

one first-completion reward per user/lesson;

trade idempotency keys;

reset idempotency;

row locking / serialization strategy;

no overspending from concurrent buys;

no overselling from concurrent sells;

no lost reward when lesson completion and trade happen concurrently.

Do not weaken concurrency tests.

15. Market data architecture

Market data is provider-agnostic.

Conceptual boundary:

Investník domain/application
        ↓
MarketDataService
        ↓
MarketDataProvider
        ↓
provider adapter

Domain/UI code must not depend on provider-specific field names.

Normalized concerns

Market data should represent:

stable internal instrument identity;

symbol;

name;

asset type;

exchange / MIC where available;

quote currency;

observation time;

retrieval time;

provenance;

freshness;

adjustment mode;

completeness.

Do not silently substitute

raw prices;

split-adjusted prices;

total-return series.

Those are distinct semantics.

Missing data

Missing quotes or FX must never become zero.

Return an explicit incomplete/unavailable valuation state.

16. Deterministic vs live data

Deterministic sample data is used for stable development/demo/testing.

It must be labeled truthfully as:

Sample data;

Educational data;

Deterministic sample data.

Never label deterministic fixtures as:

Live;

Real-time;

Current market price.

When live providers are eventually connected, keep provider-specific behavior behind the existing abstraction.

17. Portfolio Lab UX principles

The Portfolio Lab is a rehearsal for maintaining an investment plan. Keep familiar investing interactions and connect each decision to learning, costs, diversification, and the learner's IPS. Choosing to wait or keep the plan can be a successful outcome.

Core flow:

SEARCH
→ SELECT INSTRUMENT
→ CHOOSE AMOUNT / QUANTITY
→ REVIEW
→ BUY
→ SEE HOLDING
→ UNDERSTAND PORTFOLIO IMPACT
→ CHECK AGAINST THE PLAN

Main hierarchy

Prefer:

Process feedback as the primary educational summary: diversification/concentration (including HHI where supported), total costs, turnover, alignment with IPS, and cash drag in the context of the plan;

portfolio value, holdings and available cash clearly visible for orientation;

investment P&L as context, with separately explained MWR and TWR when supported;

Practice Capital as learning context;

one easy-to-find + Invest action when appropriate, without pressure to trade;

holdings;

allocation;

recent activity;

destructive reset actions de-emphasized.

"Skóre procesu" means explainable criteria and feedback first. Do not invent an aggregate 82/100, universal ideal allocation, or unsupported thresholds. Any composite needs a documented model; absence of data means unavailable, not failure. Do not penalize appropriate cash reserves or reward needless rebalancing to increase activity.

Realistic friction is part of the learning target: fictional broker fee profiles, FX spread, recurring simulated contributions, tax-lot maps, and dated educational sale-proceeds checks. Show assumptions and costs before confirmation. Fees, FX and accounting remain authoritative on the server; introducing them is a financial-domain task, not a visual change.

MWR/TWR, process metrics, and tax-lot tools must use sufficient authoritative data and documented conventions. Until implemented, do not display fabricated values or imply current coverage. Historical/crisis exercises use isolated scenario state; they must not mutate the persistent portfolio's trades or valuation clock.

Avoid

always-open buy forms;

inline sell forms that expand into the page;

equal visual weight for every metric;

giant empty sections;

oversized explanatory copy;

permanently promoted Reset Portfolio action.

Empty state

A beginner with capital but no holdings should see a clear first practice action connected to an IPS or guided mission, without implying urgency to invest.

A user with zero Practice Capital should be directed back to learning. No cash or holdings is not a reason to encourage extra trades or paid deposits.

18. Scenario challenges

Scenario challenges are a future/ongoing learning layer.

Core model:

Theory
→ Scenario
→ Decision
→ Prediction
→ Lock
→ Reveal
→ Outcome
→ Explanation
→ Retry

Scenario portfolios must remain separate from the user's persistent personal portfolio.

A challenge must not secretly buy/sell assets in the learner's normal portfolio.

Scoring

Avoid arbitrary composite scores such as 82/100 unless they have an explicit justified model.

Prefer deterministic, explainable rules such as:

Largest position: 22%
Target: ≤25%
Status: Pass

Outcome performance should not determine whether a concept such as diversification was "correct."

Behavioral scenarios should end with a safeguard or plan revision and assess the learner's stated IPS. A crisis exercise tests process under stress, not whether the learner guessed the market recovery. Present criteria and data limitations explicitly.

19. Backtesting Lab

Backtesting answers:

How would this idea have behaved?

Portfolio Lab answers:

What do I own?

Do not conflate the two.

Teach costs, benchmarks, rebalancing, look-ahead/survivorship bias, overfitting, multiple attempts, and out-of-sample limitations alongside backtest results. The target includes an intentional overfitting exercise and an attempt counter; these are educational tools, not rewards for optimizing historical return. A favorable historical result is not evidence of a sound real-world strategy.

A future Backtest this portfolio flow should normalize current portfolio holdings into a frozen allocation/specification snapshot.

Do not backtest the user's live transaction history directly unless the product explicitly adds that separate feature.

Backtests should eventually separate:

specification validation;

normalized historical data;

simulation;

metrics;

diagnostics;

presentation.

20. Backtest metrics and conventions

Be explicit about conventions.

Current/future metrics include:

Final Value

CAGR

Max Drawdown

Annualized Volatility

Do not fabricate or imply metrics that the current data does not support.

When periodic cash flows are introduced, naive CAGR may not be sufficient.

Do not silently mix:

price return;

total return;

money-weighted return;

time-weighted return.

Explain each metric's meaning, input requirements, period, currency, costs, cash flows, and limitations. A difference between MWR and TWR can support reflection on cash-flow timing; it is not by itself proof of a behavioral mistake.

20a. Czech tax, regulatory, and research facts

Treat changing factual values as dated data, not constants embedded in lesson prose. The target fact registry stores value/unit, jurisdiction, effective-from/to dates, source URL, last verification, owner, and next review date. Lessons reference fact keys/tokens; historical scenarios resolve the rule for the scenario's date rather than silently applying today's rule.

Tax lessons visibly state "vzdělávací obsah, ne daňové poradenství; stav k [datum]". Overdue facts need editorial flags and visible freshness warnings when applicable. Plan tax-adviser review before publishing tax lessons; keep unresolved facts explicitly marked as requiring verification.

The supplied direction brief is a product/research input, not an independently verified legal or market-data source. Verify tax limits, holding periods, exemptions, exchange-rate conventions, investor compensation, W-8BEN/treaties, DIP/pension rules, and PRIIPs/UCITS against current primary sources before publication or implementing educational calculations. Do not hard-code the brief's example amounts or present unknown rules as settled.

Keep securities and crypto rules distinct, sale proceeds distinct from gains, trading FX distinct from tax FX, and individual tax lots distinct from aggregate holdings. Educational tax maps are not a personalized tax filing service.

Keep the brief's maintenance cadence: annual January tax/rate checks, filing-season checks, monthly macro inputs, semiannual product/research reviews, and ad hoc legislative updates. These are content-maintenance requirements, not an instruction to create scheduled jobs automatically. Record the sample, period, and limitations behind research claims; do not present findings from other learning domains or paper portfolios as proven effects for Investník.

21. Demo users

Demo users use isolated Better Auth anonymous identities.

Preserve:

isolation;

deterministic seed behavior;

idempotence;

cleanup lifecycle;

cascade deletion for user-owned records.

Do not overwrite a demo user's mutations on every visit.

Shared instruments or shared market-data caches should not cascade with user deletion.

22. Accessibility

Accessibility is not optional.

For relevant UI, verify:

keyboard navigation;

visible focus;

correct labels;

semantic tables/lists;

dialogs with accessible titles/descriptions;

focus trapping where modal;

Escape behavior;

focus return to trigger;

touch targets roughly 44–48px where practical;

reduced motion;

no color-only status;

no horizontal overflow;

200% text compatibility.

Do not solve overflow by shrinking essential text.

Fix layout/reflow instead.

23. Responsive expectations

Common validation widths:

1440

1024

768

390

375

320

Do not simply collapse desktop tables on mobile.

Use intentionally designed mobile layouts.

For finance/data screens, prefer structured lists/cards over forced horizontal scrolling when possible.

24. Testing expectations

Before committing meaningful changes, run the relevant subset and then the full gates.

Typical static gates:

npm run lint
npm run typecheck
npm test
npm run build

Run database/integration/concurrency validation whenever financial or persistence behavior is touched.

Run browser suites against a clean runtime.

Important regression areas

product shell

Learn

Foundations

Returns

learning loop

onboarding

Practice Capital

persistence

Portfolio Lab

Backtesting

demo

design system

marketing

Do not weaken tests just to get green output.

If an assertion is wrong because the product contract changed deliberately, update the assertion to the approved semantics.

When implementing the new direction, cover stable-ID remapping, old route compatibility, prerequisites and new-content module status, preserved completions/receipts/unlocks, mastery vs completion, review scheduling, dated facts, process rubric rules, and scenario isolation as relevant. Reward/disbursement or fee/FX changes require exact-arithmetic, retry and concurrency coverage. Documentation-only tasks need diff, link and consistency checks; application, database and browser gates apply when their behavior changes.

25. Clean runtime rule

Next.js dev/prod artifacts can become inconsistent after builds.

If a long-running dev server was active before next build, do not assume it is still a valid acceptance runtime.

Use a fresh isolated server/port for final browser validation when needed.

Do not kill unrelated user processes unless necessary.

26. Dev-only routes

Development-only diagnostic routes may intentionally return 404 in production.

Validate them under the correct runtime.

Do not treat an intentional production 404 as a product regression.

Do not expose dev diagnostics in production navigation.

27. Git discipline

Before commit:

git status
git diff
git diff --stat

Review every changed file.

Do not include unrelated user files.

Do not commit editor files, local notes, or unrelated Obsidian content.

Never force-push unless explicitly instructed.

After push:

git status
git log -1 --oneline

Confirm local branch matches remote.

28. Commit discipline

Each implementation phase should ideally:

have a narrow scope;

preserve previous phase behavior;

include tests;

include migration safety where applicable;

end with one clean commit;

be independently understandable.

Suggested commit style:

feat: ...
fix: ...
refactor: ...
test: ...

Do not bundle unrelated refactors into feature work.

29. Migration discipline

Migrations should be additive whenever possible.

Never rewrite old migrations after they are in use.

For data migrations:

use authoritative source data;

make backfills idempotent;

test rerun behavior;

test partially migrated states where relevant;

do not reset the user's normal development DB as part of validation.

Use expand → backfill → cutover → contract for risky schema transitions.

30. Security and authority boundaries

For authenticated mutations:

verify session;

verify ownership;

validate inputs;

resolve authoritative server-side values;

use transactions where needed;

prevent duplicate mutation;

return structured errors.

Never trust client-supplied financial state.

Never expose provider secrets or server-only adapters to client bundles.

31. Error handling

Normalize errors at domain/application boundaries.

Do not leak:

raw database errors;

provider internals;

stack traces;

secret values.

UI errors should be concise, actionable, and recoverable.

Do not silently convert failures into zero values.

32. Performance

Do not prematurely optimize accounting by introducing mutable projections.

Correctness and auditability come first.

If a projection/cache is added later:

it must be rebuildable from authoritative data;

it must not become an undocumented second source of truth.

Avoid unnecessary client-side bundles for server-only logic.

33. When doing a UI-only task

If the task is explicitly presentation/interaction only:

Do not modify:

schema;

migrations;

financial domain logic;

reward semantics;

auth;

persistence contracts;

provider contracts;

concurrency;

server authority.

If a desired UX requires a domain change, stop and report it as a follow-up rather than quietly expanding scope.

34. When doing a domain/financial task

Before changing financial logic:

identify the current invariant;

add/update pure domain tests first;

add integration/concurrency coverage;

preserve auditability;

validate exact arithmetic;

run the full regression matrix.

Financial correctness takes precedence over UI convenience.

35. When continuing another agent's run

If the previous agent hit a quota/rate limit:

preserve the current working tree;

inspect status/diff/log first;

treat existing implementation as approved unless tests reveal a real bug;

finish validation;

avoid restarting the feature from scratch;

do not redesign already reviewed work;

commit and push only after final gates pass.

36. Definition of done

A task is not complete until:

requested scope is implemented;

unrelated behavior is preserved;

lint passes;

typecheck passes;

unit tests pass;

relevant DB/integration/concurrency tests pass;

relevant browser tests pass;

responsive/accessibility checks pass where applicable;

diff is audited;

commit is created if requested;

push succeeds if requested;

working tree is clean except explicitly preserved unrelated files.

37. Final agent report

At the end of a substantial task, report:

what changed;

what intentionally did not change;

architecture/invariants preserved;

validation performed;

test/build results;

migration/database results if applicable;

browser/accessibility results if applicable;

commit hash if committed;

pushed branch if pushed;

final working-tree status.

Do not claim success for checks that were not actually run.

38. Highest-priority invariant

When in doubt, prefer:

Correct, explainable, auditable educational finance behavior over flashy UX or implementation shortcuts.

And for product design:

Prepare the learner to make and maintain an investment plan. Keep the workflow familiar, teach at the moment of decision, and judge the process rather than the return.
