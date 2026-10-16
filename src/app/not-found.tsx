import type { Metadata } from "next";
import { RouteState } from "@/components/route-state/route-state";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Stránka nenalezena" };

/** Unmatched URLs anywhere, including marketing typos, render outside the app shell. */
export default async function NotFound() {
  // A failed session read must not turn a 404 into an error page; it only drops the Studovna link.
  const signedIn = await getCurrentUser().then((user) => user !== null, () => false);
  return <RouteState standalone eyebrow="Chyba 404" title="Tuhle stránku jsme nenašli"
    action={signedIn ? { href: "/learn", label: "Pokračovat ve Studovně" } : { href: "/", label: "Na úvodní stránku" }}
    link={signedIn ? { href: "/", label: "Úvodní stránka" } : undefined}>
    Odkaz může být neúplný, nebo stránka už neexistuje. Zkontroluj adresu, nebo pokračuj odsud.
  </RouteState>;
}
