# Landing page motion (GSAP)

The landing page (`src/components/marketing/pen-landing.tsx`) has a GSAP motion layer. It only adds motion. Copy, layout and colours are unchanged, and every illustrative label and disclaimer stays visible.

## Dependencies (exact)

- `gsap@3.15.0`: core, `ScrollTrigger`, `SplitText`, `DrawSVGPlugin`
- `@gsap/react@2.1.2`: `useGSAP`
- `lenis@1.3.26`: smooth scroll synced to ScrollTrigger

## Architecture

| File | Role |
| --- | --- |
| `src/lib/gsap.ts` | Registers the plugins once (client only). Shared `EASE`, `DUR`, `REVEAL_Y` and media queries `MQ`. Always import gsap from here. |
| `motion/motion-root.tsx` | `"use client"` wrapper around the page. One `useGSAP({ scope })` → `gsap.matchMedia()` runs every section initialiser in `SECTIONS` order and reverts everything on unmount or route change. Calls `ScrollTrigger.refresh()` after fonts and on `load`. |
| `motion/reveal.tsx` | Markup-only helpers: `<SplitHeading>`, `<CountUp>`, `magneticProps`. They render plain HTML with `data-*` hooks, so SSR and no-JS output is the final state. |
| `motion/utils.ts` | `useReveal`, `splitHeading` / `useSplitHeadings`, `countUp`, `magnetic`, `hoverLift`, `pressFeedback`, `fontsReady`. |
| `motion/smooth-scroll.ts` | Lenis on the GSAP ticker. In-page `#anchors` go through `lenis.scrollTo` and then move focus to the target. `#main` (the skip link) stays native. Deep links re-land after pin refreshes. |
| `motion/events.ts` | DOM events that let the motion layer drive the React previews (`LessonPreview`, `PortfolioPreview`). React still renders everything, and the demos never touch real state. |
| `motion/sections/*.ts` | Choreography for each section (below). |

### Rules the code follows

- **Reduced motion / no JS:** all hidden states are set from JS inside the `(prefers-reduced-motion: no-preference)` branch. Nothing is hidden by CSS. Under reduced motion there is no smooth scroll, pinning, parallax or demo, and the page renders in its final state.
- **Keyboard:** anything containing links or buttons is hidden with `opacity` (not `autoAlpha`), so it stays in the tab order. Tabbing to it scrolls it into view, which triggers its reveal.
- **Desktop ≥ 1024px vs mobile:** pinning, the magnetic effect and the 60 → 40 % demo are desktop only. Mobile gets shorter reveals (y 24px, 0.6s).
- **Hover effects** (`data-lift`, `data-magnetic`) run only on `(hover: hover) and (pointer: fine)`.
- Only `transform`, `opacity` and SVG stroke (`drawSVG`) are animated. Exceptions: the lesson feedback `height: auto` expand (inside a card, after layout), the box-shadow on hover lift, and the Portfolio preview, which re-renders its own donut and slider fills from tweened numbers.
- SplitText uses `aria: "auto"`, and every split is reverted once its reveal finishes.

## Section choreography

| # | Section | Trigger | What happens | Where to tweak |
| --- | --- | --- | --- | --- |
| – | Scroll progress | scrub over the whole document | 3px teal bar, `scaleX` 0 → 1 | `sections/global.ts › initScrollProgress` |
| – | Hover / press | pointer | Lift and shadow (`data-lift`, `data-lift-card` for cards), magnetic pull via `quickTo` (`data-magnetic`), squash and `back.out` release (`data-press`) | `utils.ts › hoverLift / magnetic / pressFeedback` |
| 1 | Nav | load + scroll | Fades down on load and becomes sticky. A surface and shadow appear after 24px. It hides on scroll down past 240px and returns on scroll up; it stays visible while the mobile menu is open or focus is inside it. Magnetic "Přihlásit se". | `initNav` (thresholds 24 / 240) |
| 2 | Hero | load (after fonts, max 1.2s wait) | H1 masked line reveal; the second line lands 0.2s later with a slight skew. Then subtitle (0.75s), CTAs pop (0.95s), lesson card (1.05s), illustration (1.35s). The illustration only fades in and never moves (no float, no parallax). Then a scrubbed title scale/fade on scroll-out (desktop). The primary CTA plays a soft sheen on hover. | `sections/hero.ts` (timeline positions are the trailing numbers) |
| 3 | Hero lesson card | card top hits 80% of viewport (desktop) | A ghost cursor picks B and clicks check. The feedback expands, "+20 XP" pops (`back.out(1.4)`) with a 10-dot burst, and the progress fills. The lesson previews are read-only illustrations (no clickable answers or submit), so the demo always runs to its end state. | `sections/lesson-demo.ts › armHeroDemo`, `burst()` |
| 4 | Jak to funguje | card top hits 78% | Course rows cascade (0.12s stagger), "Hotovo" ticks draw, progress fills, and "Pokračovat" pulses gently. Steps 01 → 02 → 03: number flips in, copy reveals, the previous step dims, and a line draws. Pinned (+1700px scroll) on desktop at least 880px tall; unpinned scrub on shorter desktops; plain staggered reveals on mobile. | `sections/journey.ts` (`end: "+=1700"`, `MQ.tall` in `lib/gsap.ts`) |
| 5 | Krátké lekce | heading words / card top hits 70% | Heading word reveal. The cursor picks the wrong answer A, which shakes; the explanation slides in and B glows. | `armCompactDemo` (shake keyframes, glow repeats) |
| 6 | Portfolio Lab | preview top hits 65% (75% on mobile) | Heading line reveal. Stocks, bonds and cash grow from 0 to 60/30/10 (staggered 0.15s) with live CZK amounts and donut. "100 %" lands with a drawn tick. On desktop the hint nudges, stocks go 60 → 40 % (cash takes the difference, as the slider would) and settle back. Any input ends it immediately. The "Uložit portfolio" confirmation eases in. | `sections/portfolio.ts` (`grow`, hold `"+=1.8"`) |
| 7 | Progress | card top hits 78% | XP counts 0 → 60 over 2s, items ease in slowly, the next-step row lifts in last. The dashed "3 ze 7" ring draws on a soft scrub. | `sections/progress.ts` |
| 8 | Final CTA | scroll | Heading char reveal (0.025s stagger; words on mobile), illustration fades in place (no movement), copy and actions reveal. The primary button sheens on hover only (never at rest), plus magnetic hover. | `sections/closing.ts`, `sheen()` in `utils.ts` |
| 9 | Footer | footer enters viewport | Single fade-up | `initFooter` |

## Retuning

- **Global feel:** edit `EASE`, `DUR` and `REVEAL_Y` in `src/lib/gsap.ts`.
- **Add a reveal to new markup:** add `data-reveal` (`="fade"` for no movement, `data-reveal-delay="0.2"`, `data-reveal-stagger` for children). For headings, use `<SplitHeading mode="words|lines|chars">`.
- **Add a section:** write a `SectionInit` in `motion/sections/` and add it to `SECTIONS` in `motion-root.tsx`. Return a cleanup for any listeners. Tweens and ScrollTriggers created synchronously, or through `ctx.inContext(...)`, are reverted automatically.
- **Debugging:** add `markers: true` to a ScrollTrigger locally, and never commit it.

## Verified

- `npm run lint`, `typecheck`, `test` (743 passing) and `build` all pass.
- 375 / 768 / 1280 / 1920px: no hidden content under reduced motion or with JS disabled, no horizontal overflow, no console or hydration errors (dev and production).
- Nav anchors and footer anchors land at top = 0 and move focus to the target. The skip link focuses `#main`. `/#portfolio-lab` deep link re-lands after the pin.
- Navigating away and back: the pin spacer and the `lenis` classes are removed, then recreated once.
- Lighthouse mobile (production, median of 3, baseline `361e7ea` → now): Performance 89 → 88, CLS 0 → 0, TBT ~5 → ~30ms, LCP +~170ms (the H1 line reveal).
