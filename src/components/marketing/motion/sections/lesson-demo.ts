import { gsap, ScrollTrigger, EASE } from "@/lib/gsap";
import { $ } from "../utils";
import { LESSON_DEMO_EVENT, type LessonDemoDetail } from "../events";
import type { SectionContext } from "../types";

const send = (root: HTMLElement, detail: LessonDemoDetail) => root.dispatchEvent(new CustomEvent<LessonDemoDetail>(LESSON_DEMO_EVENT, { detail }));
const COLORS = ["var(--teal2)", "var(--cash)", "var(--bonds)"];

/** A handful of DOM dots that burst out of `origin` and fade. GSAP-only, removed when finished. */
function burst(host: HTMLElement, origin: HTMLElement, count = 10) {
  const hostRect = host.getBoundingClientRect();
  const rect = origin.getBoundingClientRect();
  const cx = rect.left - hostRect.left + rect.width / 2;
  const cy = rect.top - hostRect.top + rect.height / 2;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    const size = 5 + Math.round(Math.random() * 4);
    Object.assign(dot.style, { position: "absolute", left: `${cx}px`, top: `${cy}px`, width: `${size}px`, height: `${size}px`, borderRadius: i % 3 === 0 ? "2px" : "50%", background: COLORS[i % COLORS.length], pointerEvents: "none", zIndex: "4" });
    dot.setAttribute("aria-hidden", "true");
    host.appendChild(dot);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const distance = 38 + Math.random() * 34;
    gsap.fromTo(dot, { x: 0, y: 0, scale: 0.4, autoAlpha: 1, rotation: 0 }, {
      x: Math.cos(angle) * distance, y: Math.sin(angle) * distance - 10, rotation: Math.random() * 180 - 90,
      scale: 1, duration: 0.45, ease: "power3.out",
      onComplete: () => { gsap.to(dot, { autoAlpha: 0, y: "+=14", scale: 0.2, duration: 0.5, ease: "power1.in", onComplete: () => dot.remove() }); },
    });
  }
}

/** Expands an element from 0 to its natural height (auto) with a soft fade. */
function expand(el: HTMLElement, y = 10) {
  return gsap.fromTo(el, { height: 0, autoAlpha: 0, y, overflow: "hidden" }, { height: "auto", autoAlpha: 1, y: 0, duration: 0.7, ease: EASE.enter, clearProps: "height,overflow,transform" });
}

/** Moves the fake cursor to the centre of `target` (position is measured when the tween starts). */
function moveTo(host: HTMLElement, target: () => HTMLElement | null, dx = 0, dy = 0) {
  const point = () => {
    const t = target();
    if (!t) return { x: 0, y: 0 };
    const h = host.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    return { x: r.left - h.left + r.width / 2 + dx, y: r.top - h.top + r.height / 2 + dy };
  };
  return { x: () => point().x, y: () => point().y };
}

const press = (tl: gsap.core.Timeline, cursor: HTMLElement, at: string | number) =>
  tl.to(cursor, { scale: 0.82, duration: 0.1, ease: "power2.out" }, at).to(cursor, { scale: 1, duration: 0.25, ease: EASE.enter });

function stopOnInteraction(root: HTMLElement, onStop: () => void) {
  const stop = () => { root.removeEventListener("pointerdown", stop); root.removeEventListener("keydown", stop); onStop(); };
  root.addEventListener("pointerdown", stop);
  root.addEventListener("keydown", stop);
  return () => { root.removeEventListener("pointerdown", stop); root.removeEventListener("keydown", stop); };
}

/**
 * Hero lesson card: a ghost cursor picks answer B, checks it, the feedback panel expands, "+20 XP" pops
 * with a small burst and the lesson progress fills. It ends on the same state the page server-renders.
 * Resets the preview to "unanswered" first (the card is still hidden by the hero intro at that point).
 */
export function prepareHeroDemo({ root }: Pick<SectionContext, "root">) {
  const card = $(root, '[data-lesson-demo="hero"]');
  if (!card) return null;
  send(card, { answer: null, revealed: false, defer: true });
  gsap.set($(card, "[data-lesson-progress]"), { scaleX: 0.75, transformOrigin: "0% 50%" });
  return card;
}

export function armHeroDemo(ctx: SectionContext, card: HTMLElement) {
  const { inContext } = ctx;
  const cursor = $(card, "[data-demo-cursor]")!;
  const progress = $(card, "[data-lesson-progress]")!;
  let tl: gsap.core.Timeline | undefined;
  let removeStop: (() => void) | undefined;

  const finish = () => {
    tl?.kill();
    gsap.set(cursor, { autoAlpha: 0 });
    gsap.set(progress, { scaleX: 1 });
    removeStop?.();
  };

  const play = () => inContext(() => {
    const feedback = () => $(card, "[data-aside-feedback]")!;
    const xp = () => $(card, "[data-xp]")!;
    const answerB = () => $(card, '[data-answer="B"]');
    const submit = () => $(card, "[data-submit]");
    const start = answerB()!.getBoundingClientRect();
    const host = card.getBoundingClientRect();
    gsap.set(cursor, { x: start.left - host.left + start.width * 0.8, y: start.top - host.top + start.height + 90, autoAlpha: 0, scale: 1 });
    tl = gsap.timeline({ onComplete: finish });
    removeStop = stopOnInteraction(card, finish);
    tl.to(cursor, { autoAlpha: 1, duration: 0.3 })
      .to(cursor, { ...moveTo(card, answerB, -60, 4), duration: 1, ease: EASE.scrub }, "<")
      .add(() => send(card, { answer: "B", revealed: false }), "+=0.18");
    press(tl, cursor, "<");
    tl.to(cursor, { ...moveTo(card, submit, -20, 2), duration: 0.9, ease: EASE.scrub }, "+=0.35")
      .add(() => {
        send(card, { answer: "B", revealed: true });
        gsap.set(feedback(), { height: 0, autoAlpha: 0 });
      });
    press(tl, cursor, "<");
    tl.add(() => expand(feedback(), 12), "+=0.1")
      .fromTo(xp(), { scale: 0.5, autoAlpha: 0, transformOrigin: "0% 50%" }, { scale: 1, autoAlpha: 1, duration: 0.6, ease: EASE.reward, clearProps: "transform" }, "<0.25")
      .add(() => burst(card, xp()), "<0.1")
      .to(progress, { scaleX: 1, duration: 1.2, ease: EASE.scrub }, "<0.1")
      .to(cursor, { autoAlpha: 0, y: "+=40", x: "+=40", duration: 0.6 }, "<0.3");
  });

  ScrollTrigger.create({ trigger: card, start: "top 80%", once: true, onEnter: play });
}

/**
 * "Short lessons" card: the wrong answer is picked, shakes, the explanation slides in and the correct
 * answer glows. Resets the (below-the-fold) preview to the unanswered question up front.
 */
export function prepareCompactDemo({ root }: Pick<SectionContext, "root">) {
  const card = $(root, '[data-lesson-demo="compact"]');
  if (!card) return null;
  send(card, { answer: null, revealed: false, defer: true });
  return card;
}

export function armCompactDemo(ctx: SectionContext, card: HTMLElement) {
  const { inContext } = ctx;
  const cursor = $(card, "[data-demo-cursor]")!;
  // Answers are looked up lazily: when the demo is armed, the card may still show the revealed state without them.
  const glowB = () => $(card, '[data-answer="B"] [data-answer-glow]')!;
  let tl: gsap.core.Timeline | undefined;
  let removeStop: (() => void) | undefined;
  const finish = () => {
    tl?.kill();
    gsap.set(cursor, { autoAlpha: 0 });
    gsap.set(glowB(), { autoAlpha: 0 });
    gsap.set($(card, '[data-answer="A"]'), { x: 0 });
    removeStop?.();
  };

  const play = () => inContext(() => {
    // Commit the unanswered question before measuring: a revealed compact card (server render, or a learner's
    // own answer) hides the answers, and the deferred reset from prepareCompactDemo may not have rendered yet.
    send(card, { answer: null, revealed: false });
    const answerA = () => $(card, '[data-answer="A"]')!;
    const answerB = () => $(card, '[data-answer="B"]')!;
    const submit = () => $(card, "[data-submit]");
    const feedback = () => $(card, "[data-feedback]")!;
    const glow = glowB();
    const host = card.getBoundingClientRect();
    const a = answerA().getBoundingClientRect();
    gsap.set(cursor, { x: a.left - host.left + a.width * 0.9, y: a.top - host.top + a.height + 120, autoAlpha: 0, scale: 1 });
    tl = gsap.timeline({ onComplete: finish });
    removeStop = stopOnInteraction(card, finish);
    tl.to(cursor, { autoAlpha: 1, duration: 0.3 })
      .to(cursor, { ...moveTo(card, answerA, -80, 4), duration: 1, ease: EASE.scrub }, "<")
      .add(() => send(card, { answer: "A", revealed: false }), "+=0.18");
    press(tl, cursor, "<");
    tl.to(cursor, { ...moveTo(card, submit, -20, 2), duration: 0.9, ease: EASE.scrub }, "+=0.35")
      .add(() => {
        send(card, { answer: "A", revealed: true, hold: true });
        gsap.set(feedback(), { height: 0, autoAlpha: 0 });
      });
    press(tl, cursor, "<");
    tl.to(cursor, { autoAlpha: 0, duration: 0.5 }, "<0.3");
    // The mistake: a small, quick shake. Then the explanation arrives and the right answer is highlighted.
    tl.to(answerA(), { keyframes: { x: [0, -9, 8, -6, 4, -2, 0] }, duration: 0.55, ease: "power1.inOut" }, "+=0.12")
      .add(() => expand(feedback(), 16), "+=0.1")
      .fromTo(glow, { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.7, ease: EASE.reward }, "<0.35")
      .to(answerB(), { scale: 1.015, duration: 0.5, ease: EASE.reward }, "<")
      .to(glow, { autoAlpha: 0.35, duration: 0.8, yoyo: true, repeat: 3, ease: "sine.inOut" })
      .to(glow, { autoAlpha: 0, duration: 0.8 })
      .to(answerB(), { scale: 1, duration: 0.5 }, "<");
  });

  // When the card is already past its start (deep link, restored scroll, media-query re-run), create() fires onEnter
  // synchronously inside React's layout effect, where the reset above cannot render yet. Start on the next frame instead.
  ScrollTrigger.create({ trigger: card, start: "top 70%", once: true, onEnter: () => requestAnimationFrame(() => { if (!ctx.isCancelled()) play(); }) });
}
