# Shared lesson calculators and figures

`src/features/lessons/figure-catalog.ts` is the maintained inventory of figure IDs, data classification, model locations and owners. `curriculum` means the curriculum maintainer role responsible for the educational assumptions and model tests. The catalog defines `LessonFigureId`; a new ID must also implement the exhaustive lazy renderer map in `src/components/lesson/lazy-blocks.tsx`. Stable IDs and persisted lesson answers do not change.

This platform supports incremental delivery with the lessons. It does not pre-build the planned budget, tax, pension, DCF or leverage calculators.

## Adding a figure

1. Put deterministic calculations in `src/features/finance/` or `src/features/lessons/<module>/model.ts`. Reuse existing finance functions and conventions. Components manage draft input, selection and presentation; calculations return unrounded values. Format only at the presentation boundary. Educational number models are not authoritative money accounting: persistent money still uses integer minor units and centralized exact arithmetic.
2. Test the calculation, its assumptions and invalid inputs. Include 0.1, 0.25 and 1.3333, zero, bounds and non-finite inputs where relevant. Seed stochastic models explicitly and test reproducibility.
3. Add the ID, accountable owner and model path to the catalog. Use `model` for invented examples. Use `provider` only when the component labels the actual selected snapshot, handles missing data explicitly and distinguishes deterministic fixtures from real history. Static conceptual diagrams can point to their module's finance models; they require no invented calculation.
4. Register a dynamic import and renderer in `lazy-blocks.tsx`. Keep implementation imports out of the catalog and `guided-block.tsx`. Existing lesson-specific preloads and Suspense placeholders from #131 remain in place: only the current lesson's figure/formula modules preload. Related existing figures share a module; use a separate module for new calculators so they do not inflate those groups.
5. Use the shared controls below. Test keyboard operation, invalid and empty drafts, 320 px reflow and 200% text. `/dev/lesson-calculators` provides a development-only specimen; it returns 404 in production and is not a navigation destination.

## Shared controls

- `FinanceInput` preserves raw text and uses a decimal keyboard. Parse at the model boundary with `parseNumericAnswer` from `features/finance/numeric-input`; the lesson-answer evaluator re-exports the same function for compatibility. Commas and points are supported. Blank/invalid values must never become zero. Use `parsePrice` for finite price-like inputs, then apply domain bounds.
- `FinanceSlider` pairs that text field with the existing native `Slider`. Both have accessible names and share any hint/error description. Text drafts remain intact; range bounds constrain slider gestures only. Caller validation owns typed bounds and domain errors. `step="any"` preserves typed decimals; when choosing another step, choose it to match the lesson's precision. Do not round canonical inputs to fit a slider.
- `CalculatorResult` is a named atomic live region. Compose `MetricResult` inside it; do not put interactive controls in the live region. An invalid input replaces the result with an explained error rather than stale values or zeros.
- `FigureDataLabel` supports `model`, `sample`, `historical` (source and date required) and `simulation` (seed required). `LessonFigure` labels every model figure. Provider-backed exercises use the shared label through `SourceLabel`, preserving source dates, adjustment mode, currency and limitations. Never classify deterministic data as historical just because it has dates.

The recovery explorer demonstrates the slider/result components using the existing tested `recoveryReturn` model. The returns, compounding and Foundations price boundaries also accept decimal commas without changing completion, rewards, persistence or portfolio state.

## Dated facts

Use the #132 fact registry and `{{namespace.key}}` tokens for changing factual values in authored display text; `prepareLessonFacts` resolves them on the server before rendering. Add the existing `factNotice` block for applicable facts and use `factContext.asOf` for historical lessons. Never parse a formatted token back into a numeric calculation. A future calculator that needs a statutory numeric input must resolve the applicable, publishable fact version on the server and pass the typed value, unit and applicability metadata explicitly; do not add a second registry or embed tax thresholds in components. This change introduces no statutory calculation or new regulatory claim.

## Validation

Run calculator/model unit tests, the catalog contract test, existing historical-source-label tests, `npm run test:lesson-calculators-browser` against a fresh development server, and the normal static gates. After the production build, run `npm run check:lesson-bundle` to preserve #131's content-exclusion and initial-JS budget.
