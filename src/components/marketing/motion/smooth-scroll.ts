import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import type { SectionInit } from "./types";

/**
 * Lenis smooth scroll driven by the GSAP ticker so ScrollTrigger and Lenis share one clock.
 * In-page anchors are routed through lenis.scrollTo; the skip link (#main) stays fully native.
 * Only started when the user has not asked for reduced motion.
 */
export const initSmoothScroll: SectionInit = ({ root }) => {
  const lenis = new Lenis({ duration: 1.1, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    const id = link?.getAttribute("href")?.slice(1);
    if (!link || !id || id === "main") return;
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    lenis.scrollTo(target, {
      duration: 1.3,
      onComplete: () => {
        history.pushState(null, "", `#${id}`);
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      },
    });
  };
  root.addEventListener("click", onClick);

  // A deep link such as /#portfolio-lab lands natively before pin spacers exist; re-land after each refresh
  // (fonts, images, pins) until the user scrolls on their own.
  const hash = decodeURIComponent(location.hash.slice(1));
  const hashTarget = hash && hash !== "main" ? document.getElementById(hash) : null;
  const landHash = () => { lenis.scrollTo(hashTarget!, { immediate: true, force: true }); };
  const userInputs = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  const stopLanding = () => {
    ScrollTrigger.removeEventListener("refresh", landHash);
    userInputs.forEach(type => window.removeEventListener(type, stopLanding));
  };
  if (hashTarget) {
    ScrollTrigger.addEventListener("refresh", landHash);
    userInputs.forEach(type => window.addEventListener(type, stopLanding, { passive: true }));
  }

  return () => {
    root.removeEventListener("click", onClick);
    stopLanding();
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33);
    lenis.destroy();
  };
};
