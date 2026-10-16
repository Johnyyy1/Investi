# investi product design system

The marketing landing page defines the expressive brand identity; product surfaces use the same palette and typography more quietly. This document describes the shared tokens and primitives used by the current application.

Preview the foundation at `/dev/design-system` under `npm run dev`. The route returns 404 in production and is excluded from normal navigation. All rewards, chart values, and learner state in the preview are illustrative.

## Architecture

`src/styles/learning-tokens.css` is the canonical token layer. It registers semantic Tailwind v4 tokens for new code and keeps the existing `ql-*` tokens as aliases. This compatibility layer lets current Learn, Labs, Progress, Settings, onboarding, auth, and lesson screens inherit the new palette and scale without a fragile class-name rewrite.

New reusable UI primitives live in `src/components/ui`:

| Primitive | Responsibility |
| --- | --- |
| `Button`, `ButtonLink`, `IconButton` | Primary, secondary, ghost, success, and danger actions; loading and disabled states |
| `Input`, `Textarea`, `Select`, `Slider` | Native, accessible controls with one sizing, focus, and disabled treatment |
| `Progress` | Clamped accessible progress value and shared track/fill styling |
| `Badge` | Compact neutral or semantic status label |
| `Surface` | Flat, raised, and floating surface hierarchy |
| `Feedback` / `feedbackVariants` | Correct, incorrect, warning, informational, and completed surfaces |

Existing learning APIs remain stable. `LearningButton`, `LearningLink`, and `LearningProgressBar` are compatibility exports or wrappers over the canonical primitives. `FinanceInput`, `TextInput`, lesson feedback, concept cards, charts, and lab controls now share the same underlying styles.

Portfolio order/review overlays implement their own accessible dialog behavior. Native details/summary interactions remain in use. No speculative dialog or tooltip library is installed.

## Color tokens

The exact approved brand palette is available as `investi-*` tokens:

| Brand token | Value | Semantic use |
| --- | --- | --- |
| Warm White | `#F8F6F0` | Product background |
| Investi Blue | `#2498F3` | Primary action and data series |
| Deep Blue | `#1667B2` | Hover, link, focus, progress fill |
| Navy | `#17324A` | Main text |
| Pale Blue | `#DFF2FF` | Selected and informational surfaces |
| Investi Green | `#42C98A` | Success, correct, completion, growth |
| Warm Accent | `#FFB85C` | Warning and restrained emphasis |
| Data Dark | `#102D4C` | Data and accessible text on bright brand fills |

New code should choose semantic roles such as `background`, `foreground`, `surface`, `surface-muted`, `primary`, `primary-hover`, `success`, `warning`, `danger`, `border`, or `data-*`. Avoid raw color values in product components. Green is semantic, not general decoration.

Bright Investi Blue does not have enough contrast with white for normal-sized button copy. Primary buttons therefore use Data Dark on the default fill and switch to white on Deep Blue hover. Automated tests protect the intended text/surface pairs, semantic feedback pairs, and progress contrast.

## Typography and spacing

The product continues to use Nunito Sans—the body family already shared with the approved landing page—through `next/font`. The application scale is:

- 36–48px responsive page title (`page-title`)
- 28px major section heading (`section-title`)
- 20px card heading (`card-title`)
- 18px emphasis (`emphasis`)
- 16px body (`body`)
- 15px secondary copy and labels (`small`)
- 13px microcopy (`microcopy`)

Existing `text-ql-*` utilities map onto this scale. Prefer regular, semibold, or bold weights; reserve the landing page's oversized 800-weight display treatment for marketing.

Spacing follows the existing four-pixel rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, and 80px. Semantic CSS aliases are `--space-*`; `--ql-space-*` remains compatible.

## Radius, elevation, and motion

The radius hierarchy is 12px controls, 16px buttons, 24px surfaces, and 30px large panels. A 10px compact radius and full pill radius are available for specialized components. Existing `rounded-ql-*` utilities map onto the appropriate new level.

Elevation has three levels:

- level 0: flat
- level 1: subtle surface separation
- level 2: floating menus, dialogs, or other overlays

Application shadows stay restrained. Marketing gradients, glows, glass, tilted cards, and scenery are not product primitives.

Motion uses 180ms micro interactions, 270ms surface transitions, and 400ms larger entries with a restrained ease-out curve. No continuous animation was added. CSS and Motion-based components both remove nonessential movement under `prefers-reduced-motion`.

## Accessibility and behavior boundaries

Focus-visible treatment is a three-pixel Deep Blue outline with separation from the control. Native controls retain labels, touch targets, keyboard behavior, disabled semantics, and error descriptions. Correctness is always communicated with text/state in addition to color.

Design-system work must preserve authentication, sessions, reward policy, streaks, persisted progress, lesson completion, demo isolation, database behavior, and financial calculations.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. With the development server running, use `npm run test:design-system-browser` and the other existing `scripts/validate-*.mjs` browser suites as their environment permits. Production isolation must still return HTTP 404 for `/dev/design-system`.
