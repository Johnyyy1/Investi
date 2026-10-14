import { gsap, EASE } from "@/lib/gsap";
import { $ } from "../utils";
import type { SectionInit } from "../types";

/**
 * Final CTA: heading chars use the shared SplitHeading; the illustration rises with a scrubbed parallax on
 * desktop (simple fade on mobile); the primary button gets an idle shimmer sweep every ~4 s.
 * The shimmer only exists inside the motion branch, so reduced motion never sees it.
 */
export const initClosing: SectionInit = ({ root, c }) => {
  const art = $(root, "[data-closing-art]");
  const shimmer = $(root, "[data-shimmer]");
  const section = art?.closest("section");

  if (art && section) {
    if (c.desktop) {
      gsap.fromTo(art, { yPercent: 18, autoAlpha: 0.0 }, {
        yPercent: -6, autoAlpha: 1, ease: "none",
        scrollTrigger: { trigger: section, start: "top bottom", end: "center center", scrub: 0.8 },
      });
    } else {
      gsap.set(art, { autoAlpha: 0, y: 24 });
      gsap.to(art, { autoAlpha: 1, y: 0, duration: 0.7, ease: EASE.enter, scrollTrigger: { trigger: art, start: "top 88%", once: true } });
    }
  }

  if (shimmer) {
    gsap.fromTo(shimmer, { xPercent: -160 }, {
      xPercent: 330, duration: 1.1, ease: "power2.inOut", repeat: -1, repeatDelay: 3,
      scrollTrigger: { trigger: shimmer, start: "top bottom", end: "bottom top", toggleActions: "play pause resume pause" },
    });
  }
};
