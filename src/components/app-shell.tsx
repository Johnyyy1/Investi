"use client";

import { ChevronDown, LockKeyhole, LogOut, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { initializeTimeZoneAction } from "@/features/gamification/actions";
import { availableLessons } from "@/features/learning/catalog";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Surface } from "@/components/ui/surface";
import { AppLink as Link } from "./shell/app-link";
import { MobileNav } from "./shell/mobile-nav";
import { NavigationStatusProvider } from "./shell/navigation-status";
import { learningNavigation } from "./shell/navigation";
import styles from "./shell/paper-shell.module.css";
import { Wordmark } from "@/components/brand/wordmark";

function activeNavigationId(pathname: string) {
  if (pathname.startsWith("/learn")) return "learn";
  if (pathname.startsWith("/lab")) return "lab";
  if (pathname === "/progress") return "progress";
  return "";
}

export function AppShell({ children, userName, isDemo = false, isGuest = false, needsTimeZone = false, portfolioLabLocked = false, needsEmailVerification = false }: { children: React.ReactNode; userName: string; isDemo?: boolean; isGuest?: boolean; needsTimeZone?: boolean; portfolioLabLocked?: boolean; needsEmailVerification?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const activeId = activeNavigationId(pathname);
  useEffect(() => { if (needsTimeZone) void initializeTimeZoneAction(Intl.DateTimeFormat().resolvedOptions().timeZone); }, [needsTimeZone]);
  async function signOut() {
    setPending(true); setError(undefined);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Odhlášení se nezdařilo");
      router.replace("/sign-in"); router.refresh();
    } catch { setError("Odhlášení se nezdařilo. Zkus to znovu."); setPending(false); }
  }
  // Focused flows render without the shell: lessons, and the mix builder whose sticky save bar replaces the tab bar.
  if (availableLessons.some((lesson) => pathname === `/learn/${lesson.moduleSlug}/${lesson.slug}`)) return children;

  const displayName = isDemo ? "Demo" : isGuest ? "Host" : userName;
  const initial = displayName.trim().charAt(0).toUpperCase() || "I";
  return <NavigationStatusProvider>{(navigating) => <div className={`min-h-dvh bg-background ${styles.shell}`}>
    <a href="#main-content" className="sr-only z-50 rounded-control bg-surface p-4 shadow-elevation-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Přeskočit na obsah</a>
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-4 min-[375px]:px-5 sm:px-8 lg:px-10">
        <Link href="/learn" className="flex min-h-12 min-w-0 items-center" aria-label="Investník · Učení">
          <Wordmark className={styles.wordmark} />
        </Link>

        <nav aria-label="Hlavní navigace" className="hidden items-center gap-1 rounded-button border border-border bg-surface p-1 shadow-elevation-1 lg:flex">
          {learningNavigation.map(({ id, label, icon: Icon, href }) => {
            const active = id === activeId;
            return <Link key={id} href={href!} aria-current={active ? "page" : undefined} className={`relative flex min-h-12 items-center gap-2 rounded-control px-4 text-small transition-[background-color,color] duration-[var(--motion-micro)] ease-[var(--ease-standard)] ${active ? "bg-primary-soft font-bold text-primary-hover" : "font-semibold text-secondary hover:bg-surface-muted hover:text-foreground"}`}>
              <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
              {label}
              {id === "lab" && portfolioLabLocked ? <LockKeyhole aria-label="Portfolio Lab je zamčený" className="size-3.5 text-secondary" /> : null}
              {active ? <span aria-hidden="true" className="absolute inset-x-4 bottom-1 h-0.5 rounded-pill bg-primary" /> : null}
            </Link>;
          })}
        </nav>

        <details key={pathname} className="group relative shrink-0" onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
          <summary aria-label="Nabídka účtu" className="flex min-h-12 cursor-pointer list-none items-center gap-1 rounded-button border border-border bg-surface p-1 pr-1.5 font-bold text-foreground shadow-elevation-1 transition-[background-color,border-color] duration-[var(--motion-micro)] hover:border-border-strong hover:bg-surface-muted sm:gap-2 sm:p-1.5 sm:pr-2.5 [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="flex size-[36px] shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary-hover">{initial}</span>
            <span className="hidden max-w-32 truncate text-small xl:block">{displayName}</span>
            <ChevronDown aria-hidden="true" className="size-[16px] shrink-0 text-secondary transition-transform duration-[var(--motion-micro)] group-open:rotate-180" />
          </summary>
          <Surface elevation="floating" radius="panel" className="absolute right-0 z-40 mt-3 w-[min(18rem,calc(100vw-2rem))] overflow-hidden p-2">
            <div className="px-3 pt-3 pb-4">
              <div className="flex flex-wrap items-center gap-3"><span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-soft font-bold text-primary-hover">{initial}</span><div className="min-w-24 flex-1"><p className="truncate text-small font-bold text-foreground">{isGuest ? "Host" : userName}</p><p className="mt-0.5 break-words text-microcopy leading-tight text-secondary">{isDemo ? "Soukromý cvičný profil" : isGuest ? "Pokrok je zatím jen v tomhle prohlížeči" : "Student Investníku"}</p></div></div>
              {isDemo ? <Badge tone="primary" className="mt-3">Dostupný 24 hodin</Badge> : null}
              {isGuest ? <Link href="/onboarding/save" className={cn(buttonVariants({ size: "compact" }), "mt-3 w-full")}>Uložit pokrok</Link> : null}
              {needsEmailVerification && <Link href="/settings?section=security" className="mt-2 flex min-h-11 items-center text-small font-semibold text-primary underline underline-offset-4">Ověř e-mail</Link>}
            </div>
            <div className="border-t border-border pt-2">
              <Link href="/settings" className="flex min-h-12 items-center gap-3 rounded-control px-3 text-small font-semibold text-foreground transition-colors duration-[var(--motion-micro)] hover:bg-surface-muted"><Settings aria-hidden="true" className="size-[18px] text-secondary" />Nastavení</Link>
              {/* Signing a guest out would strand their unsaved progress; they save or leave instead. */}
              {!isGuest && <Button variant="ghost" className="w-full justify-start gap-3 rounded-control px-3 text-danger-ink hover:bg-danger-soft hover:text-danger-ink" loading={pending} onClick={() => void signOut()}><LogOut aria-hidden="true" className="size-[18px]" />Odhlásit se</Button>}
            </div>
            {error ? <p role="alert" className="mx-3 border-t border-border py-3 text-small text-danger-ink">{error}</p> : null}
          </Surface>
        </details>
      </div>
    </header>
    <div id="main-content" tabIndex={-1} aria-busy={navigating || undefined} className="min-h-[calc(100dvh-5rem)] pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
    <MobileNav activeId={activeId} portfolioLabLocked={portfolioLabLocked} />
  </div>}</NavigationStatusProvider>;
}
