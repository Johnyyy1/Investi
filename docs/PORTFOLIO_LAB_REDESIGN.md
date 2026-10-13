# Portfolio Lab redesign

Baseline: `feat/progress-redesign` at `6282ac4`. Design source: root `investi-design.pen` read through Pen MCP: `Investi / Portfolio Lab — 390px` (`Py3VW`, states 1–5 in `gK7yl` with their annotations and open-questions note), `Investi / Portfolio Lab — 1440px` (`SqXrk`, heading and notes only), `Investi / Design System` (`V7mUpG`), the guide usage rules and `Investi / Consistency audit` (`t2Wjdv`).

## Implemented scope

- **First visit (state 1):** hero, guide bubble that explains a weight with the learner's real capital ("60 % z 2 000 Kč je 1 200 Kč"), the empty-portfolio card with three facts and one CTA, a labelled example split, and "Jak Lab funguje".
- **Builder (state 2), `/lab/portfolio/mix`:** a focused route without the tab bar. Keyboard combobox search, lines grouped by type, slider plus percent field per line, removable lines, a cash line, a live 100 % check (85 % and 110 % are named with icon and text and cannot be saved), the group split bar and the save action in a sticky bar. Every line and every held instrument is quote-checked; a closed, stale, unavailable or unsupported instrument is named on its line and blocks saving.
- **Review:** "Uložit portfolio" opens a dialog with the server-planned trades at current prices (sells, buys, value distributed, cash left, fees 0 Kč). Nothing is written until "Potvrdit a uložit".
- **Saved overview (state 3):** title and save date, data status, value with gain/loss since the generation opened split into price, FX and closed sells, cash/invested/practice capital, items with real weight against target, totals and the FX note, the allocation donut with targets and an explanation of drift, the lesson link, and the last trades.
- **Market-data states (state 4):** sample data (deterministic), fresh market data, closed market (value "při zavření"), stale (value "naposledy známá" plus "Načíst znovu"), unavailable (no value or estimate, guide 20, "Co víme jistě" from the ledger).
- **Co se stalo? (state 5):** what moved the result, from the real attribution: a headline, one sentence per moving part, a diverging contribution chart with a table, the honesty note and the lesson link.
- **Locked and zero capital:** the real unlock conditions, and a learning path when there is no capital.
- Route `loading.tsx` without numbers; `error.tsx` per the DS failure spec.

## Architecture and invariants

The ledger stays append-only, and every price, FX rate, cash amount, value and gain is still derived on the server from receipts, trades and observations. Two additive pieces were needed:

1. **Target mixes** (`portfolio_allocation`, `portfolio_allocation_line`, migration `0010`). This is user intent that the trade ledger cannot represent, and the Pen's "cíl 40 %", drift explanation and "Upravit" depend on it. It is append-only, generation-scoped and holds no money. See [portfolio-lab](portfolio-lab.md#target-mixes).
2. **Mix execution and review** (`executeAllocation` / `reviewAllocation`). Running one buy per line from the client would be non-atomic, and it would size quantities from client-side prices. Instead the server plans every trade from one set of fresh execution observations under the existing learner lock. It only appends ordinary trades and does not change the fold, valuation, rewards, reset or the single-trade path.

The price/FX attribution is a read-only projection with exact integer arithmetic; its parts sum to the investment gain/loss. Rewards remain contributions: a reward raises cash and cash weight, never gain. Missing quotes keep the total, weights, gain and attribution `null`.

## Decisions where the Pen is silent or incomplete

The desktop states 1–5 frame was lost from the file (audit F-01), so desktop is an adaptation.

- **Desktop overview:** a two-column layout in the Progress/Studovna container (1440 max, 64 px gutters). The left column holds value and "Co se stalo?", the right column items, allocation and trades. On mobile the DOM order matches the Pen exactly (value → Co se stalo → items → allocation).
- **Desktop builder:** the mix on the left and the sticky save bar as a sticky summary column on the right, with the same three checks, split and action.
- **Review step:** not in the Pen. It uses the DS dialog, focus trap, Escape and focus return.
- **Tablet (768–1023 px):** single column. The builder's save bar stays at the bottom, with the action beside the check.
- **"Co se stalo?":** the Pen's "since your last visit" needs a stored valuation snapshot per visit, which would be a mutable projection. The panel explains the result since the generation opened instead, from ledger and current observations only. When nothing has moved (constant sample prices) it says so and shows no all-zero chart.
- **"Vývoj hodnoty od nákupu" chart:** not implemented. It needs a daily FX history, and the market-data contract has only point-in-time FX. Adding one is a provider-contract change. The previous "Historie výkonnosti zatím není dostupná" placeholder with inert range labels was removed rather than kept as a fake control.
- **Editing a mix** distributes the whole portfolio value (cash plus holdings) and sells holdings that are not in the mix in full. The builder names them before saving. Differences under 1 Kč are not traded.
- **New capital** from lessons stays as cash until the learner edits the mix. The drift sentence says so.
- **Single-instrument buy and sell** stay on the instrument page, unchanged. Holding rows link there.
- **Reset** lives in the "⋯" options menu, de-emphasized, and closes the mix with the generation.

## Intentional differences from the Pen

- **Groups follow the instrument type** (Akcie, ETF, Dluhopisy, Hotovost), not the asset class. The contract exposes `equity/etf/bond`, not an ETF's underlying class, so a bond ETF cannot honestly be called "Dluhopisy".
- **Capital, prices, dates and FX are real**, not the board's illustrative 10 000 Kč, VT/VOO/BND and ČNB rates. FX is labelled by its provider: "ukázkový kurz" (deterministic) or "referenční kurz ECB" (Frankfurter), never ČNB.
- **No "Aktuální data · zpoždění 15 min".** Sample mode says "Ukázková data". Live mode says "Čerstvá tržní data" with the observation time, because the delay is not known.
- **No "otevře dnes v 15:30".** The session model has no next-open time. The banner says trading resumes when the market opens.
- **Guide 03 (explaining)** replaces guide 15 in state 1. Rule 01 reserves concept poses 09–16 for their lessons, and the audit flags this use. Guide 20 is used for unavailable data, as in the Pen.
- **Viz colours** use a validated four-hue set (`--color-viz-equity/etf/bonds/cash`, audit A-02/A-03). The Pen's butter and periwinkle are under 3:1.
- **One reload label, "Načíst znovu"** (audit: two labels), and **"Připravujeme"** instead of "Brzy" for upcoming items.
- **Amounts are exact**, with haléře where they exist, so the shown parts always add up. The guide bubble and story headline round to whole koruny.
- **The cash line cannot be removed.** It is the cash bucket and can be set to 0 %.
- **Titles:** "Můj mix" or "Moje portfolio". No mix naming exists.

## Validation

Disposable cluster on `127.0.0.1:55437`. Databases `investi_lab_qa` and `investi_lab_final` were migrated twice (idempotent) and seeded fresh, plus `investi_progress_qa` for the Progress guard. The production build was made from an exact copy of the working tree without `.env` and served by `next start` on four isolated ports: deterministic, closed clock `2026-01-17T12:00Z`, stale clock `2026-03-17T15:00Z`, and the Progress DB. Test identities are deleted by each suite. The user's own dev server was not touched.

- `npm run lint`, `npm run typecheck`, `npm test` (72 files, 703 tests), `next build`: pass.
- `test:portfolio-allocation` (new): exact split, review without writes, idempotent and concurrent identical saves, mix versus single buy under the lock, rewards as contributions, rebalancing with a full sell, invalid, unsupported and unvaluable inputs without writes, exact price/FX attribution (+77.00 / +21.38 Kč), reset and cascades. Pass.
- `test:portfolio-persistence`, `test:portfolio-closed-market` (now also mixes), `test:progression-persistence`, `test:persistence`, `test:portfolio-migration`, `test:migration`: pass.
- `validate-portfolio-lab.mjs` (rewritten). Covers locked, zero capital, first visit, unchanged instrument detail and the single buy (insufficient cash), the builder from the keyboard (combobox, slider arrows, 0 %, 85 %, 110 %, 100 %), the review (no writes, Escape, focus return) and save, the saved mix with targets, the instrument sell (oversell, partial), the price/FX story with exact sums, unavailable prices with a blocked builder, reset (Escape, focus, history retained), 44 px targets, 3 px focus rings, and 320–1440 px plus 320 px at 200 % text for every state and dialog. Pass.
- `validate-portfolio-closed-market.mjs` (rewritten): closed (4b) and stale (4c) labels, exact values, the builder and single orders disabled, no trade. Pass.
- Regression: `validate-progression-browser`, `validate-product-shell`, `validate-progress`, `validate-studovna`, `validate-instrument-unavailable`: pass.
