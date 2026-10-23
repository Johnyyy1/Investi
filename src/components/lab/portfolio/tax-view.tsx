import { ChevronDown, Download, Info } from "lucide-react";
import { formatFactDate } from "@/features/facts/resolve";
import type { TaxView } from "@/features/portfolio/tax-lots";
import { money, quantity } from "./lab-model";
import styles from "./portfolio-lab.module.css";

const date = (value: string) => new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric" }).format(new Date(value));

/** Educational tax view of the practice ledger. Separate from the Lab's weighted-average P&L. */
export function TaxPanel({ tax }: { tax: TaxView }) {
  return <details className={`${styles.card} ${styles.activity}`} data-testid="portfolio-tax">
    <summary>Daňový pohled · {tax.year}<ChevronDown size={18} aria-hidden="true" /></summary>
    <div className={styles.taxBody}>
      <p className={styles.meta}>
        Vzdělávací odhad, ne daňové poradenství{tax.limitVerifiedAt ? `; stav k ${formatFactDate(tax.limitVerifiedAt)}` : ""}.
        Tranše párujeme metodou FIFO (nejstarší první). Je to předpoklad simulace, správnou metodu ještě ověřujeme.
      </p>
      <h3>Příjmy z prodejů v roce {tax.year}</h3>
      <p className={styles.num} data-testid="tax-proceeds">
        <strong>{money(tax.proceedsMinor)}</strong>
        {tax.limitMinor ? <> z limitu {money(tax.limitMinor)}</> : null}
        <span className={styles.meta}> · prodeje: {tax.saleCount}</span>
      </p>
      <p className={styles.meta}>
        {tax.limitMinor
          ? "Sčítáme hrubé příjmy z prodejů, ne zisk. Patří sem i prodeje, u kterých by uplynul časový test."
          : `Limit pro rok ${tax.year} zatím nemáme ověřený, proto ho neukazujeme.`}
        {" "}Počítáme jen aktuální portfolio. Kč jsou podle kurzu obchodu v Labu, ne podle daňového kurzu.
      </p>
      <h3>Otevřené tranše</h3>
      {tax.lots.length ? <ul aria-label="Otevřené tranše">{tax.lots.map((lot) => <li key={lot.tradeId}>
        <span><strong>{lot.symbol}</strong> · <span className={styles.num}>{quantity(lot.quantity)} ks</span></span>
        <span className={styles.num}>{money(lot.costMinor)}</span>
        <span className={styles.meta}>koupeno {date(lot.acquiredAt)}</span>
      </li>)}</ul> : <p className={styles.meta}>Žádné otevřené tranše.</p>}
      <p className={styles.note}><Info size={15} aria-hidden="true" />Datum splnění časového testu zatím neukazujeme. Přesný den výročí čeká na odborné ověření.</p>
      <a className={styles.textLink} href="/api/portfolio/export" download>Stáhnout evidenci obchodů (CSV)<Download size={16} aria-hidden="true" /></a>
    </div>
  </details>;
}
