import { gsap, ScrollTrigger, MQ, EASE, DUR } from "@/lib/gsap";
import { $, $$ } from "../utils";
import type { SectionInit } from "../types";

/**
 * "Jak to funguje": the course card cascades in (rows, progress, tick draws, pulsing "Pokračovat"), then the
 * three steps are scrubbed 01 → 02 → 03 while a line draws between them. On tall desktop viewports the block is
 * pinned for the scrub; on shorter desktops the same scrub runs unpinned; on mobile there is no pin or scrub,
 * only short staggered reveals.
 */
export const initJourney: SectionInit = ({ root, c, inContext }) => {
  const wrap = $(root, "[data-journey-pin]");
  const rows = $$(root, "[data-course-row]");
  const steps = $$(root, "[data-step]");
  const line = $(root, "[data-steps-line]");
  const art = $(root, "[data-journey-art]");
  const progress = $(root, "[data-course-progress]");
  if (!wrap || !steps.length) return;

  const doneIcons = rows.filter(r => r.dataset.courseRow === "done").map(r => $(r, "[data-row-icon]")!);
  const draws = doneIcons.map(icon => icon.querySelectorAll("circle, path"));
  const nextRow = rows.find(r => r.dataset.courseRow === "next");
  const statuses = rows.map(r => $(r, "[data-row-status]")!);

  // --- Card cascade (all sizes; shorter on mobile) ---------------------------------------------------------
  gsap.set(rows, { autoAlpha: 0, y: c.mobile ? 14 : 22 });
  gsap.set(statuses, { autoAlpha: 0 });
  gsap.set(draws, { drawSVG: "0%" });
  if (progress) gsap.set(progress, { scaleX: 0, transformOrigin: "0% 50%" });
  if (art && c.desktop) gsap.set(art, { autoAlpha: 0 }); // fade only: illustrations never move
  ScrollTrigger.create({
    trigger: wrap, start: c.mobile ? "top 85%" : "top 78%", once: true,
    onEnter: () => inContext(() => {
      const tl = gsap.timeline({ defaults: { ease: EASE.enter } });
      if (art && c.desktop) tl.to(art, { autoAlpha: 1, duration: 1, ease: "power1.out" }, 0);
      if (progress) tl.to(progress, { scaleX: 1, duration: 1.2, ease: EASE.scrub }, 0.2);
      tl.to(rows, { autoAlpha: 1, y: 0, duration: DUR.revealShort, stagger: DUR.card }, 0.15);
      rows.forEach((row, i) => {
        const at = 0.35 + i * DUR.card;
        if (row.dataset.courseRow === "done") tl.to(draws[i], { drawSVG: "100%", duration: 0.55, stagger: 0.12, ease: "power2.out" }, at + 0.15);
        tl.to(statuses[i], { autoAlpha: 1, duration: 0.5 }, at + 0.35);
      });
      if (nextRow) {
        const icon = $(nextRow, "[data-row-icon]")!;
        const status = $(nextRow, "[data-row-status]")!;
        tl.add(() => {
          // Gentle, endless pulse on the "continue" row (opacity/scale only).
          gsap.to(icon, { scale: 1.18, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 });
          gsap.to(status, { opacity: 0.72, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 });
        });
      }
    }),
  });

  // --- Steps ------------------------------------------------------------------------------------------------
  if (c.mobile) {
    gsap.set(steps, { autoAlpha: 0, y: 24 });
    ScrollTrigger.batch(steps, { start: "top 90%", once: true, onEnter: batch => gsap.to(batch, { autoAlpha: 1, y: 0, duration: DUR.revealShort, stagger: DUR.card, ease: EASE.enter }) });
    return;
  }

  const nums = steps.map(s => $(s, "[data-step-num]")!);
  const copy = steps.map(s => $$(s, "h3, p"));
  gsap.set(nums, { transformPerspective: 500, transformOrigin: "0% 50%" });
  const tl = gsap.timeline({ defaults: { ease: EASE.scrub } });
  steps.forEach((step, i) => {
    const at = i * 1.2;
    tl.fromTo(nums[i], { rotationX: -90, autoAlpha: 0 }, { rotationX: 0, autoAlpha: 1, duration: 0.5 }, at)
      .fromTo(copy[i], { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.08 }, at + 0.1);
    if (i > 0) tl.to(steps[i - 1], { opacity: 0.4, duration: 0.5 }, at);
    if (line) tl.to(line, { scaleX: (i + 1) / steps.length, duration: 1.2, ease: "none" }, at - (i === 0 ? 0 : 0.1));
  });
  // Settle: every step readable again once the sequence has played.
  tl.to(steps, { opacity: 1, duration: 0.5 }, "+=0.2").to({}, { duration: 0.4 });

  const overhang = () => {
    const top = wrap.getBoundingClientRect().top;
    return art ? Math.max(0, top - art.getBoundingClientRect().top) : 0;
  };

  const mm = gsap.matchMedia();
  mm.add(MQ.tall, () => {
    ScrollTrigger.create({
      animation: tl, trigger: wrap, start: () => `top top+=${Math.round(overhang() + 24)}`, end: "+=1700",
      pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true,
    });
    return () => { tl.scrollTrigger?.kill(); };
  });
  mm.add(`not all and ${MQ.tall}`, () => {
    ScrollTrigger.create({ animation: tl, trigger: $(root, "[data-steps]")!, start: "top 88%", end: "+=520", scrub: 0.8 });
  });
  return () => mm.revert();
};
