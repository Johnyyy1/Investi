import { StripToken } from "@/components/auth/strip-token";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Nové heslo", robots: { index: false, follow: false } };

/** Better Auth's e-mailed link checks the token and lands here with ?token=…, or with ?error=INVALID_TOKEN. */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[]; error?: string | string[] }> }) {
  const { token, error } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  const footer = <>Heslo si pamatuješ? <Link href="/sign-in" className="font-semibold text-primary underline underline-offset-4">Přihlásit se</Link></>;
  if (!value || error) return (
    <AuthLayout demo={false} title="Odkaz už neplatí" description="Odkaz pro obnovení hesla platí 30 minut a dá se použít jen jednou. Požádej o nový." guide="Nevadí, nový odkaz je hned na cestě." footer={footer}>
      <StripToken />
      <Link href="/forgot-password" className={buttonVariants({ className: "w-full" })}>Poslat nový odkaz</Link>
    </AuthLayout>
  );
  return (
    <AuthLayout demo={false} title="Nastav si nové heslo" description="Po uložení se odhlásíš ze všech zařízení a přihlásíš se novým heslem." guide="Ještě krok a jsi zpátky." footer={footer}>
      <ResetPasswordForm token={value} />
    </AuthLayout>
  );
}
