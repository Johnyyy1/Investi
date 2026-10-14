import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useGSAP } from "@gsap/react";

/** Plugins are registered once, on the client only. Import gsap from here, never from "gsap" directly. */
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin);
  ScrollTrigger.config({ ignoreMobileResize: true });
  gsap.defaults({ ease: "power3.out", duration: 0.8 });
}

/** Shared motion language. Tweak here to retune the whole page. */
export const EASE = {
  enter: "power3.out",
  enterLong: "expo.out",
  scrub: "power2.inOut",
  /** Only for small "reward" moments: XP badge, correct answer. */
  reward: "back.out(1.4)",
} as const;

export const DUR = {
  reveal: 0.8,
  revealShort: 0.6,
  revealLong: 1,
  /** Stagger between text pieces. */
  text: 0.06,
  /** Stagger between cards / rows. */
  card: 0.12,
} as const;

/** Reveal distance in px; keep within 24–40. */
export const REVEAL_Y = 32;

export const MQ = {
  motion: "(prefers-reduced-motion: no-preference)",
  desktop: "(min-width: 1024px)",
  mobile: "(max-width: 1023px)",
  /** Tall enough to pin the "Jak to funguje" block without clipping it. */
  tall: "(min-height: 880px)",
  fine: "(hover: hover) and (pointer: fine)",
} as const;

export type MotionConditions = { motion: boolean; desktop: boolean; mobile: boolean; tall: boolean; fine: boolean };

export { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, useGSAP };
