import type { MotionConditions } from "@/lib/gsap";

/** Returned by section initialisers; run on matchMedia revert / unmount. */
export type Cleanup = () => void;

export type SectionContext = {
  root: HTMLElement;
  c: MotionConditions;
  /** True once the component unmounted or the media query flipped; guards async work. */
  isCancelled: () => boolean;
  /** Runs `fn` inside the matchMedia context so tweens / splits created later (e.g. on scroll) are reverted with it. */
  inContext: <T>(fn: () => T) => T;
};

export type SectionInit = (ctx: SectionContext) => Cleanup | void;
