# Studovna redesign validation

Implementation baseline: `codex/marketing-v14-landing`, commit `2b2700f`. Final design source: existing root `investi-design.pen`, boards `QB1gf` (1440), `liRhy` (390), `mAWd8` (states), `V7mUpG` (design system). The requested `design/` path was absent; the preserved root file was the actual source. The extracted `investi-studovna-redesign-phase1` overlay in Downloads was audited and selectively adapted.

## Implemented scope

- Staged paper/ink/teal semantic tokens, Manrope headings and Inter UI text, scoped Learn shell and mobile navigation.
- Desktop split continuation/recap and curriculum/rail; mobile disclosures, card-edge character and fixed tab bar; intentional intermediate-width reflow.
- Actual catalog and `loadLearner()` drive titles, durations, availability, completion, saved steps, personalized rationale and resume/recommendation links.
- Actual current authored multiple-choice exercise uses existing `saveLessonPositionAction`; wrong answers remain local, correct continuation saves the existing cursor. Numeric and other steps resume in the focused lesson. No new completion/reward path.
- Existing portfolio service provides allocation, with ETFs separate and explicit locked/empty/unavailable states. Receipt-derived capital uses exact minor-unit formatting. Sample data is labeled.
- Supplied illustrations remain byte-for-byte original WebP assets; provenance and hashes are in `public/investi-assets/manifest.json`.
- Loading and recoverable error UI, native keyboard controls, visible focus, textual feedback and reduced-motion support.

Authentication, progression gates, accounting/rewards, migrations, schema, provider contracts, immutable trades and portfolio generation behavior were not changed. Unconverted product screens and focused lessons retain their existing visual system. Existing implemented Backtesting navigation remains available. Design sample XP/balances/counts are not reproduced as user data.

## Executed checks

All passed:

- `npm run typecheck`
- `npm run lint`
- `npm test` — 67 files, 643 tests
- `npm run build` — fresh optimized production build after final fixes
- `npm run test:studovna` — wrong answer/retry, failed save/retry, correct persisted continuation/reload, unchanged award receipts, actual current step, separate recommendation link, completion state, keyboard chapter toggle, account Escape/focus return, working navigation and images; 320, 375, 390, 768, 1024, 1440px and 200% text.
- `npm run test:product` — authenticated shell, demo accounting, account/navigation, sign-out/protected routes, focused lessons, Backtesting results/table/errors/reduced motion. Repeated on the final production runtime.
- `npm run test:portfolio-browser`
- `npm run test:foundations-browser`
- `npm run test:log-returns-browser`
- `node scripts/validate-progress.mjs`
- `node scripts/validate-design-system.mjs` — correct development runtime
- `node scripts/validate-marketing.mjs`
- `npm run test:personalization-compatibility`
- `node --import dotenv/config scripts/validate-personalization-browser.mjs`
- `npm run test:persistence`
- `npm run test:progression-persistence`
- `npm run test:portfolio-persistence`
- `npm run test:log-returns-persistence`
- Mechanical design detector on changed UI targets — no findings.
- `git diff --check`

Tests used newly created disposable local databases `investi_studovna_qa` and `investi_6a3a_qa` on the existing local PostgreSQL process at port 55434. Existing migrations and curriculum seeds applied successfully to those databases. No normal development or production database was reset or migrated. Test identities were cleaned up. Final browser acceptance used a newly started `next start` server at port 3101 after stopping our own earlier runtime; no unrelated processes were stopped.

## Screenshot comparison

Pen references were exported through Pen MCP, not read as file bytes. Actual production screenshots were compared against them at the specified widths. A separate reviewer requested four local fixes: restore the quieter recommendation action; reflow enlarged chapter headings; stretch the recap final block toward the bottom; remove the 1024px character/recap-label collision. The final production captures verify those changes. The independent verdict pass marked all four findings resolved with disposition **ship**. The tablet offset is split between the 768–899 stacked range and the 900–1199 side-by-side range. This verdict scores the listed fixes; it was a read-only source/capture review, not an additional browser test sweep.

Final captures: `/Users/jonas/.codex/visualizations/2026/10/13/01a13559-937e-7c31-b520-30b0da579928/investi-studovna/` (`resume-1440.png`, `resume-1024.png`, `resume-768.png`, `resume-390.png`, `resume-320-text-200.png`). Additional new/resume/completion-state evidence is in `/tmp/investi-studovna-production`.

Intentional differences from the design examples: actual catalog copy/durations and saved cursor, authoritative portfolio locks and balances, truthful sample-data labels, percentage learning progress in place of XP, and working Backtesting link. Mobile full-page browser captures show fixed navigation at the bottom of the captured viewport; the canvas depicts it at the end of its static board. Captures include focus rings left by keyboard validation.

After implementation acceptance, the user requested publication to `main`. The release includes this Studovna implementation and its already-committed landing-design baseline, using a fast-forward merge without rewriting history. The original untracked `docs/PRODUCT_DESIGN_INVENTORY.md` and `investi-design.pen` remain preserved outside the commit.
