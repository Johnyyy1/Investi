import { gsap, SplitText, EASE } from "@/lib/gsap";
import { $, $$, fontsReady } from "../utils";
import { armHeroDemo, prepareHeroDemo } from "./lesson-demo";
import type { SectionInit } from "../types";

/**
 * Hero intro on load: masked line reveal of the H1 (second sentence lands later with a slight skew),
 * then subtitle, buttons, lesson card and the illustration. The illustration only fades in: it never moves
 * (no float, no parallax). Afterwards the title scales/fades as the hero scrolls out (desktop).
 * Hidden states are set here in JS only.
 */
export const initHero: SectionInit = ctx => {
  const { root, c, isCancelled } = ctx;
  const title = $(root, "[data-hero-title]");
  const sub = $(root, "[data-hero-sub]");
  const ctas = $$(root, "[data-hero-actions] > *");
  const card = $(root, "[data-hero-card]");
  const art = $(root, "[data-hero-art]");
  const intro = $(root, "[data-hero-intro]");
  const section = title?.closest("section");
  if (!title || !sub || !card || !art || !intro || !section) return;

  // Controls (CTAs, lesson card) use opacity so they stay focusable during the intro.
  gsap.set(title, { autoAlpha: 0 });
  gsap.set(sub, { autoAlpha: 0, y: 28 });
  gsap.set(ctas, { opacity: 0, y: 22, scale: 0.92 });
  gsap.set(card, { opacity: 0, y: 44 });
  gsap.set(art, { autoAlpha: 0 });
  const demoCard = c.desktop ? prepareHeroDemo(ctx) : null;

  fontsReady().then(() => {
    if (isCancelled()) return;
    // Lock the height while split so line wrappers can never nudge the content below (CLS).
    gsap.set(title, { height: title.offsetHeight });
    const split = SplitText.create(title, { type: "lines", mask: "lines", aria: "auto" });
    gsap.set(split.masks, { paddingBottom: "0.18em", marginBottom: "-0.18em" }); // keep descenders (j, y) unclipped
    gsap.set(title, { autoAlpha: 1 });
    const [first, ...rest] = split.lines;
    const tl = gsap.timeline({ defaults: { ease: EASE.enter } });
    tl.from(first, { yPercent: 115, duration: 1.1, ease: EASE.enterLong })
      .from(rest, { yPercent: 115, skewY: 5, xPercent: -2, duration: 1.2, ease: EASE.enterLong }, 0.2)
      .add(() => { split.revert(); gsap.set(title, { clearProps: "height" }); }, ">")
      .to(sub, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.75)
      .to(ctas, { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.1, ease: EASE.enterLong }, 0.95)
      .to(card, { opacity: 1, y: 0, duration: 1 }, 1.05)
      .to(art, { autoAlpha: 1, duration: 0.9, ease: "power1.out" }, 1.35)
      .add(() => {
        if (c.desktop) {
          gsap.to([title, intro], {
            y: -36, scale: 0.97, opacity: 0.25, transformOrigin: "0% 0%", ease: "none",
            scrollTrigger: { trigger: section, start: "top top", end: "70% top", scrub: 0.6 },
          });
        }
        if (demoCard) armHeroDemo(ctx, demoCard);
      });
  });
};
