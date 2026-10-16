"use client";

import { RouteState } from "@/components/route-state/route-state";

/** Only failures outside the signed-in pages land here (marketing, auth, onboarding, the app layout
 * itself), so the copy cannot assume an account. Errors inside the app shell use (app)/error.tsx. */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteState standalone alert pose="05-shrug" eyebrow="Něco se pokazilo" title="Tuhle stránku se teď nepodařilo načíst"
    action={{ onClick: () => retry(), label: "Zkusit znovu" }} link={{ href: "/", label: "Na úvodní stránku" }}>
    Většinou pomůže zkusit to znovu za chvíli. Pokud to nepomůže, vrať se na úvodní stránku.
  </RouteState>;
}
