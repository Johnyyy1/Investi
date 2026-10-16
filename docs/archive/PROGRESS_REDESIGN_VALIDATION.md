# Progress redesign validation

Baseline: `main` at `0464686`, continuing an uncommitted Phase 3 draft that was already in the working tree. Design source: root `investi-design.pen` read through Pen MCP: `Investi / Progress — 1440px` (`sP9Vp`, stav 1 `IM3fV`, stav 3 `OCyjl`), `Investi / Design System` (`V7mUpG` §04 chapter header, lesson row, progress bars, bubble, empty/error states, footer) and `Investi / Consistency audit` (`t2Wjdv`).

## Implemented scope

- Editorial hero with quiet stats (`N z 12 lekcí · XP`) and the bookshelf guide (18) kneeling on the main card. The chapter-milestone state uses guide 07. The expected empty state has no guide (DS §04), and the failure state uses guide 20.
- **Co už umíš** shelf built from authored lesson content: concept callouts with their real guided step. Lessons without callouts fall back to their authored summary block. It shows the three most recent completions, with the rest behind a disclosure.
- One contextual continuation: resume the saved step, start the next lesson, start the next chapter, or open the Lab when everything is done.
- Curriculum by chapter, using the Studovna chapter header (audit K-09/T-04). One segment per lesson in the track, teal and teal-tint tokens, always with a text count. Lesson rows link to the real lesson, and `aria-current="step"` marks the one continuation.
- Chapter milestone (stav 3): what the chapter opens, the next chapter with its real lessons, and the primary CTA. Starting the next lesson returns the page to the normal state.
- Portfolio Lab card from saved data only. When locked it shows the real unlock conditions. When unlocked it reads the active generation's ledger (opened, last change, practice capital, cash) through `loadPortfolioLedgerSummary`, with no quote or FX requests. An unreadable ledger is stated as such and never shown as zero. The authored "Kde to využiješ" bridge of the most recent completed lesson links learning to practice.
- Route `loading.tsx` without numbers, and `error.tsx` following the DS failure spec (`retry()`, no technical detail, no zeros).

## Data and invariants

Everything shown comes from `loadLearner()`, `loadPortfolioLabUnlock()` and the portfolio repository and domain fold. Nothing touches schema, migrations, auth, reward policy, unlock rules, completion semantics, the trade ledger or the recommendation logic. `loadPortfolioLedgerSummary` is additive and read-only, and uses the same `foldTrades` as `loadPortfolioView`. Like Studovna, it relies on the existing lazy, idempotent `getOrCreateActivePortfolio`. XP stays a quiet compatibility number. Practice Capital comes from receipts and grants, formatted from integer minor units.

## Assumptions where Pen is incomplete

The audit records that the Progress board was interrupted: stav 4–5 and the 390 board were never built, and guide 07 was never placed.

- **All complete:** stav 1 layout, bookshelf guide, and a footnote pointing to the Lab and to the planned Riziko chapter.
- **Empty:** a neutral grey block with the first real lesson, no guide (DS §04).
- **Error:** the DS failure specimen.
- **Mobile and tablet:** derived from the Studovna 390 board and the DS mobile sizes.
- **Milestone timing:** the milestone shows when the latest completion finished a chapter and the next chapter has not been started.

## Intentional differences from Pen

- "kapitola" instead of "modul" (audit P-04).
- Chapter header at 48/28 desktop and 36/21 mobile (audit K-09/T-04).
- Lesson rows are 44–48 px tall for touch targets.
- The upcoming-chapter number uses `--color-text-disabled` (audit A-01). The track is `--color-track` (audit A-08).
- First name in the nominative ("Co už umíš, Jana."), as in Studovna. Czech vocative is not derived.
- "krok N" is plain text: lessons cannot open at a step in review mode yet.
- No per-chapter XP in the milestone meta, because the summary exposes only total XP.
- No "saved portfolios" or target allocation: the product has one active paper portfolio, with no saved targets.
- The Pen milestone item "roční náklady fondu" is replaced with what the Foundations lessons actually teach (bid, ask, spread).
- Streak, daily goal and the weekly calendar were removed per stav 1 ("žádné série, plamínky"). The "Jak funguje pokrok" explanation was kept.

## Validation

Disposable cluster on `127.0.0.1:55436`, database `investi_progress_qa`, migrated and seeded fresh. Production build from an exact copy of the working tree without `.env`, served by `next start` on `:3103`. Test identities were deleted afterwards.

- `npm run lint`, `npm run typecheck`, `npm test` (69 files, 656 tests): pass.
- `next build`: pass.
- `node scripts/validate-progress.mjs`: pass. Covers zero, returning (saved cursor), partial, chapter milestone, next chapter, all complete, and XP without prerequisites. Each state is checked at 1440, 1024, 768, 390, 375 and 320 px plus 320 px at 200 % text (no overflow, clipping or off-screen controls), along with focus rings ≥ 3 px, targets ≥ 44 px, keyboard disclosures, account-menu Escape, reduced motion, real links, review leaving progress and awards untouched, a single unlock, and no browser errors.
- Also passing: `validate-studovna.mjs`, `validate-product-shell.mjs` (Progress heading and paper navigation contract updated), `validate-progression-browser.mjs`, `test:portfolio-persistence`, `test:progression-persistence`.
- Error boundary: rendered via a throwing build of the scratch copy only, at 1440 and 390 px. One h1, no leaked error text, no overflow.

At 320 px with 200 % text, long Czech words in the large headings wrap mid-word. Nothing is clipped, and Studovna behaves the same.
