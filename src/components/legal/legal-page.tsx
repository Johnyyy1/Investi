import Link from "next/link";
import type { ReactNode } from "react";
import { legalLinks } from "./legal-links";
import styles from "./legal.module.css";

/**
 * Who runs investi. Both values must be filled in by the operator, and the texts reviewed by a person
 * (ideally a lawyer), before these pages are relied on.
 */
export const legalOperator = {
  identity: "[DOPLNIT: jméno nebo název provozovatele, IČO a adresa]",
  contactEmail: "[DOPLNIT: kontaktní e-mail pro ochranu osobních údajů]",
} as const;
export const LEGAL_UPDATED_AT = "16. října 2026";

export type LegalSection = { id: string; title: string; body: ReactNode };

export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: readonly LegalSection[] }) {
  return <div className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} href="/" aria-label="investi · úvodní stránka">investi!</Link></header>
    <main className={styles.main}>
      <article className={styles.article} aria-labelledby="legal-title">
        <p className={styles.eyebrow}>Právní informace</p>
        <h1 id="legal-title">{title}</h1>
        <p className={styles.updated}>Poslední aktualizace: {LEGAL_UPDATED_AT}</p>
        <div className={styles.intro}>{intro}</div>
        <nav className={styles.toc} aria-label="Obsah"><h2>Obsah</h2><ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol></nav>
        {sections.map((section, index) => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className={styles.section}>
          <h2 id={`${section.id}-title`}><span aria-hidden="true">{index + 1}.</span> {section.title}</h2>
          {section.body}
        </section>)}
      </article>
    </main>
    <footer className={styles.footer}>
      <p>Vzdělávání, ne investiční doporučení.</p>
      <nav aria-label="Právní informace"><Link href="/">Úvod</Link>{legalLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
    </footer>
  </div>;
}
