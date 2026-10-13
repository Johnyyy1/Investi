# Onboarding and learning preferences

New learners see an authenticated Czech flow: primary goal, optional interests, experience, preferred session length, five diagnostic questions, and a saved recommended plan. Skipping uses the authoritative safe-default action. Completing or skipping personalization creates no lesson progress, XP, Practice Capital, entitlement, portfolio, or trade.

## Presentation scope and authority

`/onboarding`, its loading state, and `/onboarding/plan` extend the existing paper and teal Studovna system in [DESIGN.md](../DESIGN.md): Manrope headings, Inter controls and explanation, semantic paper surfaces, and distinct action/progress teals. This is a scoped presentation extension. It adds no design tokens and changes no schema, migration, authentication, action, repository, diagnostic evaluation, recommendation engine, reward, or financial contract.

The approved references are the root `investi-design.pen` boards `wKThC` (desktop), `Ui4uz` (mobile), `Z9Mlw` (plans), `XFfjW` (components), and `V507P` (guide illustration library). The implementation adapts their composition to supported product behavior. The mockup's three-question shortcut, ETF shortcut, mini lesson, and authentication after the value preview are not implemented: the existing four preference steps, five-question diagnostic, authored lessons, prerequisites, and authentication before the flow remain authoritative. Mockup lesson titles and five-minute estimates do not replace catalog content or durations.

Presentation sources are [PersonalizationFlow](../src/components/personalization/personalization-flow.tsx), [OnboardingHeader and OnboardingGuide](../src/components/personalization/onboarding-frame.tsx), [OnboardingChoice](../src/components/personalization/onboarding-choice.tsx), [PreferenceFields](../src/components/personalization/preference-fields.tsx), [StudyPlan](../src/components/personalization/study-plan.tsx), and their [CSS](../src/components/personalization/personalization-flow.module.css). Guide poses use the supplied artwork exported from the illustration library; [the asset manifest](../public/investi-assets/manifest.json) records provenance.

## Flow and saved plan

The question flow has one centered editorial surface, capped at 640px on desktop and 350px at a 390px viewport. The saved plan caps at 560px. Mobile uses 20px gutters, falling to 16px below 360px; controls and curriculum rows reflow for narrow or enlarged-text layouts. These widths describe this composition rather than new global layout tokens.

The four preference steps preserve their existing meanings:

| Step | Control and continuation |
| --- | --- |
| Primary goal | One native radio selection; required before continuing. |
| Interests | Native checkboxes; any number of supported interests, including none. |
| Experience | One native radio selection; self-assessment is distinct from diagnostic evidence. |
| Session length | One native radio selection; 5, 10, 15–20, or 30+ minutes is an approximate session preference. |

After the diagnostic introduction, each of the five questions requires an answer before the explicit next action. Selecting an option never advances the flow. The header contains Back and a labeled progress bar; the sixth labeled stage is the saved plan. Back preserves selections. The guide's bubble and supplied pose respond to goal, interests, experience, tempo, diagnostic topic, selection, saving, or recoverable failure. A diagnostic selection is acknowledged without revealing correctness or evaluating the answer in the client.

Guest requests redirect to sign-in. Original onboarding completion and personalized completion remain separate. `/onboarding?personalize=1` offers the flow to a learner who has not personalized; an already personalized learner goes to the saved plan. `/onboarding?retake=1` offers the diagnostic-only retake after personalized completion, with a Settings exit. Plain `/onboarding` does not re-gate returning learners who already meet the compatibility rules. The plan route requires an authenticated learner whose original onboarding gate is complete.

`StudyPlan` reads the server-loaded profile, recommendation, and lesson states. The dominant action links to the actual recommended published lesson. The plan explains goal context, diagnostic-derived guidance, and session preference, with expandable session planning from `sessionLessonIds`. Lesson titles, summaries, links, estimated durations, and chapter membership resolve through the real curriculum. Completed lessons and the recommended next step use saved progress plus textual status; planned chapters remain labeled “Připravujeme.” Complete or unavailable recommendations show an explicit state and a route to the curriculum. The plan links to Studovna and Settings for continuation or preference changes.

Choices retain labeled native radio/checkbox behavior inside fieldsets, with whole-option focus and selected checkmarks as well as color. Step changes focus the heading. Progress and guide updates have accessible status semantics, and errors use an alert. Saving disables the choices and submission while showing busy state. Primary actions are at least 52px high and choices at least 56px; quieter header actions are at least 44px. Reduced motion disables the local step, progress, and spinner animations.

## Storage and compatibility

There is one `learning_profile` row per user, cascading on account deletion. Personalization reuses `goals[]` for zero or one primary goal, `interests[]`, `experienceLevel`, and `dailyGoalMinutes` for session length. Migration `0009` adds nullable `diagnosticResult` and `personalizedOnboardingCompletedAt`, plus the `LONG_TERM_ETF`, `DATA`, and `BACKTESTING` enum values. It does not rewrite existing rows.

Legacy reads select the first supported goal, omit the old MARKETS interest, map ADVANCED to INVESTOR, and map 15 minutes to the 20-minute session bucket. Reads preserve the original stored values. Legacy `recommendedStart` is not the source of current recommendation decisions.

Existing users retain app access with an original onboarding completion marker or any learning history, award, entitlement, or portfolio. Missing/incomplete profiles do not block those users. Learn offers dismissible optional personalization; Settings edits the same profile and permits a diagnostic retake after personalization is complete.

The old onboarding repository remains exercised by persistence and compatibility tests. The unused old UI server actions and their superseded action tests have been retired. Their conditional writes protect completed profiles against stale tabs. Removing that compatibility surface requires a separate persistence-contract review.

## Diagnostic and recommendations

`FOUNDATIONS_DIAGNOSTIC_V1` covers simple return, compounding, portfolio weight, bid/ask, and diversification. Clients send only versioned answer IDs. Strict schemas reject extra owner, score, correctness, or reward fields. The server evaluates answers and stores concept evidence. Reads recompute derived count/level; unknown stored versions supply no current evidence.

Evidence is coarse: 0–1 correct gives `foundations_needed`, 2–3 gives `partial_foundations`, and 4–5 gives `strong_foundations`. Self-assessment cannot override it. There is no public rank, diagnostic history, or credential.

`recommendLearning` uses normalized preferences, actual lesson progress, the published curriculum, and prerequisites. Unfinished Foundations take precedence. Returns recommendations require all seven Foundations completions. It selects the next incomplete published Returns lesson after Foundations; completed/unpublished lessons are never recommended as new learning. Goal and interests vary the explanation/context. All complete returns a null next lesson and `CURRICULUM_COMPLETE`.

The domain returns scaffold level (guided/standard/compact), example context, and approximate session planning, capped at three eligible lessons. A lesson longer than the session remains eligible and may span sessions. These outputs do not create alternate lesson content, mastery requirements, or rewards. Active-learning continuity is handled separately by the learner summary.

## Writes and recovery

Actions derive ownership from the session and repositories validate again. Initial completion saves preferences and server-evaluated diagnostic in one conditional upsert. Duplicate/stale completion cannot overwrite a personalized profile. Preference edits preserve diagnostic evidence and completion timestamps. Retakes replace the latest diagnostic and updated timestamp, preserving the original completion markers.

Skip applies neutral defaults: no goals/interests, BEGINNER, ten minutes, no diagnostic. It completes the original gate while leaving personalized completion null. A stale skip cannot erase a completed profile. No profile mutation alters lesson receipts, progress, unlocks, capital, portfolios, or immutable trades.

The browser-tab draft is scoped to the user and initial/retake mode. Disabled storage leaves a working form that restarts after refresh. Failed saves preserve attempted values and expose retry. Dismissal is a local UI preference.

## Validation workflow

Use `npm run test:personalization-persistence` with an explicitly supplied, empty disposable loopback PostgreSQL database named `investi_6a3a_qa`, `PERSONALIZATION_QA_DISPOSABLE=1`, deterministic market/FX providers, a local `BETTER_AUTH_URL`, and a test secret. The harness refuses other hosts/names, absent opt-in, non-deterministic providers, or a non-empty database before migration. It tests historical upgrade, migration rerun, seed, legacy reads, stale/concurrent writes, retakes, cascade, and unchanged financial/learning records.

Against a fresh isolated local app using that database and the same environment, set `PERSONALIZATION_TEST_URL` and run:

```sh
npm run test:personalization-compatibility
npm run test:personalization-browser
npm run test:onboarding-redesign
```

The compatibility suite preserves legacy app access and preference behavior. The full personalization browser suite covers recovery, failures, double submits, recommendations, Settings, keyboard operation, and responsive reflow. The onboarding presentation suite adds guide states, explicit continuation, Back/refresh recovery, failed and invalid saves, disabled saving, expired-session draft recovery, skip and retake routes, real plan/session differences, and unchanged learning/financial records. It checks loaded artwork, visible focus, native controls, touch targets, reduced motion, header separation, no horizontal overflow, and essential-text reflow at 1440, 1024, 768, 390, 375, and 320px plus 200% text at 320px.

Run the presentation suite with the same loopback `investi_6a3a_qa` database, disposable opt-in, and deterministic provider environment as the existing harnesses; never point it at the normal development database. It creates temporary accounts and deletes those accounts afterward. Screenshots default to `/tmp/investi-onboarding-redesign`; `PERSONALIZATION_SCREENSHOT_DIR` may select another temporary output directory. Inspect the captures against the approved references after the run. Use a fresh runtime for final browser validation after a build.

The browser suites use desktop Chrome with viewport and input emulation. Their checks do not establish physical-device or screen-reader validation. The static gates remain `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`; the study-plan unit tests cover catalog durations, session length, progress, completed curriculum, unavailable recommendations, and preserved Foundations prerequisites.

Deferred work includes lesson-level scaffold adaptation, diagnostic history, physical-device/screen-reader verification, and eventual retirement of legacy preference contracts.
