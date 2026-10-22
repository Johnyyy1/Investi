"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "./password-input";
import { getAuthErrorMessage } from "@/lib/auth-error";

export function FirstPassword({ onSet }: { onSet?: () => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const lock = useRef(false);
  async function submit(form: FormData) {
    if (lock.current) return;
    lock.current = true; setPending(true); setMessage(undefined);
    try {
      const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: form.get("new-password") }) });
      if (!response.ok) { const error = await response.json(); setMessage(getAuthErrorMessage({ code: error.code, status: response.status }, "Heslo se nepodařilo nastavit. Zkus se přihlásit znovu nebo použij e-mailový odkaz.")); return; }
      setMessage("Heslo je nastavené."); onSet?.();
    } catch { setMessage("Připojení se nepodařilo. Zkus to znovu."); }
    finally { lock.current = false; setPending(false); }
  }
  return <form action={submit} aria-label="Nastavit heslo" className="mt-3 max-w-md space-y-4 border-y border-border py-4">
    <p className="text-small text-secondary">Nastav si heslo přímo tady. Změna vyžaduje přihlášení z posledních 10 minut.</p>
    <PasswordInput label="Nové heslo" name="new-password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={pending} hint="Použij alespoň 8 znaků." />
    <Button type="submit" loading={pending}>Nastavit heslo</Button>
    {message && <p role="status" className="text-small text-secondary">{message}</p>}
    <p><Link href="/forgot-password" className="inline-flex min-h-11 items-center text-small font-semibold text-primary underline">Použít e-mailový odkaz</Link></p>
  </form>;
}
