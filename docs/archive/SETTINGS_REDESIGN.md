# Settings redesign

## Implementation and design authority

Implemented `/settings` from the current Pen.dev boards `eOnpj` (desktop), `CmVIu` (mobile), `Eu6C6` (Settings components), and `V7mUpG` (current Design System). Earlier Pop concepts were not combined with these boards. Hierarchy, geometry, typography, colors, components, asset references and the boards' explicit assumptions were read through Pen MCP.

Desktop uses the account overview and section navigation (64px gutters, 248px navigation, 96px gap, 800px content). Mobile uses a root list followed by focused details and a back action. The root retains app tabs; mobile details follow the board's focused layout. Container queries reflow enlarged text instead of shrinking it. Existing Manrope/Inter paper tokens and Button primitives are reused. Muted destructive-action colors come from the Settings component masters.

Working actions:

- Load real account identity, registration date, published lesson completion count, email and linked sign-in methods.
- Edit and validate the display name using Better Auth's existing update-user service. Saving blocks duplicate submissions; failures retain entered text; success refreshes session and shell identity.
- Edit goal, experience and all seven supported interests using the existing authenticated preference action. Drafts survive section navigation; failures retain every selection; successful saves retain diagnostics, progress and rewards.
- Save session length immediately from the summary, with pending, success, error and retry states. Successful saves restore keyboard focus so native arrow-key selection can continue. In the full editor, session length is part of the explicit save. All four persisted values remain supported.
- Enter personalization or retake the diagnostic through the existing onboarding routes.
- View the app's current Czech language, currency and learning time-zone values.
- Manage configured Google/Facebook sign-in methods, with real loading/retry behavior, normalized errors, duplicate prevention and unlink confirmation. Better Auth's last-sign-in protection remains authoritative.
- Sign out through Better Auth, including failure/retry and unsaved-change confirmation.
- Reset an unlocked Portfolio Lab through the existing idempotent action, with confirmation, busy/error/retry states, Escape handling, modal focus and focus return.

There are no decorative switches, fake saves, placeholder feedback submissions or dead-end actions.

## Preserved contracts

No changes to authentication configuration, database schema, migrations, preference/recommendation repositories, diagnostic semantics, learning progress, rewards, financial arithmetic, market-data/provider contracts, concurrency or server authority. Existing account deletion/export/privacy actions did not exist in the inspected Settings implementation. Learning, Progress and Onboarding UI were not redesigned. Shell changes are limited to Settings adopting the existing paper theme and its mobile detail layout.

Reset still closes a generation, restores legitimately earned capital, preserves previous trades and generations, and does not reset learning or grant new rewards. The client sends only the existing idempotency key. Anonymous demo identities remain server-backed, isolated and limited to the existing 24-hour lifecycle.

## Unsupported design controls

These board proposals were deliberately omitted because no supporting persistence/service or approved product requirement exists:

- Email notifications and weekly summaries.
- Light/dark/system appearance, an additional motion preference and currency-display toggle. System reduced motion remains respected.
- Lesson-progress reset.
- Data export, account deletion, backup-deletion deadlines and confirmation emails.
- Legal-document destinations and a help/feedback submission service.
- Apple sign-in and email-link sign-in.
- The proposed guest profile with browser-only data and an automatic migration promise.

## Intentional design differences

- Real identity, dates, progress and sign-in methods replace fictional board values; no invented XP, portfolio balances or export sizes are shown.
- Four stored session lengths replace the proposed three choices. Session wording matches the current contract rather than promising that authored lessons change length.
- Goal changes describe current recommendation/context behavior; they do not promise unsupported lesson reordering.
- All existing interests remain editable even though the board's goal editor only shows goal and experience.
- The reset confirmation uses earned capital, preserves audit history and makes no fixed 10,000 Kč or permanent-deletion claim.
- The existing shared account menu is retained; its real full name may make it wider than the board's fictional first-name menu.
- Unsupported navigation rows are omitted; existing sign-in management has its own section.
- Enlarged text uses a narrower-layout presentation when needed. Long email addresses wrap.

## Files changed by this task

- `src/app/(app)/settings/page.tsx`, `loading.tsx`, `error.tsx`.
- `src/components/settings/settings-experience.tsx`, `settings-preferences.tsx`, `portfolio-reset.tsx`, `settings-model.ts`, `settings-model.test.ts`, `settings.module.css`.
- `src/components/auth/account-security.tsx`.
- Settings-scoped additions in `src/components/app-shell.tsx` and `src/components/shell/paper-shell.module.css`.
- `src/styles/paper-tokens.css` (three muted danger tokens).
- `public/investi-assets/guide/17-reading-armchair.webp` and provenance in `public/investi-assets/manifest.json`.
- `scripts/validate-settings.mjs`, `scripts/settings-browser-fixtures.mts`, and the `test:settings` script in `package.json`.
- Updated Settings navigation/assertions in the personalization, compatibility, onboarding and product-shell browser suites. The personalization request-capture race now waits for the actual Server Action request; stale replay assertions remain in place.
- This report. Comparison screenshots/HTML are in ignored `test-results/settings/`.

Concurrent Backtesting changes appeared during this task. They were preserved, including their shared-file edits and test script; they are not part of the Settings implementation. The pre-existing untracked Pen file and product inventory remain untracked.

## Screenshot comparison

Open `test-results/settings/comparison.html` to compare the actual exported Pen screens and production-browser captures side by side. The comparison includes desktop overview, mobile root, mobile identity and mobile goal/pace. Additional captures cover editor, learning, format, security, locked Lab, demo identity and failures.

The browser comparison confirmed the paper palette, type pairing, sidebar/content geometry, original guide placement, identity rows, native choice states and focused mobile details. The first checks found text clipping at tablet/200% and small-phone/200%; reflow, guide sizing and a Czech hyphenation opportunity corrected those cases. Final checks cover 320, 390, 768, 1024 and 1440px, plus 200% text at 320, 768 and 1440px. Differences are the explicitly listed data/product-contract changes, rather than unsupported controls copied into the app.

## Validation

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 77 files, 743 tests passed.
- `npm run build`: passed with the repository's default Turbopack production build. An earlier attempt was blocked while concurrent Backtesting files were incomplete; the final build includes the completed current working tree.
- `test:personalization-persistence`: passed on an isolated local database, including fresh/upgrade migration and rerun, canonical seed, legacy/null/draft profiles, strict validation, idempotent completion, retake, skip, cascade and unchanged progress/rewards/trades.
- `test:personalization-browser`: passed, including all Settings choices retained after network/validation failures, saving/duplicate prevention/reload, stale initial replay, retake failure/retry and preserved accounting/progress.
- `test:onboarding-redesign`: passed, including initial/retake flows, expired-session draft recovery, preserved preferences/progress, keyboard completion and responsive/reduced-motion checks.
- `test:personalization-compatibility`: passed for new accounts and existing missing/incomplete profiles, including Settings saves and existing zero-capital Portfolio Lab access.
- `test:product`: passed for shell/navigation/account keyboard/reflow, sign-out/auth gates, focused lessons and the current Backtesting flow.
- `test:settings`: passed, checking identity loading/editing, invalid names, request failures/retries, session-length save/reload, cross-section drafts, account-load failure/retry, configured linking states/errors, unlink and last-login safeguard, sign-out/session transitions, demo isolation and real portfolio reset with immutable trade/history checks. The reset fixture includes a real authoritative 0.1-share purchase; previous trades, rewards and lesson progress remain byte-for-byte unchanged.

All browser acceptance used fresh isolated production runtimes and the disposable loopback PostgreSQL database `investi_6a3a_qa`, in a dedicated cluster on port 55436. The normal development/remote database was not migrated, reset or used for validation. OAuth controls were checked with dummy provider configuration and intercepted requests; live external OAuth consent was not exercised.

The Settings redesign is recorded as a separate implementation phase after successful validation. Publication follows the user’s explicit request. No branch switch or reset was performed; the design file and product inventory remain outside this implementation commit.
