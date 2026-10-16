import { AppLink as Link } from "./app-link";
import { learningNavigation, type ShellNavItem } from "./navigation";
import { LockKeyhole } from "lucide-react";
import styles from "./paper-shell.module.css";

export function MobileNav({ activeId, lessonMode = false, items = learningNavigation, preview = false, portfolioLabLocked = false }: { activeId: string; lessonMode?: boolean; items?: ShellNavItem[]; preview?: boolean; portfolioLabLocked?: boolean }) {
  if (lessonMode) return null;
  return <nav aria-label="Mobilní navigace" className={`${styles.mobileNav} grid grid-flow-col auto-cols-fr border-t border-border bg-surface px-1 pt-1 pb-[max(.25rem,env(safe-area-inset-bottom))] ${preview ? "" : "fixed inset-x-0 bottom-0 z-30 lg:hidden"}`}>{items.map(({ id, label, icon: Icon, href }) => {
    const active = id === activeId;
    return href ? <Link href={href} key={id} aria-current={active ? "page" : undefined} className={`relative mx-0.5 flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-button px-1 text-microcopy transition-colors duration-[var(--motion-micro)] ${active ? "bg-primary-soft font-bold text-primary-hover" : "font-semibold text-secondary hover:bg-surface-muted hover:text-foreground"}`}><Icon className="size-5 shrink-0" strokeWidth={active ? 2.5 : 2} aria-hidden="true" /><span className="max-w-full break-words text-center leading-tight">{label}{id === "lab" && portfolioLabLocked ? <LockKeyhole aria-label="Portfolio Lab je zamčený" className="ml-1 inline size-3" /> : null}</span>{active ? <span aria-hidden="true" className="absolute top-1 h-0.5 w-7 rounded-pill bg-primary" /> : null}</Link> : <span key={id} aria-disabled="true" className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-microcopy text-secondary"><Icon className="size-5" aria-hidden="true" /><span className="max-w-full break-words text-center leading-tight">{label}</span><span className="sr-only"> — připravujeme</span></span>;
  })}</nav>;
}
