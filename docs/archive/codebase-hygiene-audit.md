# Codebase hygiene audit

Audit date: 2026-09-30. Baseline `HEAD` and `origin/main`: `87633a5c67b36860fd8d823c7c6c61386fb33fea`, branch `main`, initially clean. Changes are intentionally uncommitted and unpushed for review.

## Executive summary

Removed confirmed unreachable UI/action/factory code, unused artwork, one unused development dependency, superseded test wrappers, and implementation diaries. Useful curriculum, financial, migration, personalization, and marketing rationale is consolidated into maintained documentation. Setup now reflects the full migration chain and actual environment consumers. No intentional product behavior, financial arithmetic, reward policy, authentication policy, schema, migration, provider contract, or persistence contract was changed.

Two pre-existing 320px/200%-text reflow defects exposed by current shell validation received narrowly scoped wrapping fixes: the Settings security heading and Lab links. No essential text was reduced. Directly imported Better Auth Drizzle adapter is now explicitly declared at its already-installed version, rather than relying on a transitive dependency.

All deletion decisions combine TypeScript import/reference inspection with repository searches, current route/component callers, script/configuration references, and runtime validation. Static findings were candidates, not deletion authority. Analysis helpers and QA runtimes stayed under `/tmp`; no permanent dead-code tooling was installed.

## Repository inventory and production paths

| Category | Locations and justification |
| --- | --- |
| Production routes | `src/app/(marketing)`, `(auth)`, `(app)`, `onboarding`, auth API; all page/layout/loading/error/not-found/metadata conventions retained |
| UI and shell | `src/components/{auth,shell,learning,lesson,lab,personalization,gamification,ui,marketing}`; traced from pages and dynamic chart imports |
| Educational domain | `features/{finance,lessons,learning,lab}`; authored registry/manifests, canonical calculation helpers, synthetic backtest data |
| Persistence/rewards | `features/{progress,rewards,progression,portfolio,gamification,demo}`, `src/db`; server ownership, locks, immutable receipts/trades, exact accounting |
| Data providers | `features/market-data/{deterministic,fmp,frankfurter}`, service/cache/composition, instruments; security, history, fundamentals, ETF analytics and FX |
| Authentication | `src/lib/auth*`, session, social errors, auth API and UI; Better Auth schema passed through namespace imports |
| Database | Ten historical SQL migrations, ten snapshots, journal, Drizzle config/schema/seed; required fresh/upgrade workflow |
| Tests/fixtures | Vitest tests, deterministic datasets, personalization test fixtures, guarded persistence/browser scripts; retained as active regression protection |
| Tooling/config | npm manifest/lock, Next, TypeScript, ESLint, PostCSS/Tailwind, Vitest and persistence TS config; all current entry points traced |
| Infrastructure | Dockerfile/Compose, ignore files and demo cleanup command; no background job service currently exists |
| Assets | `public/brand`, framework-managed `src/app/icon.svg`, Next-managed fonts; reference artwork distinguished from runtime assets |
| Documentation | README, agent rules/CLAUDE bridge, current architecture/domain/operations docs; phase diaries consolidated |
| Generated output | Ignored `node_modules`, `.next`, TS build information, environment files, coverage; browser images/results written under `/tmp` |
| Unrelated local material | Tracked `.obsidian/*` and `2026-09-13.md`, ignored `fine-details`; preserved per repository instructions, excluded from Docker context |

Production-path review:

- Auth pages → Better Auth API/session → Drizzle user/account/session schema; anonymous session hook initializes isolated demo state.
- App layout → session/onboarding gate → learner loader → curriculum, profile, gamification, capital, and continuation.
- Manifest/catalog → authored registry → guided blocks/questions → authenticated progress action → transition validation → transactional completion/receipt/unlock.
- Portfolio page/actions → server service/repository → user lock, entitlement and immutable generation/trade ledger → normalized market observations → exact valuation/presentation.
- Search/detail → current market-data composition/service → deterministic or FMP securities/fundamentals/ETF analytics and deterministic or Frankfurter FX; provider secrets remain server-only.
- Backtesting → frozen synthetic allocation/period specification → canonical educational return/metric helpers; no personal-ledger mutation.

Bundled Next.js 16.3.4 guidance on project structure, public files, metadata icons, and environment loading was consulted. Framework exports, route conventions, wildcard schema imports, dynamic chart modules, and dynamically selected CSS classes were checked separately from ordinary named imports.

## Deleted items

| Removal | Evidence and reason | Risk |
| --- | --- | --- |
| `components/onboarding/{onboarding-flow,path-recommendation,preferences-editor,preferences-questions}.tsx` | No route, test, script, or dynamic importer; onboarding/plan/Settings use `components/personalization` | Low |
| `features/onboarding/actions.ts` | Once orphan UI was removed, only its superseded mocked action tests referenced it; all current form callers use personalization actions | Low |
| `features/onboarding/actions.test.ts` | Tests old, unreachable action boundary. Equivalent session-owner/error/revalidation coverage remains on current actions; session-lookup failure case transferred | Low |
| `features/onboarding/domain.ts` option label arrays, `dailyGoals`, `canContinue` | Arrays were only used by deleted preferences UI; `canContinue` had no production/script caller and one obsolete UI-gating test | Low |
| `components/learning/continue-learning.tsx`, `module-path-preview.tsx` | No import/reference outside their declarations; Learn uses Recommendation/JourneyOverview and module page uses ModuleOverview | Low |
| `features/learning/returns-path.ts`, its test file | Production never calls the thin `getModulePath('returns', …)` wrapper. All three meaningful path tests moved to catalog tests | Low |
| `components/marketing/portfolio-pie-visual.tsx` | No live caller; PortfolioShowcase directly renders the same artwork. Shared used CSS/artwork retained | Low |
| `features/market-data/fmp/service.ts` | No caller; production/manual smoke use current multi-provider composition, which includes FX/fundamentals/ETF providers. Only obsolete architecture-test filename entry removed | Low |
| `getConfiguredMarketDataReadiness`, `compoundingRoute` | Repository-wide search and symbol inspection found no callers. Pure readiness diagnostic remains used by manual smoke/tests; lesson URLs come from manifest consumers | Low |
| `public/brand/{green-icon.webp,growing-graph.webp,xp-star.png,xp-star.webp}` | No source, CSS, metadata, script, documentation, or constructed-path consumer. Retired decorative/XP artwork; referenced coin/logo/scenery images retained | Low |
| `scripts/validate-learning-loop.mjs`, `validate-product-migration.mjs` | Baseline execution fails on retired English labels; source also expects v1 lesson capital, obsolete quick-start, and old lesson counts. Current contract coverage mapped below | Medium: validation-only |
| `scripts/validate-onboarding.mjs` | Alias importing the retired learning-loop harness; current personalization/compatibility commands cover onboarding | Low |
| `docs/NEXT_SESSION.md` | Outdated handoff recommending provider/cache work already implemented; current limits moved to maintained docs | Low |
| Foundations audit, marketing phase, personalization A/B, Returns plan/closeout docs | Completed implementation diaries, historical validation logs, stale publication/worktree claims. Ongoing rationale and unfinished checkpoint/data work preserved in current docs | Low |
| `@vitejs/plugin-react` | No config/import/script/plugin consumer; Vitest uses its configured TS/JSX transform and Next compiles the app. Removed via npm, lockfile regenerated | Low |
| `NEXT_PUBLIC_APP_URL` declaration/example/Compose/docs | Only referenced its own unused env declaration. Auth uses server `BETTER_AUTH_URL` and same-origin browser client | Low |

Exactly one now-empty directory (`src/components/onboarding`) was removed. Other directories were retained without cosmetic moves. No schema/migration, financial test, provider adapter, fixture dataset, or framework route was deleted.

## Consolidated items

- Returns path assertions now exercise `getModulePath` directly in `catalog.test.ts`: available states, unordered progress identity, and planned lessons staying locked.
- Current personalization action tests retain owner/unauthenticated/error/revalidation checks and the transferred session-database failure regression.
- `test:product` keeps its public package-script name and now invokes `validate-product-shell.mjs`: current demo receipts/grant, shell navigation, account keyboard/Escape/focus, six widths, 200% text, dashboard redirect, lesson focus mode, sign-out/auth gate, and Backtesting results/table/invalid inputs/reduced motion.
- Foundations rationale → `investing-foundations.md`; personalization domain/UI rationale and guarded QA → `onboarding.md`; current Returns and active checkpoint backlog → `returns.md`; current landing contract → `marketing.md`.
- `product-reset.md` is retained as the existing link target but rewritten around current contracts and historical reward migration rationale. README, provider, portfolio, auth, and design-system docs corrected; `environment.md` supplies full variable classifications.

No financial implementation was consolidated: shared compounding/weighted returns already have canonical helpers; educational floats differ deliberately from scaled-bigint ledger arithmetic. Instrument chart percentage metrics, invalid-data handling, date/provider/session validation, and currency formatters have distinct units/boundaries. Combining them in this cleanup would risk behavioral changes.

## Preserved suspicious items

- Legacy onboarding domain/repository methods and tests: real persistence/upgrade suites deliberately exercise stale writes, original completion markers, legacy preferences and timezone. Removing them safely requires a separate compatibility-contract decision.
- `features/lab/portfolio.ts`: allocation/one-period math still powers lesson/Backtesting exercises; it is not a duplicate personal trading ledger.
- Deterministic provider fixtures/service and Noop cache: intentional reproducible development/tests/default provider behavior, clearly labeled sample data.
- Readiness diagnostics, provider capabilities/corporate-action seams and exported domain types/constants: used internally, by manual smoke/tests, or part of explicit current normalized contracts; external named-import counts alone do not prove obsolescence.
- `src/app/dev/{design-system,etf-analytics}`: active development previews, guarded to 404 in production; preview components and primitive-only demo states remain useful.
- `src/app/icon.svg`, metadata/default route exports, Better Auth tables/enums: framework or wildcard schema consumers use these without direct named imports.
- Dynamic marketing `cardStage1/2/3` and journey status classes: template/status lookup references; CSS-module candidates are live.
- `public/brand/investi brand identity.png`: supplied active brand reference; now documented explicitly. It is not a runtime asset.
- `.obsidian/*`, `2026-09-13.md`, ignored `fine-details`: unrelated personal/local workspace material explicitly protected by AGENTS.md. None was edited; Docker context excludes local directories.
- Operator demo cleanup and manual FMP/equity smoke scripts: active lifecycle/provider workflows. Live smoke calls were not performed with real credentials.

Final framework/test/script import reachability found no orphan TS/TSX module. This is a repository-local finding, not a promise about future integrations or external consumers.

## Test audit

All financial calculations, portfolio decimal/accounting/valuation, security/auth, progress, lessons, rewards, idempotency, database, concurrency, provider, fixture, chart, and design-system tests remain protected.

Unit-test changes: delete seven tests for removed legacy server actions; delete one obsolete old UI `canContinue` test; add one transferred session-failure test to the active action suite; move all three Returns path tests unchanged in substance. Net: 636 → 629 tests, 66 → 64 files. No financial/concurrency assertion was weakened.

Retired browser harness coverage:

| Old protection | Current retained coverage |
| --- | --- |
| Reward insert rollback, review/concurrent receipts, demo seed rollback/isolation | `test:persistence`, portfolio/progression persistence, log-return persistence |
| Lesson gates, completion/review, resume, failed saves/retries, keyboard focus | Foundations, Returns-flow and log-return browser suites; progress action/transition tests |
| Anonymous demo recovery/isolation and auth gates | Marketing/auth browser, demo persistence tests, current shell smoke |
| Legacy/no-profile onboarding, Settings recovery, stale submissions | Personalization persistence/compatibility/browser |
| Portfolio search/detail/buy/sell/reset/reflow | Portfolio browser/persistence, closed-market and unavailable-instrument suites |
| Shell/account navigation, dashboard redirect, Backtesting UI/table/inputs | Current `test:product` smoke plus pure backtest tests |

The retired harnesses were not made green by deleting financial expectations: their supported contracts are exercised by current dedicated suites. The new shell harness also exposed real pre-existing layout issues, which were fixed rather than masking its assertions.

## Dependency audit

Removed `@vitejs/plugin-react`; explicitly declared `@better-auth/drizzle-adapter@1.7.3`, already imported by `src/lib/auth.ts` and installed through Better Auth. Locked retained versions did not change. The only removed lock package is the React Vite plugin.

| Retained dependency group | Evidence |
| --- | --- |
| `next`, `react`, `react-dom` | App Router, components, SSR and dynamic charts; framework runtime |
| `better-auth`, Drizzle adapter | Auth server/client/API/plugins, schema adapter |
| `drizzle-orm`, `postgres` | Runtime repositories, schema, seed, migration and QA |
| `@t3-oss/env-nextjs`, `zod` | Environment and authoritative boundary validation |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Shared primitive variants/class composition |
| `lucide-react`, `motion`, `recharts`, `katex` | Actual component icons/rewards/motion/charts/formulas and tests |
| `tailwindcss`, `@tailwindcss/postcss` | CSS import and PostCSS plugin configuration |
| `typescript`, `tsx`, `@types/node/react/react-dom/katex` | Static checks, typed runtime/scripts, JSX/SSR/formula declarations |
| `vitest` | Unit tests and config; its Vite dependency remains transitive |
| `playwright` | Current browser suites |
| `eslint`, `eslint-config-next` | Lint command and current Next rules |
| `dotenv`, `drizzle-kit` | Standalone script/config env loading, DB lifecycle commands |

Every package-script target resolves. The development design-system harness now targets current Czech chart/feedback/completion labels and includes 375px; all its interaction and no-JavaScript assertions remain. No script was renamed unnecessarily; dev/build/start/watch/lint/typecheck/DB/seed/demo/provider workflows remain. Next/TS/ESLint/Vitest/PostCSS/Drizzle/Compose configurations were retained. Ignore files additionally exclude normal Playwright outputs and personal/local Docker content.

`npm audit` reports the same five advisories at baseline and after removal (four moderate, one high): Drizzle tooling/esbuild-chain and `brace-expansion` transitive dependencies. No audit-fix/upgrade was applied; dependency modernization is separate work.

## Database audit

All ten historical migrations, snapshots, journal, schema columns/enums, seed and integration helpers remain unchanged. A new local PostgreSQL 17 container, bound only to `127.0.0.1:55441`, hosted dedicated disposable QA databases. No normal development or production database was read, seeded, migrated, reset, or deleted.

Fresh/upgrade personalization harness applied migrations 0000–0008, seeded legacy state, applied 0009, reran the migration runner/seed, and checked preserved rows. Supported `db:migrate` also created a separate fresh auth QA database through the full chain. Canonical seed plus curriculum validation passed twice for twelve published lessons/two modules and planned positions. Receipt, constraint, exact decimal, generation/reset, cascade, and concurrent buy/sell/reward/unlock cases passed.

## Remaining technical debt

- AGENTS.md describes v1 per-lesson Practice Capital and hidden XP; committed runtime uses v2 zero-capital receipts, one-time unlock grants, and visible XP progression. Agent rules were not silently rewritten and financial behavior was not changed. Resolve this product-policy/documentation conflict separately.
- Legacy preference/recommendation fields and persistence methods remain intentional compatibility surface; retirement needs data/contract review.
- Browser coverage is installed Chrome only; physical mobile devices, Safari/Firefox, and screen-reader hardware remain manual work.
- Five existing dependency advisories require a separately scoped update/validation decision.
- Demo cleanup remains operator-run; no scheduler was added. Provider early-close/unscheduled-calendar/distributed-cache limits remain documented.
- Foundations/Returns checkpoints, lesson-level personalization adaptation, and frozen market-data lesson integration remain unfinished feature work.
- Tracked personal Obsidian/note material predates this audit and was explicitly preserved.

## Debugging residue and duplicate review

Repository searches found no production `console.log`/`console.debug` or TODO/FIXME/HACK residue. Console output in seed/QA/manual provider/demo-cleanup commands is intentional operator feedback. Development routes are deliberate guarded previews, not exposed production diagnostics. No tracked `.DS_Store`, local database, coverage, browser screenshot, or debug log was found. Migration JSON snapshots and deterministic sample datasets are intentional source artifacts. Existing ignored local/generated files were preserved.

The compiler-reference sweep left framework exports, internally used types/constants, normalized provider contracts, and test/script compatibility APIs intact. All source modules are reachable from framework, test, script, or seed roots. Import graph analysis does not claim every retained export is a public production entry point. Return/percentage/currency/FX/session/date/valuation/parsing/error implementations were reviewed at their unit and authority boundaries; no harmful competing accounting implementation was found that warranted a financial refactor.

## Validation

| Check | Baseline / final result |
| --- | --- |
| `npm test` | Baseline: 66 files / 636 tests passed. Final: 64 files / 629 tests passed |
| `npm run typecheck` | Passed before and after cleanup |
| `npm run lint` | Passed before and after cleanup; repeated after QA-script edits |
| `npm run build` | Passed before and after final runtime/dependency edits, Next.js 16.3.4 production build |
| `test:personalization-persistence` | Passed fresh + legacy upgrade, migration/seed rerun, compatibility, validation, cascade, invariant checks |
| `db:migrate` | Passed full committed chain on isolated QA databases; separate fresh auth DB verified supported command |
| `db:seed` + `test:curriculum-seed`, repeated twice | Both passes: 12 published lessons across 2 modules; no duplicate curriculum |
| `test:persistence` | Passed atomic receipt/review, concurrent first completion, demo isolation/idempotence/rollback, progression gates |
| `test:migration` | Passed legacy receipt preservation, v2 constraints, reconciliation/partial backfill/rerun |
| `test:portfolio-persistence` | Passed exact ledger, ownership, idempotency, reset/generations, cascade, concurrent buy/sell/reward |
| `test:portfolio-migration` | Passed exact types/precision, indexes, checks, ownership cascades |
| `test:progression-persistence` | Passed one-time grants, concurrent unlock, grandfathering, accounting and rerun |
| `test:log-returns-persistence` | Passed step gates, concurrent v2 completion, review/legacy/L4 preservation, planned rejection |
| `test:portfolio-closed-market` | Passed closed-session rejection without trade/capital mutation |
| `test:product` | New current shell/demo/Backtesting harness passed after wrapping fixes; six widths, 200% text, keyboard/account/focus/auth gates |
| `test:foundations-browser` | Passed complete seven-lesson journey, retry/reload, unlock/review and accessibility/reflow |
| `node scripts/validate-returns-flow.mjs` | Passed L3 steps/explorers, completion/resume/sign-in/review/reduced motion and six widths |
| `test:log-returns-browser` | Passed L4/L5 steps, formulas, retry/resume/review, keyboard/focus/reduced motion/200% text |
| Additional Returns entry smoke | All five published lesson URLs opened successfully in focused lesson mode |
| `test:portfolio-browser` | Passed zero capital/later reward, search, equity/ETF detail, charts, buy/sell, persistence/reset, dialog keyboard/focus, reflow |
| `test:portfolio-browser-closed` | Passed closed-session state, nonzero valuation, disabled execution and no mutations |
| `test:instrument-browser-unavailable` | Passed unavailable history/stale quote/invalid route and 320px/200% reflow |
| `test:progression-browser` | Passed locked learner/unlock/grandfathering, one-time grant and reflow |
| `test:personalization-compatibility` | Passed legacy/missing/incomplete-profile routing and Settings recovery |
| `test:personalization-browser` | Passed all A–F scenarios, diagnostic/recommendation, skip/retake/stale writes, network/error recovery, accounting preservation and keyboard/reflow |
| `node scripts/validate-auth.mjs` | Passed signup/login, redirects/demo, enabled/disabled providers, fake OAuth requests/cancellation/errors, secret boundary, keyboard/focus/reflow |
| `node scripts/validate-marketing.mjs` | Passed landing, assets, metadata, CTA/auth/demo recovery/isolation, keyboard/reduced motion, six widths and enlarged text |
| `node scripts/validate-design-system.mjs` | Passed six widths/charts, inputs, keyboard answer→feedback→completion/focus, reduced motion, no-JavaScript table fallback; only expected Motion development notice |
| Development preview HTTP smoke | Both `/dev/design-system` and `/dev/etf-analytics`: development 200, production 404 |
| `demo:cleanup` | Disposable QA dry run passed, zero eligible identities; destructive operator cleanup not invoked |
| `docker compose config --quiet` | Passed without printing resolved secrets |
| Import/reference, script target, local Markdown links, lock versions | No orphan source module, missing script target, broken local doc link, or retained-version upgrade |
| `git diff --check` | Passed |

Browser validation used installed Chrome with fresh isolated production builds/ports and a separate development runtime, never a dev server invalidated by `next build`. Representative desktop and small-screen captures were inspected; screenshots remain in `/tmp`, including `/tmp/investi-product-qa`. Relevant checks cover 1440, 1024, 768, 390, 375, and 320px, enlarged text, reduced motion, focus/Escape/native keyboard, modal behavior and console errors. This is automated desktop-browser emulation, not physical-device or screen-reader certification.

Failures encountered and resolved: retired product/migration scripts failed on obsolete English controls before cleanup; design preview selectors also used old English labels and now match the existing translated components. Current shell checks exposed the original Settings and Lab text overflow; narrow wrapping fixes resolved them. Initial disposable dev startup used a node_modules symlink outside the Turbopack root, so dependencies were copied into that isolated runtime. An initial OAuth fixture used the wrong fake client ID; corrected fixture configuration passed. These failed exploratory runs are not counted as passing checks.

Live FMP/equity smoke calls and real OAuth-provider sign-in were not run. Provider unit fixtures and fake OAuth navigation/error paths passed. No real provider credentials were used. All audit-owned servers and the disposable PostgreSQL container are stopped/removed after validation; existing user runtimes remain untouched.

## Before/after metrics

Counts use baseline `HEAD` versus the effective file set after applying this unstaged diff: existing tracked files plus the five intended new files. The Git index itself still lists 388 files because nothing was staged. Text line counts consistently include `.ts/.tsx/.mts/.mjs/.css/.md/.json/.yaml`, Dockerfile and the three environment/ignore files; they include the lockfile and migration snapshots, exclude binaries/SQL/SVG/generated output, and are size observations rather than logical-code metrics.

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Effective versioned files | 388 | 367 | −21 |
| Source files excluding unit tests (includes CSS/icon) | 219 | 209 | −10 |
| Unit-test files | 66 | 64 | −2 |
| Unit tests | 636 | 629 | −7; no financial assertion removed |
| Scripts/config files under `scripts/` | 30 | 28 | −2 |
| Documentation files under `docs/` | 14 | 11 | −3 |
| Public assets | 16 | 12 | −4 |
| Production dependencies | 15 | 16 | +1 existing installed adapter explicitly declared |
| Development dependencies | 15 | 14 | −1 unused plugin |
| Repository text lines, consistent measurement | 45,616 | 44,495 | −1,121 |
| Source text lines including tests | 16,590 | 16,299 | −291 |
| Deleted files | — | 26 | 10 source, 2 tests, 3 scripts, 7 docs, 4 assets |
| New files | — | 5 | 4 maintained docs including this report, 1 shell harness |
| Empty directories removed | — | 1 | Superseded onboarding UI |
| Retired artwork bytes | — | 3,334,844 removed | Approximately 3.33 MB / 3.18 MiB |

Consolidation evidence: seven retired phase/handoff documents plus three rewritten current documents supplied the maintained curriculum/personalization/product/marketing/Returns guidance. Two retired test files transferred meaningful coverage into two active test suites. Two retired browser harnesses and their alias are represented by the new shell suite plus retained deeper suites. These are documented transformations, not claims that every deleted assertion was duplicated verbatim.

## Review and Git state

Final changes: 25 modified tracked files, 26 deleted tracked files, five new files; 56 affected paths including untracked additions. Financial/security/provider/persistence behavior and all database artifacts remain intact. Unrelated local files are preserved. `main` still points to `87633a5c67b36860fd8d823c7c6c61386fb33fea` and matches `origin/main`; no staging, commit or push occurred.

`git diff --stat` was reviewed with `git status`; its tracked-file summary excludes the five new files until staging. Combined review diff including the new files: 56 files changed, 635 insertions, 1,756 deletions. The audit leaves the requested cleanup as reviewable working-tree changes.

Proposed commit: `refactor: remove dead code and consolidate repository hygiene`.

