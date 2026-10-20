import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Zapomenuté heslo" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout demo={false} title="Zapomenuté heslo" description="Zadej e-mail svého účtu. Pošleme na něj odkaz, přes který si nastavíš nové heslo." guide="To se stává. Pokrok i cvičný kapitál ti zůstanou."
      footer={<>Heslo si pamatuješ? <Link href="/sign-in" className="font-semibold text-primary underline underline-offset-4">Přihlásit se</Link></>}>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
