"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/learning/text-input";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage, retryAfterMessage } from "@/lib/auth-error";
import { readRecoveryEmail, rememberRecoveryEmail } from "./recovery-storage";

/** The confirmation and resend timer are identical for every accepted address. Server limits remain authoritative. */
export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string>();
  const emailInput = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const deadline = useRef(0);
  const lock = useRef(false);
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (emailInput.current) emailInput.current.value = readRecoveryEmail(); }, [sentTo]);
  useEffect(() => { if (sentTo) status.current?.focus(); }, [sentTo]);
  useEffect(() => {
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
  }, []);

  async function send(address: string) {
    if (lock.current) return;
    lock.current = true; setIsSubmitting(true); setErrorMessage(undefined);
    try {
      const { error } = await authClient.requestPasswordReset({ email: address, redirectTo: "/reset-password" }, {
        onError: ({ response }) => { if (response.status === 429) setErrorMessage(retryAfterMessage(response.headers.get("Retry-After"))); },
      });
      if (error) { setErrorMessage((current) => current ?? getAuthErrorMessage(error, "Odkaz se nepodařilo odeslat. Zkus to za chvíli znovu.")); return; }
      rememberRecoveryEmail(address); setSentTo(address); deadline.current = Date.now() + 60_000; setRemaining(60);
    } catch { setErrorMessage("Připojení se nepodařilo. Zkus to znovu."); }
    finally { lock.current = false; setIsSubmitting(false); }
  }

  if (sentTo) return <div className="space-y-4">
    <p ref={status} tabIndex={-1} role="status" className="rounded-control border border-border bg-surface p-4 text-body">Pokud k adrese <strong className="[overflow-wrap:anywhere]">{sentTo}</strong> existuje účet, poslali jsme na ni odkaz pro nastavení nového hesla. Odkaz platí 30 minut.</p>
    <p className="text-small text-secondary">Hledej odesílatele investi a předmět „Obnovení hesla k účtu investi“. Zkontroluj také spam.</p>
    {errorMessage && <p role="alert" className="text-small text-danger-ink">{errorMessage}</p>}
    <Button variant="secondary" className="w-full" disabled={remaining > 0} loading={isSubmitting} onClick={() => void send(sentTo)}>{remaining > 0 ? `Poslat znovu za ${remaining} s` : "Poslat znovu"}</Button>
    <button type="button" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4" onClick={() => { setSentTo(undefined); setErrorMessage(undefined); }}>Zadat jinou adresu</button>
  </div>;

  return <form action={(formData) => send(String(formData.get("email") ?? "").trim())} className="space-y-5">
    <TextInput label="E-mail" type="email" name="email" autoComplete="email" ref={emailInput} placeholder="ty@example.com" required />
    {errorMessage && <p className="text-small text-danger-ink" role="alert">{errorMessage}</p>}
    <Button className="w-full" type="submit" loading={isSubmitting}>{isSubmitting ? "Odesílám…" : "Poslat odkaz"}</Button>
  </form>;
}
