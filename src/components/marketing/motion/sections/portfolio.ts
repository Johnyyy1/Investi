import { gsap, ScrollTrigger, EASE } from "@/lib/gsap";
import { $ } from "../utils";
import { PORTFOLIO_DEMO_EVENT, type PortfolioDemoDetail, type PortfolioDemoView } from "../events";
import type { SectionInit } from "../types";

const FINAL: PortfolioDemoView = { stocks: 60, bonds: 30, cash: 10 };

/**
 * Portfolio Lab: the 60 / 30 / 10 split grows from zero (sliders, amounts, donut and legend all tween live
 * through the preview's own render), "100 %" lands last with a drawn tick, then the "Můj první mix" hint is
 * acted out once: stocks 60 → 40 % with cash taking the difference (same rule as the slider), then back.
 * Values are display-only; the preview's real mix is never changed. Any user input ends the demo at once.
 */
export const initPortfolio: SectionInit = ({ root, c, inContext }) => {
  const preview = $(root, "[data-portfolio]");
  if (!preview) return;
  const total = $(preview, "[data-total]")!;
  const tickPath = $(preview, "[data-total-tick]")!.querySelector("path")!;
  const donut = $(preview, "[data-donut]")!;
  const hint = $(preview, "[data-portfolio-hint]")!;
  const saveStatus = $(preview, "[data-saved-status]")!;

  const state: PortfolioDemoView = { stocks: 0, bonds: 0, cash: 0 };
  const send = (view: PortfolioDemoView | null) => preview.dispatchEvent(new CustomEvent<PortfolioDemoDetail>(PORTFOLIO_DEMO_EVENT, { detail: { view } }));
  const push = () => send({ ...state });

  send({ ...state });
  gsap.set(total, { autoAlpha: 0, y: 8 });
  gsap.set(tickPath, { drawSVG: "0%" });
  gsap.set(donut, { rotation: -60, scale: 0.9 });

  let tl: gsap.core.Timeline | undefined;
  const finish = () => {
    tl?.kill();
    Object.assign(state, FINAL);
    send(null);
    gsap.set(total, { autoAlpha: 1, y: 0 });
    gsap.set(tickPath, { drawSVG: "100%" });
    gsap.set(donut, { rotation: 0, scale: 1 });
    gsap.set(hint, { clearProps: "transform" });
    preview.removeEventListener("pointerdown", finish);
    preview.removeEventListener("keydown", finish);
  };
  preview.addEventListener("pointerdown", finish);
  preview.addEventListener("keydown", finish);

  ScrollTrigger.create({
    trigger: preview, start: c.mobile ? "top 75%" : "top 65%", once: true,
    onEnter: () => inContext(() => {
      const grow = c.mobile ? 1 : 1.3;
      tl = gsap.timeline({ onUpdate: push, onComplete: finish });
      tl.to(donut, { rotation: 0, scale: 1, duration: grow + 0.4, ease: EASE.enterLong }, 0)
        .to(state, { stocks: 60, duration: grow, ease: EASE.enter }, 0)
        .to(state, { bonds: 30, duration: grow, ease: EASE.enter }, 0.15)
        .to(state, { cash: 10, duration: grow, ease: EASE.enter }, 0.3)
        .to(total, { autoAlpha: 1, y: 0, duration: 0.5, ease: EASE.enter }, ">-0.1")
        .to(tickPath, { drawSVG: "100%", duration: 0.45, ease: "power2.out" }, "<0.15")
        .fromTo(total.querySelector("strong"), { scale: 0.9 }, { scale: 1, duration: 0.5, ease: EASE.reward, transformOrigin: "100% 50%" }, "<");
      if (!c.mobile) {
        // "Zkus snížit akcie na 40 %." – acted out once, then settled back.
        tl.to(hint, { x: 6, duration: 0.35, ease: "power2.out", yoyo: true, repeat: 1 }, "+=1")
          .to(state, { stocks: 40, cash: 30, duration: 1.4, ease: EASE.scrub }, "+=0.2")
          .to(state, { stocks: 60, cash: 10, duration: 1.2, ease: EASE.scrub }, "+=1.8");
      }
    }),
  });

  // Save: the press itself is handled by data-press; the confirmation text eases in after React renders it.
  const save = preview.querySelector<HTMLButtonElement>("[data-press]");
  const onSave = () => requestAnimationFrame(() => {
    if (saveStatus.textContent) gsap.fromTo(saveStatus, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: EASE.enter });
  });
  save?.addEventListener("click", onSave);

  return () => {
    save?.removeEventListener("click", onSave);
    finish();
  };
};
