import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { GuideImage } from "@/components/guide-image";
import styles from "./personalization-flow.module.css";

export type GuidePose = "01-welcome" | "02-thinking" | "03-explaining" | "04-calm-book" | "05-shrug" | "06-map" | "07-small-joy" | "12-compounding" | "14-returns" | "15-weights" | "16-bid-ask" | "10-diversification" | "21-hourglass";

export function OnboardingHeader({ progress, back, trailing, disabled, brandHref = "/learn" }: {
  progress: number; back?: (() => void) | string; trailing?: ReactNode; disabled?: boolean; brandHref?: string;
}) {
  const backContent = <><ChevronLeft size={16} aria-hidden="true" /> Zpět</>;
  return <header className={styles.header}>
    <Link className={styles.brand} href={brandHref} aria-label={brandHref === "/" ? "investi · úvodní stránka" : "investi · Studovna"}>investi!</Link>
    <div className={styles.progressRow}>
      {typeof back === "string" ? <Link className={styles.back} href={back}>{backContent}</Link> : <button type="button" className={styles.back} onClick={back} disabled={disabled || !back}>{backContent}</button>}
      <div className={styles.progress} role="progressbar" aria-label="Průběh přizpůsobení učení" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
    <div className={styles.headerAction}>{trailing}</div>
  </header>;
}

export function OnboardingGuide({ pose, children }: { pose: GuidePose; children: ReactNode }) {
  return <div className={styles.guideZone} data-pose={pose}>
    <p className={styles.bubble} role="status" aria-live="polite" aria-atomic="true">{children}</p>
    <GuideImage key={pose} className={styles.guide} pose={pose} sizes="(max-width: 767px) 112px, 216px" alt="" preload />
  </div>;
}
