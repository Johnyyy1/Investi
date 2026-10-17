# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Learners moving from first investing concepts toward more analytical and quantitative thinking. The product is beginner-friendly and supports returning to saved work at the learner's own pace.

## Product Purpose

investi helps people learn investing by doing: learn a concept, make a decision, predict, test or reveal, see the consequences, understand why, and retry or continue.

## Positioning

An interactive educational product connecting Learn, Practice Capital, Portfolio Lab, Scenario Challenges, and Backtesting Lab. It prepares learners for investing workflows without acting as a real broker, real-money trading platform, day-trading simulator, or investment-advice engine.

## Operating Context

Authenticated navigation contains Learn, Lab, and Progress; settings live behind the account area. Focused lesson routes bypass the normal shell. Continue learning is the dominant action for returning learners. Lessons preserve interaction → answer → feedback → persisted continuation → completion → reward → next.

## Capabilities and Constraints

- Published authored lessons and saved learner progress drive the Studovna at `/learn`; previews use the saved cursor rather than a later exercise. Personalization remains available, with a quieter catalog-resolved recommended lesson link when its target differs from the saved continuation.
- Authenticated onboarding captures learning preferences and a five-question diagnostic, then presents a saved plan from the existing recommendation, curriculum, and learner progress. Guidance, context, and approximate session planning adapt without skipping lessons, changing access, or awarding Practice Capital.
- Practice Capital is derived from authoritative lesson reward receipts and recorded progression grants. Under the active policy v3, Foundations lessons earn XP only, finishing Foundations unlocks Portfolio Lab with a one-time 5,000 Kč, and each lesson outside Foundations adds 2,000 Kč; legacy receipt amounts remain authoritative. Reviews earn no additional capital, and Practice Capital is never derived from XP.
- Portfolio Lab is an educational paper portfolio. Learning rewards are contributions: they increase capital and cash without changing investment P&L. Money accounting uses integer minor units, centralized rounding, and server-authoritative values.
- Trades are append-only, long-only, and cannot create negative cash or sell more than the learner holds. Resets create a new generation while preserving receipts, progress, old trades, and audit history. Retries and concurrent mutations must remain safe.
- Studovna shows a read-only presentation of the existing portfolio view. ETFs remain their own category; underlying allocation is not inferred. Missing prices or FX produce an explicit incomplete state, never zero or invented values.
- Deterministic market data is labeled as sample or educational data. Provider-specific behavior stays behind the market-data abstraction.
- Backtesting Lab is implemented and linked from Studovna. Its question is “How would this idea have behaved?” Portfolio Lab's question is “What do I own?” Scenario Challenges remain a future/ongoing layer separate from the personal portfolio.
- Better Auth anonymous demo identities remain isolated, deterministic, and idempotent; visits must preserve user mutations.

## Brand Commitments

Always write the product name as **investi**; only the typeset wordmark shows **investi!**. UI terms follow the glossary in [docs/terminology.md](docs/terminology.md). The primary line is **Learn investing by doing.** The voice is intelligent, approachable, playful, direct, and optimistic. Product interfaces are calm, precise, readable, and beginner-friendly.

The user approved the final Pen.dev design system and Studovna boards. The visual implementation is staged; [DESIGN.md](DESIGN.md) records its current scope without changing product behavior.

## Voice and Tone

Czech copy addresses the learner with *ty* and without grammatical gender. Use the present or future tense, the imperative, or a noun instead of a gendered past tense or adjective:

- „Pokračuj tam, kde to máš rozdělané.“, not „Naváž tam, kde jsi skončil.“
- „Jaké máš zkušenosti s investováním?“, not „Jak bys popsal své zkušenosti?“
- „Až se k tomu vrátíš“, not „Až budeš připravený“
- „Tvůj tip byl …“ or „Vybraná strategie …“, not „Zvolil/a jsi …“
- „Přihlas se znovu a pokračuj v Portfolio Labu.“, not „abys mohl(a) používat …“

Never use slashed or bracketed forms such as „/a“ or „(a)“. The guide persona may speak about itself in its own voice („Rád tě zase vidím“), and lessons may describe *investor* as a third-person role. `src/lib/copy-voice.test.ts` flags the common gendered patterns in `src`.

## Evidence on Hand

[AGENTS.md](AGENTS.md) supplies the product and accounting rules. The authored lesson registry, `loadLearner`, and `PortfolioView` supply real content and state. Final visual references are `investi-design.pen` boards `V7mUpG` (design system), `QB1gf` (desktop), `liRhy` (mobile), and `mAWd8` (states). User-supplied guide assets are tracked in [public/investi-assets/manifest.json](public/investi-assets/manifest.json). Do not invent balances, allocation, metrics, testimonials, or proof.

## Product Principles

- Make the familiar investing workflow clear, then layer education onto it.
- Connect learning decisions to explainable consequences and a persistent next step.
- Favor correct, explainable, auditable finance behavior over visual novelty.
- Keep financial authority on the server and accounting derivable from authoritative records.
- Make errors recoverable and unavailable data explicit.

## Accessibility & Inclusion

Require keyboard access, visible focus, correct labels, semantic lists and tables, accessible modal behavior where relevant, touch targets around 44–48px where practical, reduced motion, and status that does not rely on color alone. Reflow must support 200% text and widths 1440, 1024, 768, 390, 375, and 320px without horizontal overflow or shrinking essential text.
