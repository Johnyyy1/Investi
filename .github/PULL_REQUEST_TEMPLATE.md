## Change

Describe the problem and resulting behavior.

## Validation

List the checks actually run and any remaining limitations.

## Reward and process review

When learning, rewards, gamification or Lab behavior changes, verify:

- [ ] XP, Practice Capital and streak credit reward learning or a verified process output; trades, trading frequency, risk and investment return earn none.
- [ ] No trade confetti, return leaderboard or price notification is introduced.
- [ ] Historical receipt amounts/versions, original completion dates and recorded access are preserved; learning capital remains a contribution rather than investment return.
- [ ] Any new award or disbursement has explicit versioned eligibility, authoritative evidence, lifetime idempotency and shared-lock concurrency coverage.

## Lesson content

When a lesson is added or changed, verify:

- [ ] Every step uses an existing kind from docs/education/lesson-steps.md; no new lesson components, styles or layouts.
- [ ] Screenshots of each step at 390 px and 1440 px are attached and match the PNGs in docs/design/lesson-steps.
- [ ] Graded steps: one per step, last block of the step, none on the final step; answers recomputed from inputs in tests.
- [ ] Tax/regulatory numbers come from the fact registry (`factNotice`), with the educational-content notice.
- [ ] Czech copy follows docs/terminology.md; amounts in Kč; no product recommendation, return promise or pressure to trade.
- [ ] Examples and charts are labelled (model example / sample data / dated observation) with source, period and limitations; dated values use fact tokens, not hard-coded numbers.
- [ ] Keyboard, visible focus, labels, non-colour feedback, text alternative for charts; 320 px and 200% text without horizontal overflow.
- [ ] A `factContext.kind` "tax" or "regulatory" lesson being published or changed has a new expert review record in src/features/facts/content-reviews.ts and docs/education/reviews.md (docs/education/editorial-workflow.md).
