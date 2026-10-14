/** DOM events the motion layer uses to drive the illustrative previews' React state (no GSAP import, safe anywhere). */
export const LESSON_DEMO_EVENT = "investi:lesson-demo";
export type LessonDemoDetail = { answer: "A" | "B" | null; revealed: boolean; hold?: boolean;
  /** Set when dispatched from a React lifecycle (cannot flushSync there); state then applies on the next render. */
  defer?: boolean };

export const PORTFOLIO_DEMO_EVENT = "investi:portfolio-demo";
/** Display-only override of the preview's percentages (may be fractional mid-tween); `null` returns to the real mix. */
export type PortfolioDemoView = { stocks: number; bonds: number; cash: number };
export type PortfolioDemoDetail = { view: PortfolioDemoView | null };
