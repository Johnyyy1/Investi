"use client";

import { AppLink as Link } from "@/components/shell/app-link";
import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { accountDeletionErrorMessage } from "@/features/account/deletion";
import { authClient } from "@/lib/auth-client";
import type { AuthProviderAvailability } from "@/lib/auth-providers";
import type { LinkedAccountState } from "@/lib/auth-accounts";
import styles from "./settings.module.css";

type SocialProvider = "google" | "facebook";
const providerLabels: Record<SocialProvider, string> = { google: "Google", facebook: "Facebook" };
/** Where a social re-authentication returns; the page reopens the confirmation from it. */
const ACCOUNT_DELETION_RETURN_URL = "/settings?section=data&delete=confirm";

type Props = {
  saved: boolean; guest: boolean; hasPassword: boolean | null; fresh: boolean; reopenDeletion: boolean;
  accounts: LinkedAccountState | null; providers: AuthProviderAvailability;
};

export function AccountData(props: Props) {
  return <section className={styles.section} aria-labelledby="data-export-title">
    <DataExport />
    {props.saved ? props.hasPassword === null ? <DeletionUnavailable /> : <AccountDeletion {...props} hasPassword={props.hasPassword} /> : <>
      <div className={styles.sectionHead}><h2>Smazání profilu</h2><p>{props.guest ? "Profil hosta nemá uložený účet." : "Demo je samostatný dočasný profil."}</p></div>
      <div className={styles.card}><div className={styles.contentRow}><div><h3>Tento profil se smaže sám</h3><p>{props.guest ? "Pokrok hosta smažeme automaticky den poté, co vyprší jeho poslední relace. Když si vytvoříš účet, pokrok se do něj přesune." : "Demo profil i jeho cvičná data smažeme automaticky den poté, co demo skončí."}</p></div></div></div>
    </>}
    <Link href="/privacy" className={styles.textLink}>Jak zacházíme s osobními údaji</Link>
  </section>;
}

function DataExport() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  async function download() {
    if (pending) return;
    setPending(true); setMessage(undefined);
    try {
      const response = await fetch("/api/account/export", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        setMessage({ ok: false, text: response.status === 429 ? "Data se teď stahovala už několikrát. Zkus to znovu později." : response.status === 401 ? "Relace skončila. Přihlas se znovu." : "Data se nepodařilo připravit. Zkus to znovu." });
        return;
      }
      const filename = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "investi-moje-data.json";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ ok: true, text: `Soubor ${filename} se stahuje.` });
    } catch { setMessage({ ok: false, text: "Připojení se nepodařilo. Zkus to znovu." }); }
    finally { setPending(false); }
  }
  return <>
    <div className={styles.sectionHead}><h2 id="data-export-title">Stáhnout moje data</h2><p>Kopie všeho, co o tobě investi ukládá, ve strojově čitelném formátu JSON.</p></div>
    <div className={styles.card}>
      <div className={styles.contentRow}><div><h3>Profil, učení a cvičné portfolio</h3><p>Účet a způsoby přihlášení, relace (IP adresa a prohlížeč), plán učení, pokrok, odměny, portfolia a obchody. Hesla ani přihlašovací tokeny soubor neobsahuje.</p></div>
        <Button variant="secondary" size="compact" loading={pending} onClick={() => void download()}>{!pending && <Download size={18} aria-hidden="true" />}{pending ? "Připravuji…" : "Stáhnout data"}</Button></div>
      {message && <p className={message.ok ? styles.status : styles.error} role={message.ok ? "status" : "alert"}>{message.text}</p>}
    </div>
  </>;
}

function DeletionUnavailable() {
  return <>
    <div className={styles.sectionHead}><h2>Smazat účet</h2><p>Smazání je trvalé a nejde vrátit.</p></div>
    <div className={styles.card}><div className={styles.contentRow}><div><h3>Smazání teď nejde připravit</h3><p role="alert">Nepodařilo se načíst, jak se přihlašuješ. Načti stránku znovu.</p></div><a className={buttonVariants({ variant: "secondary", size: "compact" })} href="/settings?section=data">Načíst znovu</a></div></div>
  </>;
}

function AccountDeletion({ hasPassword, fresh: initiallyFresh, reopenDeletion, accounts, providers }: Props & { hasPassword: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [fresh, setFresh] = useState(initiallyFresh);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"delete" | SocialProvider>();
  const [error, setError] = useState<string>();
  const reauthProviders = (["google", "facebook"] as const).filter((provider) => accounts?.[provider] && providers[provider]);
  const needsReauth = !hasPassword && !fresh;

  function open() { setError(undefined); setPassword(""); dialog.current?.showModal(); }
  useEffect(() => {
    if (!reopenDeletion) return;
    // Back from a fresh sign-in: drop the marker so a reload does not reopen the dialog.
    window.history.replaceState(null, "", "/settings?section=data");
    dialog.current?.showModal();
  }, [reopenDeletion]);

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (hasPassword && !password) { setError(accountDeletionErrorMessage("PASSWORD_REQUIRED")); passwordInput.current?.focus(); return; }
    lock.current = true; setPending("delete"); setError(undefined);
    try {
      const result = await authClient.deleteUser(hasPassword ? { password } : {});
      if (result.error) {
        const code = result.error.code?.toUpperCase();
        if (!hasPassword && (code === "SESSION_NOT_FRESH" || code === "SESSION_EXPIRED")) setFresh(false);
        setError(accountDeletionErrorMessage(code, result.error.status));
        if (code === "INVALID_PASSWORD") { setPassword(""); passwordInput.current?.focus(); }
        lock.current = false; setPending(undefined);
        return;
      }
      // A full navigation drops every cached screen of the deleted account.
      window.location.replace("/sign-in?account=deleted");
    } catch {
      setError(accountDeletionErrorMessage()); lock.current = false; setPending(undefined);
    }
  }

  async function reauthenticate(provider: SocialProvider) {
    if (lock.current) return;
    lock.current = true; setPending(provider); setError(undefined);
    try {
      const result = await authClient.signIn.social({ provider, callbackURL: ACCOUNT_DELETION_RETURN_URL, errorCallbackURL: "/settings?section=data" });
      if (!result.error) return; // Keep locked until Better Auth's redirect leaves the page.
      setError("Přihlášení se nepodařilo. Zkus to znovu.");
    } catch { setError("Přihlášení se nepodařilo. Zkus to znovu."); }
    lock.current = false; setPending(undefined);
  }

  return <>
    <div className={styles.sectionHead}><h2 id="delete-account-title">Smazat účet</h2><p>Smazání je trvalé a nejde vrátit.</p></div>
    <div className={styles.card}><div className={styles.contentRow}><div><h3>Smazat účet a všechna data</h3><p>Smaže účet, pokrok v lekcích, odměny, cvičná portfolia i historii obchodů. Obsah lekcí a tržní data jsou společné pro všechny a zůstanou.</p></div>
      <Button buttonRef={trigger} variant="dangerQuiet" size="compact" onClick={open}>Smazat účet…</Button></div></div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={(event) => { if (pending) event.preventDefault(); }} onClose={() => trigger.current?.focus()}>
      <h2 id="delete-title">Smazat účet natrvalo?</h2>
      <p id="delete-description">Smažeme tvůj účet a všechno, co k němu patří. Tuhle akci nejde vrátit.</p>
      <ul><li>Pokrok v lekcích, XP, diagnostika a plán učení.</li><li>Cvičný kapitál, všechna portfolia, obchody a uložené mixy.</li><li>Všechny způsoby přihlášení. Odhlásíme tě na všech zařízeních.</li></ul>
      <p>Chceš-li si data nechat, nejdřív si je stáhni.</p>
      {needsReauth ? <>
        <p>Z bezpečnostních důvodů se nejdřív znovu přihlas. Pak se sem vrátíš a smazání potvrdíš.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <Button variant="secondary" size="compact" autoFocus disabled={Boolean(pending)} onClick={() => dialog.current?.close()}>Ponechat účet</Button>
          {reauthProviders.map((provider) => <Button key={provider} variant="secondary" size="compact" loading={pending === provider} disabled={Boolean(pending)} onClick={() => void reauthenticate(provider)}>Znovu se přihlásit přes {providerLabels[provider]}</Button>)}
        </div>
        {reauthProviders.length === 0 && <p className={styles.hint}>Odhlas se a znovu se přihlas, potom se sem vrať.</p>}
      </> : <form noValidate onSubmit={remove}>
        {hasPassword && <div className={styles.passwordField}><label htmlFor="delete-password">Heslo k účtu</label><input ref={passwordInput} id="delete-password" type="password" autoComplete="current-password" value={password} disabled={pending === "delete"} aria-invalid={error ? true : undefined} aria-describedby={error ? "delete-error" : undefined} onChange={(event) => { setPassword(event.target.value); setError(undefined); }} /></div>}
        {error && <p id="delete-error" className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <Button variant="secondary" size="compact" autoFocus disabled={pending === "delete"} onClick={() => dialog.current?.close()}>Ponechat účet</Button>
          <Button type="submit" variant="danger" size="compact" loading={pending === "delete"}>{pending === "delete" ? "Mažu účet…" : "Smazat účet natrvalo"}</Button>
        </div>
      </form>}
    </dialog>
  </>;
}
