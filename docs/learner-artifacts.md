# Learner artifacts

Issue #127 adds storage for outputs reused by later lessons and plans. It does not publish new lessons, add requirements to existing lessons, award rewards for outputs, or use learner-authored fees to execute Lab trades.

## Storage and contracts

`learner_artifact` holds one document per `(user_id, kind)` with append-only revisions. Each revision has its own UUID, positive monotonically increasing `version`, typed JSON payload, creation time, optional stable `source_lesson_id`, and a per-user request UUID. Current means highest revision number, not latest timestamp. No progress or reward migration is needed. Migration 0015 is additive; account deletion cascades through every revision. Deleting a source lesson only clears its attribution.

Payload contracts live in `src/features/artifacts/schemas.ts` and have exhaustive positive/negative tests. Current kinds are `goal_map`, `financial_checkup`, `fee_profile`, `etf_checklist`, `safeguards`, `investment_plan`, `trade_checklist`, `business_map`, `investment_thesis`, and `journal`. The thesis and business map represent the current exercise; a journal is a bounded collection of entries. Separate concurrent documents of the same kind are not supported by this initial contract. `version` counts document edits, not schema versions: future incompatible payload changes require an explicit compatibility/migration plan.

Schemas reject extra fields, bound text/collections, validate calendar dates, and keep educational money as canonical integer minor-unit strings and rates as integer basis points. The check-up saves categories and a next step; it has no income, expense, account identifier, or debt amount fields. Goal maps save purpose, horizon and priority without exact personal amounts. Free text should never request identifying or sensitive financial details.

## Server actions and consent

`saveArtifact({ content: { kind, payload }, sourceLessonId, consent: true, requestId })`, `listArtifacts({ kind? })`, and `deleteArtifact({ id })` derive the owner from the session. Inputs cannot specify an owner, revision, or creation time. Unknown sources and malformed payloads fail on the server. Actions return `{ ok: true, ... }` or a recoverable `{ ok: false, message }` without logging payloads or database errors. Listing returns current revisions, optionally filtered by kind; the account export includes all historical versions.

Every save requires an explicit consent value; lesson editors use `ArtifactSaveControl` to show an unchecked consent checkbox explaining reuse, history and deletion. It accepts typed content, a stable lesson ID (or `null` for an output created outside a lesson), and an optional saved callback. Keep editor drafts local until the learner chooses to save. Reuse the same request UUID while retrying the same input. Changed input needs a new UUID; reusing a UUID with different validated content is rejected.

Saves and deletes lock the same user row as lesson progression and account lifecycle operations. Concurrent saves allocate unique ordered revisions; concurrent retries create only one row. There is no update method. Deleting any owned revision removes **every version of that kind**. A foreign or already deleted ID is a harmless no-op, revealing no other learner's data. A later explicit save starts a new document at version 1.

Guests without a saved account cannot save, list, or delete artifacts, even with a valid anonymous guest session. Isolated demo identities can practice with artifacts; their normal deletion/cleanup removes all revisions. Guest claim behavior is unchanged because guests have no artifact rows to transfer.

## Lesson requirements

An authored `StepDefinition` may set `requiredArtifact: { kind: "goal_map" }`. By default, the current document must come from that same stable lesson ID. Explicit `source: "any_lesson"` permits reusing an output from another lesson. An editor and save control must be provided by the lesson that introduces a requirement; no existing published steps become gated here.

When moving forward, the progression transaction validates the current step's requirement against the owner's highest stored revision and its kind-specific schema. It never accepts a client presence flag. First completion rechecks **all** lesson requirements, including outputs deleted after passing a step. Both checks happen under the user lock, so they serialize with save/deletion. Missing or invalid outputs return a useful message through existing progress actions. Back navigation and lifetime completed-lesson reviews keep their existing behavior; deleting an output never revokes completion, changes timestamps, reissues receipts or relocks Lab.

## User controls and validation

Settings → Moje data lists current output names/revisions and lets the learner delete a complete history with inline confirmation. The existing account download exports every version with its payload, version, source and time. Owner and request keys are omitted. Account and anonymous cleanup use the existing user cascade.

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. `ARTIFACTS_QA_DISPOSABLE=1 npm run test:artifacts-persistence` requires an explicit local database named `investi_artifacts_qa`; it tests the migration chain and rerun, all kinds, concurrent versions/retries, owner isolation, guest rejection, export, deletion, requirement checks and lifetime progress/reward preservation. Run account-deletion and anonymous-cleanup integration tests only against a disposable database with their own opt-ins. `ARTIFACTS_QA_DISPOSABLE=1 npm run test:artifacts-browser` creates a temporary editor route and starts/stops its own dev server to test consent/retries and guest restrictions; it removes that route and its generated dev types afterward. To validate the shipped Settings deletion/export UI on a fresh production server, set `ARTIFACTS_TEST_URL` to its local URL. Both modes check keyboard focus, six responsive widths and 200% text.
