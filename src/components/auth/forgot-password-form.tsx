"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/learning/text-input";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-error";

/** The same confirmation follows every accepted request, so the form never reveals whether an account exists. */
export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const status = useRef<HTMLParagraphElement>(null);
  // Focus once the confirmation has committed; an action's state update can land after the next frame.
  useEffect(() => { if (sentTo) status.current?.focus(); }, [sentTo]);

  async function onSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    setIsSubmitting(true); setErrorMessage(undefined);
    try {
      const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
      if (error) { setErrorMessage(getAuthErrorMessage(error, "Odkaz se nepodařilo odeslat. Zkus to znovu.")); return; }
      setSentTo(email);
    } catch { setErrorMessage("Připojení se nepodařilo. Zkus to znovu."); }
    finally { setIsSubmitting(false); }
  }

  if (sentTo) return <div className="space-y-4">
    <p ref={status} tabIndex={-1} role="status" className="rounded-control border border-border bg-surface p-4 text-body">Pokud k adrese <strong className="[overflow-wrap:anywhere]">{sentTo}</strong> existuje účet, poslali jsme na ni odkaz pro nastavení nového hesla. Odkaz platí 30 minut.</p>
    <p className="text-small text-secondary">Nic nepřišlo? Zkontroluj spam nebo překlep v adrese. <button type="button" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4" onClick={() => setSentTo(undefined)}>Zadat e-mail znovu</button></p>
  </div>;

  return <form action={onSubmit} className="space-y-5">
    <TextInput label="E-mail" type="email" name="email" autoComplete="email" placeholder="ty@example.com" required />
    {errorMessage ? <p className="text-small text-danger-ink" role="alert">{errorMessage}</p> : null}
    <Button className="w-full" type="submit" loading={isSubmitting}>{isSubmitting ? "Odesílám…" : "Poslat odkaz"}</Button>
  </form>;
}
