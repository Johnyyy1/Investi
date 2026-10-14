"use client";

import "lenis/dist/lenis.css";
import { useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, useGSAP, MQ, type MotionConditions } from "@/lib/gsap";
import { fontsReady, useReveal, useSplitHeadings } from "./utils";
import { initJourney } from "./sections/journey";
import { initLessons } from "./sections/lessons";
import { initPortfolio } from "./sections/portfolio";
import { initProgress } from "./sections/progress";
import { initClosing } from "./sections/closing";
import { initHero } from "./sections/hero";
import { initSmoothScroll } from "./smooth-scroll";
import { initFooter, initInteractions, initNav, initScrollProgress } from "./sections/global";
import type { Cleanup, SectionContext, SectionInit } from "./types";

/** Section initialisers run in this order. Each one owns its own hidden states, triggers and cleanup. */
const SECTIONS: SectionInit[] = [
  initSmoothScroll,
  initScrollProgress,
  initInteractions,
  initNav,
  initHero,
  initJourney,
  initLessons,
  initPortfolio,
  initProgress,
  initClosing,
  ({ root, c, inContext }) => { useReveal(root, { mobile: c.mobile }); useSplitHeadings(root, { mobile: c.mobile }, inContext); },
  initFooter,
];

/**
 * Wraps the landing page and runs the whole GSAP layer. Everything is scoped to this element,
 * created inside gsap.matchMedia (so reduced motion gets the untouched final state) and reverted on unmount.
 */
export function MotionRoot({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const root = ref.current;
    if (!root) return;
    const mm = gsap.matchMedia(root);
    mm.add({ motion: MQ.motion, desktop: MQ.desktop, mobile: MQ.mobile, fine: MQ.fine }, context => {
      const c = { tall: false, ...context.conditions } as MotionConditions;
      if (!c.motion) return;
      let cancelled = false;
      const ctx: SectionContext = { root, c, isCancelled: () => cancelled, inContext: fn => context.add(fn) as ReturnType<typeof fn> };
      const cleanups: Cleanup[] = [];
      for (const init of SECTIONS) {
        const cleanup = init(ctx);
        if (cleanup) cleanups.push(cleanup);
      }
      const refresh = () => { if (!cancelled) ScrollTrigger.refresh(); };
      fontsReady(4000).then(refresh);
      window.addEventListener("load", refresh);
      return () => {
        cancelled = true;
        window.removeEventListener("load", refresh);
        cleanups.reverse().forEach(fn => fn());
      };
    });
    return () => mm.revert();
  }, { scope: ref });

  return <div ref={ref} className={className}>{children}</div>;
}
