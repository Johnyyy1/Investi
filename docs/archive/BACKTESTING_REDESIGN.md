# Backtesting Lab redesign

Implemented from the latest `investi-design.pen` boards `GC1XA` (desktop) and `W56lMz` (mobile). The setup, result, comparison, loading, and data-gap annotations were inspected through Pen MCP. The implementation uses the approved paper/teal tokens with Nunito Sans, as required by the project instructions.

## Implementation and changed files

| File | Change |
| --- | --- |
| `src/app/(app)/lab/backtesting/page.tsx` | Delegates the redesigned page to the existing client controller. Route and metadata preserved. |
| `src/components/lab/backtesting-lab.tsx` | Focused setup, optional prediction, result snapshot, two-series metric comparison, explanation, period comparisons, editable configuration, learning question, methodology and lesson links. |
| `src/components/lab/backtesting-lab.module.css` | Responsive composition, shared semantic colors, mobile action bar, reflow, focus, tooltips and reduced motion. |
| `src/components/lab/backtest-chart.tsx` | Linear monthly charts, explicit sample-data label, strategy/benchmark/reference legend, endpoint values, Czech tooltips, keyboard interaction and complete accessible tables. |
| `src/components/lab/backtest-model.ts` | Presentation-only configuration and result snapshots; delegates all calculations and data validation to existing domain helpers. Supported period presets and display formatting. |
| `src/components/lab/backtest-model.test.ts` | Determinism, fixture values, snapshot isolation, exact series mapping, selected-period isolation, decimal input and incomplete-data rejection. |
| `src/components/lab/backtest-chart.test.tsx` | Unavailable chart state, sample labeling, zero-value handling and accessible table semantics. |
| `src/components/app-shell.tsx` | Adds only the Backtesting route to the existing paper theme. Existing three destinations preserved. |
| `scripts/validate-backtesting.mjs` | Dedicated browser acceptance for the workflow, data integrity, responsive layouts and accessibility. |
| `scripts/validate-product-shell.mjs` | Adapts existing assertions to the configuration/quiz disclosures and Czech period labels. Waits for responsive chart resize after text enlargement. Scopes account controls to their banner, accommodating concurrent settings work. |
| `package.json` | Adds `test:backtesting-browser`. Other script changes belong to concurrent settings work. |

Concurrent settings/auth/assets/token changes and the pre-existing untracked design inventory and Pen file were preserved. These unrelated files are excluded from the Backtesting commit.

## Preserved capabilities

- Three existing strategies: mixed 60/30/10, 100% synthetic stocks, 100% synthetic bonds.
- Inclusive, complete January–December periods from 2015 through 2025.
- Initial investment and the same initial amount for the stock benchmark.
- Final value, CAGR, maximum drawdown and annualized volatility.
- All monthly values plus the initial observation, with a full data table.
- Post-result educational question, invalid-input recovery, stale-result warning and rerunning.
- Existing Studovna/Lab entry links and focused lesson navigation.

New interactions are period presets, optional prediction before reveal, configuration disclosure with focus management, both series' metrics, and four computed period comparisons. Comparisons use the submitted result snapshot, even if draft inputs subsequently change. Rerunning clears prior comparisons and resets the learning-question answer. Invalid runs keep the previous result explicitly labeled.

## Financial and data integrity

The files `src/features/lab/backtest.ts`, `src/features/lab/sample-data.ts` and all financial/provider/persistence code are unchanged. There are no migrations or new database writes.

The presentation adapter calls the same `selectMonthlySample`, `portfolioWeightedReturn` and `calculateBacktestMetrics` functions as before. The default mix still ends at **159732.4758937891** unrounded, displayed as **159,732 Kč** in Czech locale. The full sample has 132 return intervals and 133 value observations. A narrower period reads only its selected observations. Missing, duplicate, unordered, nonfinite and incomplete observations are rejected; nothing is padded, interpolated or silently shortened.

CAGR uses months/12; volatility uses sample standard deviation and √12; drawdown is a positive loss magnitude that includes the initial peak and month-end values. Calculation precision is unchanged. Large displayed amounts use whole Kč, small amounts retain up to two decimal places, and tooltips retain up to two decimal places; display rounding never feeds the calculation.

This is an educational floating-point simulation, separate from the canonical integer-minor-unit portfolio ledger. Browser validation compares reward receipts, progression grants, immutable trades and portfolio generations before/after runs and confirms they are unchanged.

Data is synthetic, not live or observed history. Total-return/reinvestment assumptions remain those of the synthetic model. Monthly rebalancing to the chosen weights is unchanged. Kč remains a display unit, with no FX conversion. No taxes, costs, slippage, inflation, additional contributions or withdrawals were introduced. Results do not predict or guarantee future returns.

## Visual comparison

Pen source exports are in `/tmp/investi-backtesting-design/`; actual browser captures are in `/tmp/investi-backtesting-qa/`. Desktop setup follows the wide main form plus quiet data/lesson rail. Results follow chart → comparative metric rows → reflection → retry, and mobile reflows into one column with a primary action above the existing bottom navigation. Colors, surfaces, corners and control states use the current design tokens. Charts distinguish series with labels and line styles, and retain every observed point.

The design was adapted to actual product capabilities rather than reproducing illustrative numbers. Nunito Sans replaces the boards' Inter/Manrope pairing under the user's explicit typography requirement. The existing three-item shell remains. No hourglass/guide art was added because the appropriate asset is not shipped and mascot use in normal product UI is intentionally restrained.

This is an ordinary extension of the incumbent system. `DESIGN.md` and `.impeccable/design.json` remain unchanged: their Manrope/Inter typography and recorded route scope predate this Nunito Sans adaptation, so the divergence is documented here without refreshing unrelated shared guidance. The Pen header treatment and route-specific type ramp do not establish new shared system rules.

The independent screenshot review identified repeated bare-year labels on short-period charts and legacy blue quiz controls. The final implementation uses month/year labels for periods up to 24 months and scoped paper/teal quiz states. Browser assertions cover rendered monthly ticks as well as the existing keyboard and responsive behavior.

The reviewer scored both fixes **resolved** and returned **ship**, scoped to those two fixes. Temporary validation server and PostgreSQL processes were stopped after completion; screenshots and logs remain available under `/tmp`.

Screenshots cover 1440, 1024, 768, 390 and 320px for setup/results/comparison, plus 320px at 200% text. The shell suite additionally covers 375px. No horizontal overflow or essential-text clipping was found in these checks. Native radios/selects/disclosures retain keyboard behavior; results and configuration receive focus after transitions. The chart supports arrow-key tooltips and a semantic data-table fallback. Reduced motion is verified.

## Validation

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: **76 files, 741 tests passed** for the Backtesting-only commit snapshot, including existing Backtesting/finance/market-data/portfolio tests and new presentation/chart tests.
- `npm run build -- --webpack`: passed in an isolated source mirror with a fresh production runtime on port 3104; the existing development server and its `.next` directory were left untouched.
- `npm run test:backtesting-browser`: passed on the final production build.
- `npm run test:product`: passed on the final production build, including shell/account keyboard behavior, demo receipts, focus mode, auth gates and existing Backtesting regression assertions.
- `git diff --check`: passed.
- Before committing, all static gates and both browser suites were rerun against a source snapshot that excludes concurrent settings changes. Screenshots from this run are in `/tmp/investi-backtesting-main-qa/` and `/tmp/investi-backtesting-main-shell-qa/`.
- Existing migrations and seed applied successfully to a temporary local PostgreSQL database on port 55433. The normal development database was not used or reset. No financial/persistence implementation changed, so separate financial concurrency/migration suites were not rerun.
- Mechanical design detector: one false-positive warning on line-legend swatches; remaining advisories concern per-screen typography versus Studovna's documented scale. Existing design-system files were not rewritten to silence these advisories.

## Unsupported design elements

The engine does not support the boards' five experiment families, recurring contributions, selectable rebalance rules, Apple/VTI/BND instrument history, fees, FX conversion, worst-calendar-year or recovery-time metrics. These controls/metrics were not added. Arbitrary instrument selection, saved runs, strategy optimization and backtesting personal trades remain outside the existing product.

No historical/provider request runs in this Lab, so provider-failure, timeout, and partial-history acceptance flows cannot be truthfully implemented here. The existing complete-data rejection remains; the chart has an explicit unavailable state for absent/nonfinite points. Connecting real historical data and new experiment strategies is separate domain/application work.

Commit boundary: only Backtesting implementation, its regression tests and this report are included. Pre-existing design files and concurrent settings work remain outside the commit and are preserved in the working tree.
