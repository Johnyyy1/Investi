"use client";

import { useEffect } from "react";

/** Once per page load, also under Strict Mode's double effects and client navigations back to the landing page. */
let counted = false;

type Browser = Pick<Navigator, "doNotTrack"> & { globalPrivacyControl?: boolean; sendBeacon?: Navigator["sendBeacon"] };

/** A visitor who sends Global Privacy Control or Do Not Track is not counted, nor is a browser without beacons. */
export const countsLandingView = (browser: Browser) =>
  browser.globalPrivacyControl !== true && browser.doNotTrack !== "1" && typeof browser.sendBeacon === "function";

/**
 * Counts one landing-page view for the product funnel. No cookie or browser storage is read or written,
 * and the beacon carries no body.
 */
export function LandingViewBeacon() {
  useEffect(() => {
    if (counted || !countsLandingView(navigator)) return;
    counted = true;
    navigator.sendBeacon("/api/analytics/visit");
  }, []);
  return null;
}
