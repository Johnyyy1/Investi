import Link from "next/link";
import type { ReactNode } from "react";
import { OnboardingGuide } from "@/components/personalization/onboarding-frame";
import styles from "@/components/personalization/personalization-flow.module.css";
import { DemoButton } from "./demo-button";

/** Returning-learner entry in the same paper frame as onboarding; new learners start at /onboarding instead. */
export function AuthLayout({ title, description, guide, children, footer, demo = true }: {
  title: string;
  description: string;
  guide: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Account recovery screens leave out the demo entry; it is not a way back into an account. */
  demo?: boolean;
}) {
  return (
    <main className={styles.flow}>
      <header className={styles.authHeader}>
        <Link className={styles.brand} href="/" aria-label="investi · úvodní stránka">investi!</Link>
      </header>
      <div className={styles.column}>
        <OnboardingGuide pose="01-welcome">{guide}</OnboardingGuide>
        <section className={styles.questionCard} aria-labelledby="auth-title">
          <p className={styles.eyebrow}>Přihlášení</p>
          <h1 id="auth-title" className={styles.questionTitle}>{title}</h1>
          <p className={styles.helper}>{description}</p>
          <div className={styles.authFields}>{children}</div>
        </section>
        {footer && <p className={styles.authFooter}>{footer}</p>}
        {demo && <DemoButton className={styles.authDemo} buttonClassName="w-full border-transparent bg-transparent text-secondary shadow-none hover:border-transparent hover:bg-surface-muted" />}
        <p className={styles.disclosure}>Vzdělávání, ne investiční doporučení. <Link href="/privacy">Ochrana osobních údajů</Link> · <Link href="/terms">Podmínky použití</Link></p>
      </div>
    </main>
  );
}
