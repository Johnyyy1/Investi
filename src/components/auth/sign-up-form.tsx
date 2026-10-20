"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/learning/text-input";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-error";

export function SignUpForm({ redirectTo = "/onboarding" }: { redirectTo?: string }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(formData: FormData) {
    setIsSubmitting(true); setErrorMessage(undefined);
    try {
    const { error } = await authClient.signUp.email({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      // Where the verification e-mail link lands; the form itself continues to redirectTo.
      callbackURL: "/verify-email",
    });
    if (error) { setErrorMessage(getAuthErrorMessage(error, "Účet se nepodařilo vytvořit. Zkus to znovu.")); setIsSubmitting(false); return; }
    router.replace(redirectTo); router.refresh();
    } catch { setErrorMessage("Připojení se nepodařilo. Zkus to znovu."); }
    finally { setIsSubmitting(false); }
  }

  return <form action={onSubmit} className="space-y-5">
    <TextInput label="Jméno" type="text" name="name" autoComplete="name" placeholder="Tvoje jméno" required />
    <TextInput label="E-mail" type="email" name="email" autoComplete="email" placeholder="ty@example.com" required />
    <TextInput label="Heslo" type="password" name="password" autoComplete="new-password" minLength={8} required hint="Použij alespoň 8 znaků." />
    {errorMessage ? <p className="text-small text-danger-ink" role="alert">{errorMessage}</p> : null}
    <Button className="w-full" type="submit" loading={isSubmitting}>{isSubmitting ? "Vytvářím účet…" : "Vytvořit účet"}</Button>
  </form>;
}
