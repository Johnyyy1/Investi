import { gsap, ScrollTrigger, EASE } from "@/lib/gsap";
import { $, $$, countUp } from "../utils";
import type { SectionInit } from "../types";

/**
 * "Rostou znalosti. Ne tlak." – deliberately slow and calm: XP counts to 60, the dashed "3 ze 7" ring draws
 * segment by segment on a soft scrub, items ease in and the next-step row arrives last with a gentle lift.
 */
export const initProgress: SectionInit = ({ root, c, inContext }) => {
  const card = $(root, "[data-progress-card]");
  if (!card) return;
  const count = $(card, "[data-count-to]");
  const items = $$(card, "[data-progress-item]");
  const next = $(card, "[data-progress-next]");
  const ring = $(card, "[data-progress-ring]");
  const art = $(root, "[data-progress-art]");
  const segments = ring ? Array.from(ring.querySelectorAll("path")) : [];

  const calm = items.filter(i => i !== next);
  gsap.set(calm, { autoAlpha: 0, y: 20 });
  if (next) gsap.set(next, { autoAlpha: 0, y: 28 });
  if (art) gsap.set(art, { autoAlpha: 0 }); // fade only: illustrations never move
  if (count) count.textContent = "0";

  ScrollTrigger.create({
    trigger: card, start: "top 78%", once: true,
    onEnter: () => inContext(() => {
      const tl = gsap.timeline({ defaults: { ease: EASE.enter } });
      if (art) tl.to(art, { autoAlpha: 1, duration: 1, ease: "power1.out" }, 0);
      if (count) tl.add(countUp(count, Number(count.dataset.countTo), { duration: 2, ease: "power2.out" }), 0.2);
      tl.to(calm, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.15 }, 0.35);
      if (next) tl.to(next, { autoAlpha: 1, y: 0, duration: 1.1, ease: EASE.enterLong }, 0.9)
        .fromTo(next, { boxShadow: "0 0 0 rgba(23,23,23,0)" }, { boxShadow: "0 14px 28px rgba(23,23,23,.07)", duration: 0.8, yoyo: true, repeat: 1, ease: "sine.inOut" }, 1.3);
    }),
  });

  if (segments.length) {
    // 3 of 7 lessons ≈ 43 %: the first segments of the dashed ring draw in, the rest stay faint.
    const filled = Math.round((segments.length * 3) / 7);
    gsap.set(segments, { drawSVG: "0%" });
    gsap.set(segments.slice(filled), { opacity: 0.35 });
    gsap.to(segments, {
      drawSVG: "100%", stagger: 0.12, ease: EASE.scrub,
      scrollTrigger: { trigger: ring, start: "top 85%", end: c.mobile ? "top 55%" : "top 45%", scrub: 1.2 },
    });
  }
};
