# Published lesson compatibility

Curriculum 2.0 must preserve a learner's saved work and earned entitlements. This is the compatibility policy for #119 and the published-lesson section of the authoring standard in #135. Display placement belongs to the registry in #118; changes to reward or unlock policy belong to #120.

## Identity and persistence

- After publication, keep `lesson.id`, `module_id`, lesson slug and module slug stable. A display-module move changes registry metadata only. Existing `/learn/{moduleSlug}/{lessonSlug}` and module overview routes remain valid.
- `seedCurriculum` updates editorial fields and publication/order metadata. Its conflict path deliberately never updates lesson ownership or slugs. Never use a display move to change the DB module. Policy v4 prices new receipts by registered curriculum level; any placement change affecting future reward eligibility is a deliberate reward-policy decision, never an incidental content edit.
- Never delete lessons, progress, awards or recorded unlocks to reorganize content. Never downgrade `completed` or change its `completedAt`. Review does not move its saved cursor or award anything again.
- Stored XP, Practice Capital amounts and reward policy versions remain authoritative. Do not recalculate or backfill receipts when changing content.
- Portfolio Lab retains the original seven Foundations prerequisite IDs and 420 XP. Publishing more Foundations lessons does not add prerequisites. An existing `progression_unlock` is permanent; an eligible account without a record still receives its one-time grant.

## Editing published steps without a content-version migration

`lesson_progress.last_position` is a zero-based step index. It proves that the server accepted every previous graded step; it is not a block ID or a record of all past answers. Clamping an index on the lesson page does not migrate that proof.

For an existing published lesson:

1. Keep all existing steps in order, with their block IDs, question IDs, question types and grading contracts (option IDs/correct answer, numeric answers and tolerances). Do not insert, remove, split or reorder steps before an existing saved position. Copy and explanation corrections within the same blocks are allowed when they preserve what was assessed.
2. The only unversioned structural extension is one or more **ungraded explanatory steps immediately before the existing final step**. Preserve the original final step and keep it question-free. Do not append anything after it or add a graded question to the inserted steps.
3. An in-progress learner at the old final index now sees the first inserted explanation and continues to the new final step before completing. Earlier cursors still refer to exactly the same content and questions. Already completed learners stay completed and can review without changing progress or rewards.
4. Keep at most one graded question per step and none on the final step. `validateMove` still re-evaluates the correct answer before advancing; `validateCompletion` still requires the final saved step for an unfinished lesson.
5. Do not extend published checkpoints, including `returns-checkpoint`, by changing their steps. Add new mastery items under #122 instead; prior checkpoint completion stays valid.

Changes outside these rules need a separately designed, additive content-version/cursor migration **before publication**, or new lesson/mastery IDs. A migration must map unfinished learners to an explicitly safe section boundary, preserve completed status and dates, and preserve receipts and recorded unlocks. Do not simply reset everyone or regenerate the compatibility fixture. #119 does not add `content_version`: the compatible extension above needs no DB migration.

## Regression checks and author review

`src/features/lessons/published-lessons-v1.json` records the identity and step/grading contracts of the original 27 lessons. `published-compatibility.test.ts` compares current content against that historical contract, permits the explanatory insertion above, and rejects incompatible edits. Preserve existing entries; add a contract when publishing a new lesson. A failing contract is a migration decision, not a snapshot-update task.

Before publishing, review identity/URLs, saved-index meaning, grading, checkpoint completion and reward invariants, then run:

```sh
npm test -- src/features/lessons/published-compatibility.test.ts src/features/progress/transition.test.ts src/features/progression/unlocks.test.ts
npm run test:curriculum-seed
CURRICULUM_QA_DISPOSABLE=1 npm run test:curriculum-compatibility
npm run test:migration
npm run test:persistence
npm run test:progression-persistence
npm run test:product
npm run test:progress-browser
```

Run persistence, migration and browser checks against a migrated and seeded **disposable local PostgreSQL database**, never the normal development database. The compatibility script temporarily publishes three extra Foundations rows and inserts an ungraded step in memory, then restores its fixtures. It checks unfinished learners before and at the old final step, completed lessons/checkpoints, mixed v1–v4 receipts and concurrent one-time unlocking. Also run the repository's lint, typecheck, unit-test and build gates.
