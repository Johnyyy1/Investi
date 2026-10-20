# Correlation and Diversification lessons

Issue #23 publishes two modules after Volatility, plus the Returns checkpoint. They use the shared authored-lesson registry, guided blocks, question evaluation, persisted cursor and completion transaction. Reward policy v3 already covers them: 2,000 Kč of Practice Capital for each first completion outside Foundations, nothing for a review. No schema, migration, money or persistence change.

| Module | Stable ID / slug | Focus |
| --- | --- | --- |
| Korelace | `correlation-what-is-correlation` / `what-is-correlation` | −1…+1, scatter of paired returns, r = cov / (σA σB) by hand; direction, not size |
| Korelace | `correlation-not-causation` / `correlation-is-not-causation` | Direct link, common factor, chance; returns, not prices |
| Korelace | `correlation-in-crises` / `correlation-in-crises` | Correlation is per period and rises in sell-offs; stocks and bonds in 2022 |
| Korelace | `correlation-real-data` / `correlation-on-real-data` | Ungraded prediction and reveal on the shared 2022 window, then module check |
| Diverzifikace | `diversification-concentration` / `concentration` | Weights of the whole (cash included), largest position, weight × move |
| Diverzifikace | `diversification-sectors-countries` / `sectors-and-countries` | Sector and country concentration, currency risk |
| Diverzifikace | `diversification-etf-look-through` / `etf-look-through` | Look-through exposure Σ wᵢ·vᵢ, overlapping funds |
| Diverzifikace | `diversification-correlation-risk` / `correlation-and-portfolio-risk` | Two-asset portfolio volatility and the role of correlation |
| Diverzifikace | `diversification-scenario` / `diversification-scenario` | Scenario challenge scored by explicit rules |

## Same arithmetic as the Lab

- Correlation answers and explorers call `pearsonCorrelation` from `features/instruments/correlation.ts`, the function behind the comparison's `returnCorrelation`. The real-data exercise calls `returnCorrelation` itself on the frozen closes and reads the strength with the comparison's bands (`correlationReading`).
- Weights, sector and country splits and ETF look-through go through Portfolio Lab's `allocationBasisPoints` and `portfolioExposure` (integer minor units, basis points, largest-remainder apportioning), so a lesson percentage rounds like a Lab percentage. Remainder buckets („Ostatní firmy / sektory / země“) never count as one category.
- All instruments in these lessons are invented and labelled as sample data.

## The scenario

*Scénář: sestav rozložené portfolio* follows Decision → Prediction → Lock → Reveal → Outcome → Explanation → Retry. It is client state only: it never reads or writes the learner's Portfolio Lab, cash or Practice Capital, and it does not affect completion. It is scored by four stated rules after look-through (largest company ≤ 10 %, sector ≤ 40 %, country ≤ 70 %, cash ≤ 20 %), each with its reason and a „Splněno / Nesplněno“ label. Two invented one-year sector moves show outcomes, and the copy states that an outcome does not decide whether the portfolio was diversified. There is no composite score.

## Lab links

- Comparison: the correlation help links *Co je korelace* (`metricGlossary.correlation.lesson`). Correlation is `pairwise`, so a lesson's „Vyzkoušej v Labu“ always opens `/lab/compare`, never one instrument's detail.
- Portfolio Lab: the Sektor / Země split links *Sektory a země*.
- Backtesting Lab: „Proč záleží na rozložení?“ links *Korelace a riziko portfolia* (it pointed at a non-existent `/learn/foundations/…` route before).
- Lab links to lessons come from `lessonLink(lessonId)` in the catalog, so they disappear rather than 404 if a lesson is unpublished.

## Validation

`npm run test:correlation-browser` (deterministic-data server, `CORRELATION_TEST_URL`) walks the checkpoint and all nine lessons, the explorers, the real-data prediction and the locked scenario at 320–1440 px and 200 % text, checks one v3 receipt per lesson, that the scenario writes no portfolio or trade, and the Lab links.
