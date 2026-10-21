import { AppLink as Link } from "@/components/shell/app-link";
import { learningNavigation, type ShellNavItem } from "./navigation";
import { Wordmark } from "@/components/brand/wordmark";

export function AppSidebar({ activeId, items = learningNavigation }: { activeId: string; items?: ShellNavItem[] }) {
  return <aside className="w-60 shrink-0 border-r border-border bg-surface p-6">
    <Link href="/learn" className="text-page-title" aria-label="Investník · Učení"><Wordmark /></Link>
    <nav aria-label="Postranní navigace" className="mt-10 space-y-2">{items.map(({ id, label, icon: Icon, href }) => href ? <Link key={id} href={href} aria-current={activeId === id ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-control px-3 text-small transition-colors duration-[var(--motion-micro)] ${activeId === id ? "bg-primary-soft font-bold text-primary-hover" : "font-semibold text-secondary hover:bg-surface-muted hover:text-foreground"}`}><Icon className="size-5" aria-hidden="true" />{label}</Link> : <span key={id} aria-disabled="true" className="flex min-h-12 items-center gap-3 px-3 text-small text-secondary"><Icon className="size-5" aria-hidden="true" />{label}<span className="sr-only"> — připravujeme</span></span>)}</nav>
  </aside>;
}
