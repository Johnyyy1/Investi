# Investník product design system

Investník has one visual system for marketing and product: warm paper, ink text, a dark teal primary action, Manrope headings and Inter text. [DESIGN.md](../DESIGN.md) describes its character and components; this document covers how code uses it.

Preview the foundation at `/dev/design-system` under `npm run dev`. The route returns 404 in production and is excluded from normal navigation. All rewards, chart values, and learner state in the preview are illustrative.

## Architecture

- `src/styles/tokens.css` is the only token file. Every token is a semantic role registered with Tailwind v4 `@theme`, so it is available both as a utility (`bg-primary`, `text-secondary`, `rounded-surface`) and as a CSS variable (`var(--color-primary)`) for CSS modules. There are no raw palette names, no `ql-*` aliases and no route-scoped overrides.
- `src/styles/fonts.ts` loads Manrope and Inter through `next/font` (Latin and Latin Extended). The root layout puts their variables on `<html>`; `--font-display` and `--font-sans` resolve them.
- The root layout applies `.investi-theme` once: page colour, body font, heading font, focus ring, selection colour and the reduced-motion rule. Screens do not add their own theme wrapper.
- `src/lib/utils.ts` configures `tailwind-merge` with the custom type, radius and shadow scales, so `cn("text-small text-secondary")` keeps both classes.

`src/styles/tokens.test.ts` checks contrast pairs, the radius and elevation hierarchy, the font pairing, that no legacy names come back, and that product CSS modules use only defined tokens and no raw colours.

## Color roles

| Role | Value | Use |
| --- | --- | --- |
| `background` | `#F7F2E8` | Page |
| `surface` / `surface-muted` / `surface-sunken` / `surface-practice` | `#FFFCF7` / `#EFECE3` / `#F7F5EF` / `#EFF1E9` | Content surfaces, quiet separation, recap |
| `foreground` / `secondary` / `muted` / `disabled` | `#171717` / `#41443E` / `#55594F` / `#6B6E66` | Text emphasis, in order |
| `primary` / `primary-hover` / `primary-pressed` | `#236F66` / `#1C665E` / `#195B53` | The primary action, links, active navigation |
| `primary-foreground` | `#FFFFFF` | Text on primary |
| `primary-soft` / `primary-tint` | `#E6F0E9` / `#A9D1CA` | Current and correct states, selection |
| `progress` | `#2F8F83` | Progress fills and charts; never text |
| `border` / `border-card` / `divider` / `border-strong` / `track` | `#D5D2C8` / `#CBC9BF` / `#E3E0D7` / `#73776D` / `#E4E5DC` | Structure, from quiet to interactive (3:1) |
| `success*` | aliases of the teal roles | Correct and completed feedback |
| `warning` / `warning-soft` / `warning-ink` / `warning-border` | `#F1C75B` / `#FBF1D6` / `#765717` / `#E2C987` | Attention, stale data |
| `danger` / `danger-soft` / `danger-border` | `#A63D28` / `#F6E6E0` / `#E3B5A8` | Errors and wrong answers |
| `danger-strong` / `danger-strong-hover` / `danger-strong-border` | `#8A3B2C` / `#76321F` / `#A87466` | Destructive actions |
| `info-ink` / `info-soft` | `#38557A` / `#E7EBF3` | Information |
| `viz-equity` / `viz-etf` / `viz-bonds` / `viz-cash` / `viz-other` | see tokens | Categorical data, validated as one palette |
| `backdrop` | `#17171761` | Modal scrim |

Colour always comes with text or an icon for status. The marketing page keeps a few illustration-only tints and demo shadows in `pen-landing.module.css`; everything else there maps onto these roles.

## Buttons

`Button`, `ButtonLink` and `buttonVariants()` in `src/components/ui/button.tsx` are the only button styles. Use `buttonVariants()` when the element must be a specific link or native button.

| Variant | Use |
| --- | --- |
| `primary` (default) | The one main action on a screen |
| `secondary` | Supporting actions |
| `ghost` | Low-emphasis actions such as Previous |
| `danger` | Confirming a destructive action |
| `dangerQuiet` | Starting a destructive flow |

Sizes are `default` (52px), `compact` (48px) and `icon` (48px square). CSS modules may add width or margin to a button, never colour, radius, padding or height: module rules are unlayered and would override the utilities.

## Typography and spacing

Headings use Manrope 600 with tight tracking; everything else uses Inter. The product scale is:

- 36–48px responsive page title (`page-title`)
- 28px major section heading (`section-title`)
- 20px card heading (`card-title`)
- 18px emphasis (`emphasis`)
- 16px body (`body`)
- 15px secondary copy and labels (`small`)
- 13px microcopy (`microcopy`)

Spacing follows a four-pixel rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, and 80px, available as `--space-*`.

## Radius, elevation, and motion

Radius: 8px for controls and buttons (`control`, `button`), 12px for surfaces and panels (`surface`, `panel`), 6px `compact`, and `pill`.

Elevation: `elevation-1` (`0 12px 24px`, the dominant learning surface) and `elevation-2` (`0 12px 28px`, menus and dialogs). Depth comes from surfaces and borders first.

Motion uses 180ms micro interactions, 270ms surface transitions, and 400ms larger entries. Buttons darken over 160ms without movement. The root theme removes transitions and animations under `prefers-reduced-motion`.

## Accessibility and behavior boundaries

Focus-visible treatment is a 3px Ink outline with a 4px offset. Native controls keep their labels, touch targets, keyboard behavior, disabled semantics, and error descriptions. Correctness is always communicated with text or an icon as well as colour.

Design-system work must preserve authentication, sessions, reward policy, streaks, persisted progress, lesson completion, demo isolation, database behavior, and financial calculations.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. With the development server running, `npm run test:design-system-browser` also checks that the primary action, UI font and heading font come from the shared tokens and that no second UI font loads. Production isolation must still return HTTP 404 for `/dev/design-system`.
