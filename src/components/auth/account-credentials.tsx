"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FirstPassword } from "./first-password";
import { PasswordInput } from "./password-input";
import { TextInput } from "@/components/learning/text-input";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-error";
import styles from "@/components/settings/settings.module.css";

type Message = { ok: boolean; text: string };

/** Verification status of the account e-mail, with a way to send the link again. */
export function EmailVerification({ email, verified, suppressed }: { email: string; verified: boolean; suppressed?: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>();
  const lock = useRef(false);

  async function send() {
    if (lock.current) return;
    lock.current = true; setPending(true); setMessage(undefined);
    try {
      const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/verify-email" });
      if (error) setMessage({ ok: false, text: error.code === "EMAIL_ALREADY_VERIFIED" ? "E-mail je už ověřený. Obnov stránku." : getAuthErrorMessage(error, "Odkaz se nepodařilo odeslat. Zkus to za chvíli znovu.") });
      else setMessage({ ok: true, text: `Odkaz jsme poslali na ${email}. Platí 24 hodin.` });
    } catch {
      setMessage({ ok: false, text: "Připojení se nepodařilo. Zkus to znovu." });
    } finally {
      lock.current = false; setPending(false);
    }
  }

  return <div className="mt-8">
    <h3 className="text-card-title font-bold">E-mail</h3>
    <div className="mt-3 flex flex-col gap-3 border-y border-border py-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
      <div className="min-w-0"><p className="text-body font-semibold [overflow-wrap:anywhere]">{email}</p><p className={`mt-1 text-small ${verified ? "text-success-ink" : "text-secondary"}`}>{verified ? "Ověřený" : "Zatím neověřený. Ověření potvrdí, že adresa patří tobě."}</p></div>
      {!verified && <Button variant="secondary" size="compact" loading={pending} onClick={() => void send()}>{pending ? "Odesílám…" : "Poslat ověřovací odkaz"}</Button>}
    </div>
    {suppressed && <p role="status" className="mt-3 text-small text-danger-ink">Na tuto adresu se e-maily nedaří doručit. Zkontroluj ji, nebo ji změň. <a href="#change-email" className="inline-flex min-h-11 items-center font-semibold underline">Změnit e-mail</a></p>}
    {message && <p className={message.ok ? styles.status : styles.error} role={message.ok ? "status" : "alert"}>{message.text}</p>}
  </div>;
}

function passwordChangeError(error: { code?: string; status?: number; message?: string }) {
  if (error.code === "INVALID_PASSWORD") return "Současné heslo není správně.";
  if (error.status === 401) return "Relace skončila. Přihlas se znovu a heslo změň potom.";
  return getAuthErrorMessage(error, "Heslo se nepodařilo změnit. Zkus to znovu.");
}

/** Password change behind a trigger; accounts without a password set one through the e-mailed reset link. */
export function PasswordChange({ hasPassword, onPasswordSet }: { hasPassword: boolean; onPasswordSet?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>();
  const lock = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = useRef<HTMLInputElement>(null);
  const opened = useRef(false);
  // Focus follows the form: into it when it opens, back to the trigger once it closes.
  useEffect(() => {
    if (open) current.current?.focus();
    else if (opened.current) trigger.current?.focus();
    opened.current = open;
  }, [open]);

  function close(result?: Message) {
    setOpen(false); setMessage(result);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("new-password") ?? "");
    lock.current = true; setPending(true); setMessage(undefined);
    try {
      const { error } = await authClient.changePassword({ currentPassword: String(form.get("current-password") ?? ""), newPassword, revokeOtherSessions: form.get("revoke") === "on" });
      if (error) { setMessage({ ok: false, text: passwordChangeError(error) }); return; }
      close({ ok: true, text: form.get("revoke") === "on" ? "Heslo je změněné. Ostatní zařízení jsou odhlášená." : "Heslo je změněné." });
    } catch {
      setMessage({ ok: false, text: "Připojení se nepodařilo. Zkus to znovu." });
    } finally {
      lock.current = false; setPending(false);
    }
  }

  return <div className="mt-8">
    <h3 className="text-card-title font-bold">Heslo</h3>
    {!hasPassword ? <FirstPassword onSet={onPasswordSet} /> : open ? <form onSubmit={submit} className="mt-3 max-w-md space-y-5 border-y border-border py-4" aria-label="Změnit heslo">
      <TextInput ref={current} label="Současné heslo" type="password" name="current-password" autoComplete="current-password" required disabled={pending} />
      <PasswordInput label="Nové heslo" type="password" name="new-password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={pending} hint="Použij alespoň 8 znaků." />

      <label className={styles.choice}><input type="checkbox" name="revoke" defaultChecked disabled={pending} /><span><strong>Odhlásit ostatní zařízení</strong><small>Hodí se, pokud heslo zná i někdo další.</small></span></label>
      {message && !message.ok && <p className={styles.error} role="alert">{message.text}</p>}
      <div className={styles.actions}><Button type="submit" loading={pending}>{pending ? "Ukládám…" : "Uložit nové heslo"}</Button><Button variant="secondary" size="compact" disabled={pending} onClick={() => close()}>Zrušit</Button></div>
    </form> : <div className="mt-3 flex flex-col gap-3 border-y border-border py-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
      <p className="text-small text-secondary">Přihlašuješ se e-mailem a heslem.</p>
      <Button ref={trigger} variant="secondary" size="compact" onClick={() => { setMessage(undefined); setOpen(true); }}>Změnit heslo</Button>
    </div>}
    {message?.ok && <p className={styles.status} role="status">{message.text}</p>}
  </div>;
}
