import type { ReactNode } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { GuideImage, type GuidePoseName } from "@/components/guide-image";
import { AppLink as Link } from "@/components/shell/app-link";
import styles from "./route-state.module.css";
import { buttonVariants } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/wordmark";

type RouteLink = { href: string; label: string };
type RouteAction = RouteLink | { onClick: () => void; label: string };

/**
 * Design System §04 not-found and failure state: one card, one primary way forward, no numbers.
 * `standalone` pages render outside the app shell (unmatched URLs, root errors), so they carry
 * their own wordmark linking home. Error boundaries pass an onClick action, not-found pages a link.
 */
export function RouteState({ eyebrow, title, children, action, link, standalone = false, alert = false, pose = "20-searching-box" }: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action: RouteAction;
  link?: RouteLink;
  standalone?: boolean;
  alert?: boolean;
  pose?: GuidePoseName;
}) {
  return <main className={`${styles.page} ${standalone ? styles.standalone : ""}`}>
    {standalone ? <header className={styles.header}><Link className={styles.brand} href="/" aria-label="Investník · úvodní stránka"><Wordmark /></Link></header> : null}
    <div className={styles.column}>
      <div className={styles.guideZone}><GuideImage className={styles.guide} pose={pose} alt="" sizes="(max-width: 767px) 132px, 200px" /></div>
      <section className={styles.card} aria-labelledby="route-state-title">
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 id="route-state-title" className={styles.title}>{title}</h1>
        <p className={styles.body} role={alert ? "alert" : undefined}>{children}</p>
        <div className={styles.actions}>
          {"href" in action
            ? <Link className={buttonVariants()} href={action.href}>{action.label}<ArrowRight size={18} aria-hidden="true" /></Link>
            : <button type="button" className={buttonVariants()} onClick={action.onClick}>{action.label}<RotateCcw size={18} aria-hidden="true" /></button>}
          {link ? <Link className={styles.textLink} href={link.href}>{link.label}<ArrowRight size={15} aria-hidden="true" /></Link> : null}
        </div>
      </section>
    </div>
  </main>;
}
