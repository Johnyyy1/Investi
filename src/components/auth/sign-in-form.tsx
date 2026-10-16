"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/learning/text-input";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-error";

export function SignInForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  async function onSubmit(formData: FormData) {
    setIsSubmitting(true); setErrorMessage(undefined);
    try {
    const { error } = await authClient.signIn.email({ email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? ""), callbackURL: "/learn" });
    if (error) { setErrorMessage(getAuthErrorMessage(error, "Přihlášení se nepodařilo. Zkus to znovu.")); setIsSubmitting(false); return; }
    router.replace("/learn"); router.refresh();
    } catch { setErrorMessage("Připojení se nepodařilo. Zkus to znovu."); }
    finally { setIsSubmitting(false); }
  }
  return <form action={onSubmit} className="space-y-5">
    <TextInput label="E-mail" type="email" name="email" autoComplete="email" placeholder="ty@example.com" required />
    <TextInput label="Heslo" type="password" name="password" autoComplete="current-password" required />
    {errorMessage ? <p className="text-small text-danger-ink" role="alert">{errorMessage}</p> : null}
    <Button className="w-full" type="submit" loading={isSubmitting}>{isSubmitting ? "Přihlašuji…" : "Přihlásit se"}</Button>
  </form>;
}
