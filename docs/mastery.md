# Dovednosti a smíšený checkpoint

Issue #122. Mastery is separate from lesson completion: it never changes completions, XP, Practice Capital, unlocks or lesson access.

## Evidence

- **Item bank** (`skillItems` in `src/features/learning/curriculum.ts`): graded questions that evidence one skill, keyed `${lessonId}/${blockId}`. Only these questions record attempts. Today it holds the Foundations (1.1) questions; adding an item is a registry change, tested against the lesson's blocks and placement skills.
- **`skill_attempt`** (append-only): user, skill, item, `correct`, `context` (`lesson` / `checkpoint` / `review`), time. The primary key `(user_id, request_id)` makes a retried submission land once. The server re-evaluates the authored question (`evaluateQuestion`); the client never sends a verdict.
- A lesson Check records a `lesson` attempt in the background. A mixed-checkpoint answer is `checkpoint`, or `review` when the skill is already Zvládnuté (decided under the account row lock).

## State (derived, never stored)

`skillLevel` in `src/features/mastery/domain.ts` replays a skill's attempts in time order:

| Stav | Rule |
| --- | --- |
| Zkoušeno | any attempt |
| Známé | a correct lesson answer, or a completed lesson containing an item of the skill (no backfill) |
| Zvládnuté | a correct checkpoint answer |
| Ovládnuté | a correct review at least 7 days after reaching Zvládnuté |

A wrong review lowers the state one level (never below Zkoušeno) and restarts the 7-day delay. Wrong lesson or checkpoint answers never lower it. The 7 days and the rules are the #122 design proposal, to validate with learners.

## Mixed checkpoint

`/learn/checkpoint/{code}` exists for each display module whose items span at least two lessons (today 1.1). It shows one item per skill, dealt round-robin across lessons so consecutive questions come from different lessons. The draw is seeded by user and UTC day: a reload shows the same set, another day may pick other items for skills with several. Each question has one attempt; the verdict shown is the server's. Progress shows each skill's state and links to the checkpoint.

## Data lifecycle

Attempts cascade with the user, are part of the account export (`skillAttempts`) and move with a claimed guest (original times kept). Demo identities are deleted with their attempts.

Validation: `npm run test:mastery-persistence` (`MASTERY_QA_DISPOSABLE=1`, local DB) and `npm run test:mastery-browser` (`MASTERY_TEST_URL`).
