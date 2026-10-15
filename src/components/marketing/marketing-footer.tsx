import Image from "next/image";
import Link from "next/link";
import styles from "./marketing.module.css";

const footerGroups = [
  {
    title: "Produkt",
    links: [
      { href: "/learn", label: "Učení" },
      { href: "/lab/portfolio", label: "Portfolio Lab" },
      { href: "/lab/backtesting", label: "Backtesting Lab" },
      { href: "/progress", label: "Pokrok" },
    ],
  },
  {
    title: "Účet",
    links: [
      { href: "/sign-in", label: "Přihlásit se" },
      { href: "/onboarding", label: "Začít se učit" },
    ],
  },
] as const;

export function MarketingFooter() {
  return <footer className={styles.marketingFooter}>
    <div className={styles.container}>
      <div className={styles.footerTop}>
        <div className={styles.footerBrand}>
          <Link href="/" aria-label="investi domů" className={styles.footerLogo}>
            <Image src="/brand/investi-logo.png" alt="investi" width={2172} height={724} sizes="150px" />
          </Link>
          <p>Uč se investovat praxí.</p>
        </div>

        <nav aria-label="Navigace v zápatí" className={styles.footerNavigation}>
          {footerGroups.map((group) => <div key={group.title} className={styles.footerLinkGroup}>
            <h2>{group.title}</h2>
            <ul>
              {group.links.map((link) => <li key={link.href}>
                <Link href={link.href} prefetch={false}>{link.label}</Link>
              </li>)}
            </ul>
          </div>)}
        </nav>
      </div>

      <div className={styles.footerBottom}>
        <p>© 2026 investi. Všechna práva vyhrazena.</p>
        <p>investi je vzdělávací produkt. Tento web neposkytuje finanční poradenství.</p>
      </div>
    </div>
  </footer>;
}
