# Exercise blocks in the lesson engine

Issue [#121](https://github.com/Johnyyy1/Investnik/issues/121) extends `LessonBlock`; published lessons, stable IDs, step ordering, answer contracts, receipts and unlocks are unchanged. These are authoring primitives, not newly published curriculum.

## Graded questions

Every type shares `evaluateQuestion` on client and server. A complete valid answer returns `true` or `false`; missing, malformed or unknown selections return `undefined`. A blank numeric answer never becomes zero. Every forward cursor move is re-evaluated on the server inside the existing owner lock/transaction. A step accepts at most one graded question.

| Block | Authored data | Wire answer |
| --- | --- | --- |
| `categorizeQuestion` | Categories plus items with a correct `categoryId` | Each `itemId` maps to a `categoryId` |
| `orderQuestion` | Items plus a permutation `correctOrder` | Position keys `"0"` through `"9"` map to item IDs |
| `documentSearchQuestion` | A structured document with labeled text regions and a region or numeric target | `answer` is a region ID or numeric input |
| `findErrorQuestion` | Labeled solution steps and `incorrectStepId` | `answer` is a step ID |

Use stable nonblank IDs of at most 100 characters and at most ten items/regions. Ordering uses one ID per field instead of packing an array into one string. The shared answer keys and `feedbackFor` also cover these types alongside the existing `fadedExample`, `documentTap` and `findError`. The shared `lessonAnswersSchema` preserves the cursor action's ten-field/100-character limits. An ordering must use every item exactly once. Impossible definitions fail closed during step resolution. Existing MC/numeric/multi-numeric evaluations retain their semantics.

The UI uses native selects for categories and ordering, native radios for document regions and solution steps, and the shared numeric field for document values. No drag-and-drop is required. Check → textual live feedback → retry/continue remains the player's interaction. Retry focuses the first input or select.

## Ungraded activities

- `decisionTree`: a start node and explicit choices/outcomes. The learner can go back or restart; any branch can continue. Paths are ephemeral, have no grade and never gate a cursor move.
- `checklist`: a title and identified items. Any subset, including an empty set, can be saved with consent. Checking boxes and saving are optional for cursor progression.
- `rubricSelfAssessment`: a prompt and criteria, each with four described levels. The learner writes up to 2,000 characters and selects a level for every criterion. Submission requires nonblank text and complete ratings; **no minimum rating or text correctness** is required. The player enables Continue after explicit saving, and unsaved edits require a new submission. It reloads the saved output when revisiting a step.

The rubric automatically contributes an artifact requirement for its exact lesson/block. The progress repository checks it on forward moves and rechecks all required submissions at completion. A client `submitted` flag cannot satisfy it. A deleted output blocks only unfinished work; lifetime completion, timestamps and receipts remain authoritative.

## Saved outputs and migration

Migration `0017_calm_the_leader.sql` adds the `lesson_output` value to the existing artifact-kind enum. The graded types need no schema changes. Apply this additive migration before deploying the output controls; it rewrites no existing rows.

The existing #127 artifact actions own authentication, explicit consent, payload validation, append-only revisions, retry IDs, owner locking, export and deletion. `lesson_output` adds a validated checklist/rubric payload with `blockId`. The repository binds item/criterion IDs to the authored block in the stated source lesson. It checks this binding again when satisfying a requirement, including legacy/manual rows.

Ordinary artifact kinds retain one current document per kind. Exercise outputs have one current document per `(kind, source_lesson_id, blockId)`, with the existing per-kind monotonic revision numbers. Current-document listing returns each exercise, and deletion removes all revisions of only the selected exercise. Export includes every revision. Existing account/demo cascades apply; guest identities cannot persist outputs and see the existing account-saving action.

## Validation

`npm test` covers evaluators, malformed/incomplete answers, definition limits, ungraded semantics and published compatibility. With `ARTIFACTS_QA_DISPOSABLE=1` and a loopback `DATABASE_URL` ending in `/investi_artifacts_qa`:

- `npm run test:artifacts-persistence` preserves the existing artifact regression suite.
- `npm run test:lesson-exercises-persistence` checks real progression, authored submission validation, ownership, lowest-level rubric submission, retry/concurrent rewards, scoped deletion, export and cascades.
- `npm run test:lesson-exercises-browser` starts an isolated dev runtime at `EXERCISES_TEST_URL` (or `BETTER_AUTH_URL`). It temporarily installs fictional exercise fixtures into the first lesson, restores both source files byte-for-byte in `finally`, and removes its identity. Do not run it concurrently with builds or other lesson suites. It checks the actual player/actions, keyboard selection and retry focus, accessible names/live feedback, consent, reload and completion at 1440, 1024, 768, 390, 375 and 320 px, plus 200% text. Captures are saved at 1440, 390 and 320 px. Screenshots and the server log go to ignored `test-results/lesson-exercises/`.

The browser assertions inspect the accessibility tree and native keyboard behavior; they do not substitute for a hardware screen-reader test. No preview lessons or diagnostic routes are published.
