"use client";
import { useEffect } from "react";

/** Keep Next's navigation state; the form retains its server-provided token only in memory. */
export function StripToken() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  return null;
}
