import { StripToken } from "@/components/auth/strip-token";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Ověření e-mailu", robots: { index: false, follow: false } };

/** Better Auth's verification link lands here; on failure it appends ?error=TOKEN_EXPIRED or INVALID_TOKEN. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const [{ error }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const signedIn = Boolean(user && !user.isAnonymous);
  if (error) return (
    <AuthLayout demo={false} title="Odkaz už neplatí" description={signedIn ? "Ověřovací odkaz vypršel nebo už byl použitý. Nový si pošleš v Nastavení." : "Ověřovací odkaz vypršel nebo už byl použitý. Přihlas se a nový si pošleš v Nastavení."} guide="Nevadí, nový odkaz pošleš jedním klepnutím.">
      <StripToken />
      <Link href={signedIn ? "/settings?section=security" : "/sign-in"} className={buttonVariants({ className: "w-full" })}>{signedIn ? "Otevřít Nastavení" : "Přihlásit se"}</Link>
    </AuthLayout>
  );
  return (
    <AuthLayout demo={false} title="E-mail je ověřený" description="Díky. Kdykoli budeš potřebovat obnovit heslo, pošleme odkaz právě sem." guide="Hotovo. Můžeš pokračovat v učení.">
      <StripToken />
      <Link href={signedIn ? "/learn" : "/sign-in"} className={buttonVariants({ className: "w-full" })}>{signedIn ? "Pokračovat v učení" : "Přihlásit se"}</Link>
    </AuthLayout>
  );
}
