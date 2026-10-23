# Investing Foundations

The first published module is `/learn/investing-foundations`. It shares the authored block engine, guided runner, progression actions, and curriculum seed with Returns. Seven lessons are published; the checkpoint is planned and has no authored lesson or actionable route.

## Stable curriculum

| Stable lesson ID | Current focus |
| --- | --- |
| `foundations-why-invest` | Saving versus investing, horizon, inflation, and uncertain outcomes |
| `foundations-stocks` | Ownership, quantity × price, price changes, and value distinctions |
| `foundations-etfs-indexes` | Fund versus index, weighted holdings, and concentration |
| `foundations-bonds-cash` | Cash versus lending, principal/coupon/maturity, and issuer risk |
| `foundations-markets` | Bid/ask/spread, order intent, and execution limits |
| `foundations-risk-reward` | Simple returns, growth factors, and compounding asymmetry |
| `foundations-portfolio` | Cash-inclusive value/weights, diversification, and risk |

IDs and slugs survive title/content changes because progress and receipts refer to those IDs. Persisted cursors are numeric; future step reorderings require an explicit resume-compatibility review.

The learning sequence is prediction/question → explanation → interaction/application → mastery checks → Portfolio Lab bridge → summary. Incorrect answers explain the misconception and allow retry. The server requires a correct evaluated answer before moving beyond a question step. Answers and explorer inputs are ephemeral; cursor and completion persist. Review preserves saved completion and receipts.

Integrity tests protect unique blocks, at most one question per step, question-last ordering, a non-question final step, and exactly one authored lesson for every available manifest entry. Planned entries remain unauthored and server-rejected.

## Financial boundaries

Pure educational utilities live in `features/finance`. Ownership, market capitalization, bid/ask spread, drawdown, portfolio weights, and weighted simple returns have finite-input validation and focused numerical tests. Growth reuses the Returns compounding helper; the Foundations compound-return wrapper delegates to the canonical cumulative calculation.

Educational floating-point ratios are distinct from the Portfolio Lab's scaled-bigint ledger. Display rounding never becomes accounting state. The Portfolio Builder uses conceptual stocks/bonds/cash weights and one-period returns; it does not optimize portfolios or calculate covariance. Cash-flow illustrations are not bond yield or total-return estimates. Diversification reduces some risks without eliminating loss.

The Foundations curriculum requires all seven completions and 420 internal XP for a normal user's Portfolio Lab unlock; personalization does not bypass it. See [current reward semantics](product-reset.md) and [portfolio accounting](portfolio-lab.md).

## Validation and future checkpoint

### Introductory mini-lesson (1.1.1, issue #155)

`foundations-why-invest` stays at `/learn/investing-foundations/why-invest`, in storage module `module-investing-foundations`, with three steps, the same block/answer IDs and a five-minute estimate. Its level-1 placement, prerequisites, guest entry, saved cursors, completion and rewards are unchanged. The envelope is explicitly a model example; the summary adds the general safeguard that a reserve and repayment of expensive debt come before investing. No personal readiness assessment is implied.

The reserve lesson 0.1.3 (`before-investing-emergency-fund`) is still planned, so the summary does not link to it or claim it is published. Add that connection when the lesson is available. The optional current inflation figure is omitted: the model needs no dated statistic.

Daily-review content handoff for [#123](https://github.com/Johnyyy1/Investnik/issues/123) (the scheduling engine is not implemented):

- Source lesson: `foundations-why-invest`; skill: `inflation`.
- Prompt: „Co inflace dělá s penězi v obálce?“
- Expected recall: „Částka zůstává stejná, ale kupní síla klesá: za stejné peníze si koupíš méně.“
- Misconceptions: the number of banknotes increases; the unchanged nominal amount buys the same goods despite rising prices.

This handoff adds no graded step or runtime field and awards no XP, capital or streak credit. Its integration and scheduling belong to #123.

### Module validation

Use `npm run test:foundations-browser` against a fresh local app/database with deterministic providers. The suite completes the beginner journey, retries incorrect answers, verifies persisted cursor/review and unlock invariance, exercises keyboard/focus behavior, six widths (320–1440px), and enlarged text. Domain/registry/transition tests run in `npm test`; financial persistence/concurrency checks have separate package scripts.

The planned checkpoint should retrieve existing concepts using mixed ownership/lending, index/ETF, bid/ask, concentration, weights, horizon, and risk tasks. It should reuse the runner and idempotent completion action, add no score-backed credential or separate assessment state, and introduce no portfolio optimization. It remains future work.

## Content reference material

The curriculum review used these primary references; retain them when revising the financial explanations.

- [ECB: price stability and purchasing power](https://www.ecb.europa.eu/home/pdf/students/leaflet_en.pdf)
- [Investor.gov: stock ownership and dividends](https://www.investor.gov/money-smarts-quiz-answer-1b)
- [Investor.gov: market capitalization](https://www.investor.gov/introduction-investing/investing-basics/glossary/market-capitalization)
- [Investor.gov: index funds and tracking differences](https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-4)
- [Investor.gov: ETF structure and strategies](https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-2)
- [Investor.gov: diversification limits](https://www.investor.gov/introduction-investing/getting-started/asset-allocation)
- [Investor.gov: market and limit orders](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-14)
- [Investor.gov: time horizon, risk, and diversification](https://www.investor.gov/additional-resources/general-resources/publications-research/info-sheets/beginners-guide-asset)
- [FINRA: willingness versus ability to take risk](https://www.finra.org/investors/insights/know-your-risk-tolerance)
