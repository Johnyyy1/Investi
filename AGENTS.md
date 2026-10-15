<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

AGENTS.md

Project: investi

investi is an interactive investing-education product built around the principle:

Learn investing by doing.

The product should teach users concepts, let them make decisions, show consequences, and gradually prepare them for real-world investing workflows without pretending to be a real broker or giving investment advice.

This file defines how coding agents should work in this repository.

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

The core learning loop is:

LEARN
→ MAKE A DECISION
→ PREDICT
→ TEST / REVEAL
→ SEE CONSEQUENCES
→ UNDERSTAND WHY
→ RETRY / CONTINUE

The major product areas are:

Learn
→ Practice Capital
→ Portfolio Lab
→ Scenario Challenges
→ Backtesting Lab

These should feel like one connected product, not separate tools.

Product positioning

investi is:

educational;

interactive;

beginner-friendly;

data-aware;

progressively more analytical;

suitable for a path from first investing concepts toward quantitative thinking.

investi is not:

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

Nunito Sans

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

investi

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

Warm White: #F8F6F0

Investi Blue: #2498F3

Deep Blue: #1667B2

Navy: #17324A

Pale Blue: #DFF2FF

Investi Green: #42C98A

Warm Accent: #FFB85C

Data Dark: #102D4C

Prefer existing semantic design tokens rather than hard-coded colors.

Typography

Use Nunito Sans.

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

9. Practice Capital

Practice Capital is the spendable learning reward for Portfolio Lab. XP measures learning progress and gates the Portfolio Lab unlock.

Reward policy

Current approved policy (reward policy v3):

first completion of a Foundations lesson
= XP only
= 0 Practice Capital

completing all Foundations lessons and reaching the XP goal
= one-time Portfolio Lab unlock grant
= 500000 CZK minor units
= 5,000 Kč Practice Capital

first completion of any lesson outside Foundations
= 200000 CZK minor units
= 2,000 Kč Practice Capital

The lesson reward follows the lesson's module, not completion order: a lesson outside Foundations completed before the unlock still earns 2,000 Kč, which becomes usable once Portfolio Lab opens.

Review / repeated completion:

0 additional XP or Practice Capital

Stored receipts keep the amount and policy version they were created with (v1: 2,000 Kč per lesson; v2: XP only) and are never recalculated or backfilled.

Practice Capital must never be derived from XP.

Source of truth

Practice Capital is derived from authoritative lesson reward receipts.

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

Investi domain/application
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

The Portfolio Lab should resemble the interaction model of a modern investing app while remaining educational.

Core flow:

SEARCH
→ SELECT INSTRUMENT
→ CHOOSE AMOUNT / QUANTITY
→ REVIEW
→ BUY
→ SEE HOLDING
→ UNDERSTAND PORTFOLIO IMPACT

Main hierarchy

Prefer:

Portfolio value as the dominant metric;

Available cash as secondary;

Practice Capital as learning context;

one obvious + Invest CTA;

holdings;

allocation;

recent activity;

destructive reset actions de-emphasized.

Avoid

always-open buy forms;

inline sell forms that expand into the page;

equal visual weight for every metric;

giant empty sections;

oversized explanatory copy;

permanently promoted Reset Portfolio action.

Empty state

A beginner with capital but no holdings should see a clear first action.

A user with zero Practice Capital should be directed back to learning.

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

19. Backtesting Lab

Backtesting answers:

How would this idea have behaved?

Portfolio Lab answers:

What do I own?

Do not conflate the two.

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

Make the investing workflow familiar first, then layer education on top.
