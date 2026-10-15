import { gsap, ScrollTrigger, EASE } from "@/lib/gsap";
import { $, $$, hoverLift, magnetic, pressFeedback, sheen } from "../utils";
import type { SectionInit } from "../types";

/** Thin scroll-progress bar at the top of the viewport (scrubbed, transform only). */
export const initScrollProgress: SectionInit = ({ root }) => {
  const bar = $(root, "[data-scroll-progress]");
  if (!bar) return;
  gsap.set(bar, { scaleX: 0, transformOrigin: "0% 50%" });
  gsap.to(bar, {
    scaleX: 1, ease: "none",
    scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.3 },
  });
};

/** Hover lift, magnetic pull, button sheen and press feedback. Hover effects run on fine pointers only. */
export const initInteractions: SectionInit = ({ root, c }) => {
  const cleanups: Array<() => void> = [];
  // GSAP owns transform on these elements, so the CSS transform transition would fight it.
  $$(root, "[data-lift], [data-magnetic], [data-press]").forEach(el => { el.style.transitionProperty = "background-color, border-color, color"; });
  $$(root, "[data-press]").forEach(el => cleanups.push(pressFeedback(el)));
  if (c.fine) {
    $$(root, "[data-lift]").forEach(el => cleanups.push(hoverLift(el)));
    $$(root, "[data-shimmer]").forEach(el => cleanups.push(sheen(el)));
    if (c.desktop) $$(root, "[data-magnetic]").forEach(el => cleanups.push(magnetic(el)));
  }
  return () => cleanups.forEach(fn => fn());
};

/** Site header: fades down on load, gains a surface when scrolled, hides on scroll down and returns on scroll up. */
export const initNav: SectionInit = ({ root }) => {
  const header = $(root, "[data-nav]");
  const bg = $(root, "[data-nav-bg]");
  if (!header || !bg) return;
  // Sticky is applied from JS so the no-JS / reduced-motion header stays in normal flow.
  gsap.set(header, { position: "sticky", top: 0 });
  gsap.set(bg, { autoAlpha: 0 });
  gsap.from(header, { y: -24, autoAlpha: 0, duration: 0.9, delay: 0.1, ease: EASE.enter, clearProps: "opacity,visibility" });

  const details = header.querySelector("details");
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: self => {
      const y = self.scroll();
      gsap.to(bg, { autoAlpha: y > 24 ? 1 : 0, duration: 0.35, overwrite: "auto" });
      const keepVisible = details?.open || header.contains(document.activeElement);
      const hide = self.direction === 1 && y > 240 && !keepVisible;
      if (hide || self.direction === -1 || y <= 240) {
        gsap.to(header, { yPercent: hide ? -110 : 0, duration: 0.45, ease: EASE.enter, overwrite: "auto" });
      }
    },
  });
  return () => { gsap.set(header, { clearProps: "position,top,transform" }); };
};

/** Footer: a single calm fade-up. */
export const initFooter: SectionInit = ({ root }) => {
  const footer = $(root, "[data-footer]");
  if (!footer) return;
  gsap.set(footer, { opacity: 0, y: 24 }); // opacity only: footer links stay in the tab order
  ScrollTrigger.create({ trigger: footer, start: "top 98%", once: true, onEnter: () => gsap.to(footer, { opacity: 1, y: 0, duration: 0.9, ease: EASE.enter }) });
};
