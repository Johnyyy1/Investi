"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/learning/text-input";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-error";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [mismatch, setMismatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmation = useRef<HTMLInputElement>(null);

  async function onSubmit(formData: FormData) {
    const newPassword = String(formData.get("password") ?? "");
    if (newPassword !== String(formData.get("confirmation") ?? "")) {
      setMismatch(true); setErrorMessage("Hesla se neshodují."); confirmation.current?.focus(); return;
    }
    setMismatch(false); setIsSubmitting(true); setErrorMessage(undefined);
    try {
      const { error } = await authClient.resetPassword({ newPassword, token });
      if (error) { setErrorMessage(getAuthErrorMessage(error, "Heslo se nepodařilo změnit. Zkus to znovu.")); return; }
      // Every session ends with the reset, so the learner signs in again with the new password.
      router.replace("/sign-in?password=reset");
    } catch { setErrorMessage("Připojení se nepodařilo. Zkus to znovu."); }
    finally { setIsSubmitting(false); }
  }

  return <form action={onSubmit} className="space-y-5">
    <TextInput label="Nové heslo" type="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} required hint="Použij alespoň 8 znaků." />
    <TextInput ref={confirmation} label="Nové heslo znovu" type="password" name="confirmation" autoComplete="new-password" minLength={8} maxLength={128} required aria-invalid={mismatch || undefined} />
    {errorMessage ? <p className="text-small text-danger-ink" role="alert">{errorMessage}</p> : null}
    <Button className="w-full" type="submit" loading={isSubmitting}>{isSubmitting ? "Ukládám…" : "Uložit nové heslo"}</Button>
  </form>;
}
