# Finanční check-up · 0.1.7 (#154)

- Stable identity: `before-investing-checkup`, storage module `module-before-investing`, route `/learn/before-investing/financial-checkup`. Display placement L0 / 0.1 / order 7, recommended. Prerequisites for recommendations are the published budget, debt and goals lessons. The reserve lesson remains an editorial draft; its unavailable route is never linked.
- Outcome: record five categorical self-assessments and choose an explainable next step. No pass/fail readiness score, access gate, financial amounts or personalized instrument advice. An explicit private answer is valid. The three-month reserve and 10% RPSN prompts are labeled check-up heuristics, not legal rules or universal targets.
- Eight-minute exception to the usual 10–15-minute lesson: this is a closing recap rather than a new concept lesson. Five interleaved model questions cover savings rate, debt, real return, horizon and fraud. Examples use fictional amounts in Kč; the real-return calculation explicitly excludes taxes and fees.
- The current engine requires correcting knowledge answers before continuing, as permitted by #154. The five checklist answers have no correct/incorrect state. Question attempts use the existing mastery/review system, separate from lifetime completion. The pension question is omitted while 0.1.5 is unpublished and cannot have legitimate completions; add that conditional question only with a deliberate published-flow compatibility plan.
- Priority: expensive debt → reserve → budget → goals → ordinary learning. Persisted `nextStep` is informational; recommendations recompute it from categories. An unavailable reserve lesson falls back to the saved check-up, whose result explains the reserve step. All-ready answers preserve ordinary recommendations. Retirement uncertainty adds an explicit reminder without declaring non-use of benefits a mistake.
- Persistence reuses `financial_checkup` artifacts: consent, owner/session validation, strict payload limits, versioned history, retries, user-row lock, account export and cascade deletion. Optional `goals` and `retirement` categories extend the existing JSON payload without a migration; old revisions remain readable. No financial amounts are collected. New IPS drafts prefill reserve and debt; existing plans remain authoritative.
- Each authored step has at most one knowledge question; the final step has none. The checklist save is verified server-side before progression/completion. Level-0 policy v4 grants XP only; no reward policy, Lab unlock, original completion, receipt or portfolio contract changes.

## Sources and maintenance

Curriculum maintainer owns the lesson and its model. Primary sources consulted 23 October 2026:

- [Investor.gov: Introduction to Investing](https://www.investor.gov/introduction-investing), context for preparing before investing, not a source of Czech tax rules.
- [ČNB warning dated 26 March 2026](https://www.cnb.cz/cs/dohled-financni-trh/ochrana-spotrebitele/upozorneni/Upozorneni-na-podvodne-investicni-nabidky-zneuzivajici-falesna-povoleni-a-identitu-CNB), independent identity/permission checks and pressure/high-return warning signs.
- [ČNB: Chraňte své peníze](https://www.cnb.cz/cs/dohled-financni-trh/ochrana-spotrebitele/chrante-sve-penize/), visible remediation link until the fraud lesson is published.

No changing tax limits, pension contribution amounts or legal calculations are introduced. The preceding reserve/pension drafts retain their expert-review gates. Content review remains a maintainer responsibility; implementation tests do not substitute for it. Review sources and lesson links semiannually and when preceding lessons are published.

## Verification

`npm run test:financial-checkup-persistence` verifies the real lesson’s server-side save/completion requirements, wrong-owner/source rejection, concurrent retry, private answers and deletion/review continuity.

`npm run test:financial-checkup-browser` uses the existing disposable `investi_artifacts_qa` guard with `ARTIFACTS_QA_DISPOSABLE=1`, `CHECKUP_TEST_URL` (default localhost:3154), and optional `CHECKUP_SCREENSHOT_DIR`. It covers consent, save/edit/reload, debt/reserve advice, study-plan integration, IPS prefill, wrong-answer remediation, retry, cursor resume, mastery attempts, completion/review, export/deletion, preserved progress/receipts, six responsive widths and 200% text. It runs in the existing artifact browser CI job.
