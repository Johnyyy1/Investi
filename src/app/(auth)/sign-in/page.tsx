import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SocialSignIn } from "@/components/auth/social-sign-in";
import { authProviderAvailability } from "@/lib/auth";
import { getSocialAuthErrorMessage } from "@/lib/social-auth-error";
import { getCurrentUser } from "@/lib/session";
import { isGuestIdentity } from "@/features/guest/identity";

export const metadata = { title: "Přihlášení" };

export default async function AuthPage({ searchParams }: {
  searchParams: Promise<{ error?: string | string[]; account?: string }>;
}) {
  // A guest signs in here to move their learning into an existing account; other sessions are already in.
  const user = await getCurrentUser();
  if (user && !isGuestIdentity(user)) redirect("/learn");
  const { error, account } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  return (
    <AuthLayout title="Vítej zpět" description="Přihlas se a naváž tam, kde jsi skončil." guide="Rád tě zase vidím. Tvůj plán i pokrok na tebe čekají."
      footer={<>Jsi v investi poprvé? <Link href="/onboarding" className="font-semibold text-ql-link underline underline-offset-4">Začít se učit</Link></>}>
      {account === "deleted" && <p role="status" className="mb-5 rounded-control border border-border bg-surface p-4 text-small text-secondary">Účet je smazaný i se všemi daty.</p>}
      <SocialSignIn providers={authProviderAvailability} mode="sign-in" initialError={errorCode !== undefined ? getSocialAuthErrorMessage(errorCode) : undefined} />
      <SignInForm />
    </AuthLayout>
  );
}
