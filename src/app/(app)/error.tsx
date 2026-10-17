"use client";

import { RouteState } from "@/components/route-state/route-state";

/** Fallback for signed-in pages without their own boundary. It renders inside the app shell, which
 * only mounts for an authenticated learner, so it can point back to Učení. */
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteState alert pose="05-shrug" eyebrow="Něco se pokazilo" title="Tuhle stránku se teď nepodařilo načíst"
    action={{ onClick: () => retry(), label: "Zkusit znovu" }} link={{ href: "/learn", label: "Zpět na Učení" }}>
    Nic se neztratilo. Hotové lekce i cvičné portfolio zůstávají u tvého účtu, jen je teď neumíme zobrazit.
  </RouteState>;
}
