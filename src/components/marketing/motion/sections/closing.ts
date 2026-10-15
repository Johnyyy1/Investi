import { gsap, EASE } from "@/lib/gsap";
import { $ } from "../utils";
import type { SectionInit } from "../types";

/**
 * Final CTA: heading chars use the shared SplitHeading; the illustration fades in once in place (it never moves).
 * The primary button's hover sheen is driven by initInteractions via [data-shimmer].
 */
export const initClosing: SectionInit = ({ root }) => {
  const art = $(root, "[data-closing-art]");
  if (!art) return;
  gsap.set(art, { autoAlpha: 0 });
  gsap.to(art, { autoAlpha: 1, duration: 1, ease: EASE.enter, scrollTrigger: { trigger: art, start: "top 88%", once: true } });
};
