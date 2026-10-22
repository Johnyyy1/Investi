"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/learning/text-input";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-error";

export function EmailChange({ verified }: { verified: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const lock = useRef(false);
  useEffect(() => {
    if (open) input.current?.focus();
    else if (wasOpen.current) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);
  async function submit(form: FormData) {
    if (lock.current) return;
    lock.current = true; setPending(true); setMessage(undefined);
    try {
      const { error } = await authClient.changeEmail({ newEmail: String(form.get("email") ?? "").trim(), callbackURL: "/verify-email" });
      if (error) setMessage({ ok: false, text: getAuthErrorMessage(error, "Změnu e-mailu se nepodařilo zahájit. Zkus to za chvíli znovu.") });
      else { setOpen(false); setMessage({ ok: true, text: verified ? "Zkontroluj současnou schránku a potvrď změnu. Potom ověř i novou adresu. Do té doby platí současná adresa." : "Zkontroluj novou schránku a ověř adresu. Do té doby platí současná adresa." }); }
    } catch { setMessage({ ok: false, text: "Připojení se nepodařilo. Zkus to znovu." }); }
    finally { lock.current = false; setPending(false); }
  }
  return <div className="mt-4">
    {open ? <form action={submit} aria-label="Změnit e-mail" className="max-w-md space-y-4">
      <TextInput ref={input} label="Nový e-mail" name="email" type="email" autoComplete="email" required disabled={pending} />
      <p className="text-small text-secondary">Změna vyžaduje přihlášení z posledních 10 minut. {verified ? "Potvrď ji v současné schránce a ověř novou adresu." : "Novou adresu musíš nejdřív ověřit."}</p>
      <div className="flex flex-wrap gap-3"><Button type="submit" loading={pending}>Poslat potvrzení změny</Button><Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>Zrušit</Button></div>
    </form> : <Button ref={trigger} variant="secondary" onClick={() => { setMessage(undefined); setOpen(true); }}>Změnit e-mail</Button>}
    {message && <p role={message.ok ? "status" : "alert"} className={`mt-3 text-small ${message.ok ? "text-secondary" : "text-danger-ink"}`}>{message.text}</p>}
  </div>;
}
