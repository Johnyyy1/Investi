"use client";

import { useLinkStatus } from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import styles from "./navigation-status.module.css";

/** Links report their useLinkStatus here; the shell shows one indicator for all of them. */
const ReportPending = createContext<(pending: boolean) => void>(() => {});

/**
 * Pending feedback for client navigations to routes without a route-level loading boundary.
 * useLinkStatus is pending from the click until the router commits the new URL, i.e. while the
 * server renders the destination. The bar fades in only after a CSS delay, so fast navigations
 * never flash it; screen readers get a polite status, and the main region is marked busy.
 */
export function NavigationStatusProvider({ children }: { children: (busy: boolean) => React.ReactNode }) {
  const [pendingLinks, setPendingLinks] = useState(0);
  const report = useCallback((pending: boolean) => setPendingLinks((count) => Math.max(0, count + (pending ? 1 : -1))), []);
  const busy = pendingLinks > 0;
  return <ReportPending.Provider value={report}>
    <div aria-hidden="true" data-navigation-indicator="" data-navigation-pending={busy || undefined} className={styles.bar} />
    <p role="status" className="sr-only">{busy ? "Načítám stránku…" : ""}</p>
    {children(busy)}
  </ReportPending.Provider>;
}

/** Rendered inside a next/link <Link> (useLinkStatus needs that). Renders nothing, so the link's
 * DOM, layout and child selectors are unchanged. */
export function LinkPendingReporter() {
  const { pending } = useLinkStatus();
  const report = useContext(ReportPending);
  useEffect(() => {
    if (!pending) return;
    report(true);
    return () => report(false);
  }, [pending, report]);
  return null;
}
