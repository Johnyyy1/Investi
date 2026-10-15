import Link from "next/link";
import type { ReactNode } from "react";
import { OnboardingGuide } from "@/components/personalization/onboarding-frame";
import styles from "@/components/personalization/personalization-flow.module.css";
import { DemoButton } from "./demo-button";

/** Returning-learner entry in the same paper frame as onboarding; new learners start at /onboarding instead. */
export function AuthLayout({ title, description, guide, children, footer }: {
  title: string;
  description: string;
  guide: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className={`investi-theme ${styles.flow}`}>
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
        <p className={styles.authFooter}>{footer}</p>
        <DemoButton className={styles.authDemo} buttonClassName="w-full border-transparent bg-transparent text-secondary shadow-none hover:border-transparent hover:bg-surface-muted" />
        <p className={styles.disclosure}>Vzdělávání, ne investiční doporučení.</p>
      </div>
    </main>
  );
}
