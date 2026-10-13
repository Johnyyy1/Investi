"use client";

import { useSyncExternalStore, type ComponentProps } from "react";

function subscribe(callback: () => void) {
  const query = window.matchMedia("(max-width: 767px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** Desktop starts expanded; on mobile the active chapter alone starts open.
 * Native details retains keyboard, toggle and focus behavior at both sizes. */
export function ResponsiveDisclosure({ initiallyOpen = false, ...props }: ComponentProps<"details"> & { initiallyOpen?: boolean }) {
  const mobile = useSyncExternalStore(subscribe, () => window.matchMedia("(max-width: 767px)").matches, () => false);
  return <details {...props} key={String(mobile)} open={!mobile || initiallyOpen} />;
}
