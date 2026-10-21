"use client";

import { GuideImage } from "@/components/guide-image";
import { AppLink as Link } from "@/components/shell/app-link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Info, LogOut } from "lucide-react";
import { AccountSecurity } from "@/components/auth/account-security";
import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { LinkedAccountState } from "@/lib/auth-accounts";
import type { AuthProviderAvailability } from "@/lib/auth-providers";
import type { PersonalizedPreferences } from "@/features/personalization/profile";
import { sessionLabels } from "@/features/personalization/presentation";
import { SettingsPreferences } from "./settings-preferences";
import { PortfolioReset } from "./portfolio-reset";
import { AccountData } from "./account-data";
import { legalLinks } from "@/components/legal/legal-links";
import { displayNameSchema, settingsSections, type SettingsIdentity, type SettingsSection } from "./settings-model";
import styles from "./settings.module.css";

type Props = {
  section: SettingsSection | null; identity: SettingsIdentity; initialPreferences: PersonalizedPreferences;
  personalized: boolean; hasDiagnostic: boolean; providers: AuthProviderAvailability;
  initialAccounts: LinkedAccountState | null; initialError?: string;
  portfolioUnlocked: boolean; timeZone: string; earnedCapital: string;
  deletion: { hasPassword: boolean | null; fresh: boolean; reopen: boolean };
};

export function SettingsExperience(props: Props) {
  const { section, identity, initialPreferences } = props;
  const router = useRouter();
  const [preferenceDirty, setPreferenceDirty] = useState(false);
  const [preferenceEditing, setPreferenceEditing] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const signOutLock = useRef(false);
  const signOutDialog = useRef<HTMLDialogElement>(null);
  const signOutTrigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const lastSection = useRef(section);
  const dirty = preferenceDirty || nameDirty;
  const account = section === null || section === "account";
  const active = settingsSections.find((item) => item.id === section);
  useEffect(() => {
    if (lastSection.current !== section) { lastSection.current = section; heading.current?.focus(); }
  }, [section]);
  useEffect(() => { if (preferenceEditing && section === "goal") heading.current?.focus(); }, [preferenceEditing, section]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  async function signOut() {
    if (signOutLock.current) return;
    signOutLock.current = true; setSigningOut(true); setSignOutError(undefined);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("sign-out");
      signOutDialog.current?.close(); router.replace("/sign-in"); router.refresh();
    } catch { setSignOutError("Odhlášení se nezdařilo. Zkus to znovu."); setSigningOut(false); signOutLock.current = false; }
  }
  function requestSignOut(event: React.MouseEvent<HTMLButtonElement>) {
    signOutTrigger.current = event.currentTarget;
    if (dirty) signOutDialog.current?.showModal(); else void signOut();
  }
  const signOutButton = <button type="button" className={styles.navItem} onClick={requestSignOut} disabled={signingOut} aria-busy={signingOut || undefined}><LogOut size={18} aria-hidden="true" /><span>{signingOut ? "Odhlašuji…" : "Odhlásit se"}</span></button>;
  const retakeHref = props.personalized ? "/onboarding?retake=1" : "/onboarding?personalize=1";

  return <main className={styles.page} data-investi-settings data-section={section ?? "root"}>
    <div className={styles.layout}>
      <nav className={styles.sideNav} aria-label="Sekce nastavení">
        {["PROFIL", "NASTAVENÍ", "ÚČET"].map((group) => <div className={styles.navGroup} key={group}><p className={styles.groupLabel}>{group}</p>{settingsSections.filter((item) => item.group === group).map(({ id, label, icon: Icon }) => <Link key={id} href={`/settings?section=${id}`} className={styles.navItem} aria-current={id === (section ?? "account") ? "page" : undefined}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>)}</div>)}
        <div className={styles.navOther}>{signOutButton}{signOutError && <p role="alert" className={styles.error}>{signOutError}</p>}</div>
      </nav>

      <div className={styles.workspace}>
        <div className={styles.mobileRoot} hidden={section !== null}>
          <h1>Profil a nastavení</h1>
          <Link href="/settings?section=account" className={styles.profileLink}><span className={styles.avatar} aria-hidden="true">{identity.name.trim().charAt(0).toUpperCase() || "I"}</span><span><strong>{identity.name}</strong><small>{identity.demo ? "Soukromý cvičný profil · 24 hodin" : `${identity.completed} z ${identity.total} lekcí`}</small></span><ChevronRight size={18} aria-hidden="true" /></Link>
          {["PROFIL", "NASTAVENÍ", "ÚČET"].map((group) => <div className={styles.mobileGroup} key={group}><p className={styles.groupLabel}>{group}</p>{settingsSections.filter((item) => item.group === group && item.id !== "account").map(({ id, label, icon: Icon }) => <Link key={id} href={`/settings?section=${id}`} className={styles.listRow}><Icon size={20} aria-hidden="true" /><span>{label}</span>{id === "goal" ? <small>{sessionLabels[initialPreferences.preferredSessionMinutes]}</small> : id === "format" ? <small>Čeština · Kč</small> : null}<ChevronRight size={18} aria-hidden="true" /></Link>)}</div>)}
          <div className={styles.mobileGroup}>{signOutButton}{signOutError && <p role="alert" className={styles.error}>{signOutError}</p>}</div><p className={styles.hint}>Vzdělávání, ne investiční doporučení. {legalLinks.map((link, index) => <span key={link.href}>{index > 0 && " · "}<Link href={link.href} className={styles.inlineLink}>{link.label}</Link></span>)}</p>
        </div>

        <div className={section === null ? styles.defaultDetail : styles.detail}>
          <Link href="/settings" className={styles.back}><ArrowLeft size={18} aria-hidden="true" />Nastavení</Link>
          <header className={account ? styles.accountHeading : styles.heading}>
            <div><p className={styles.eyebrow}>{account || section === "goal" ? "PROFIL" : "NASTAVENÍ"}</p><h1 ref={heading} tabIndex={-1}>{section === "goal" && preferenceEditing ? "Změnit cíl nebo úroveň" : section === "security" ? "Přihlášení a zabezpe\u00adčení" : active?.label ?? "Účet"}</h1>{account && <p>Kdo jsi, čemu se chceš naučit a jak dlouhé lekce ti sedí.</p>}</div>
            {account && <GuideImage pose="17-reading-armchair" alt="" priority sizes="(max-width: 767px) 240px, 425px" className={styles.guide} />}
          </header>
          <div hidden={!account}><Identity identity={identity} accounts={props.initialAccounts} onDirtyChange={setNameDirty} />
            {identity.guest && <div className={styles.demoNote}><Info size={20} aria-hidden="true" /><div><h2>Pokrok zatím není uložený</h2><p>Učíš se jako host. Lekce a plán zůstanou jen v tomhle prohlížeči, dokud si nevytvoříš účet. <Link href="/onboarding/save">Uložit pokrok</Link></p></div></div>}
            {identity.demo && <div className={styles.demoNote}><Info size={20} aria-hidden="true" /><div><h2>Soukromý cvičný profil</h2><p>Demo používá samostatný účet a je dostupné 24 hodin. Cvičný kapitál není skutečné peníze. Tvůj postup je uložený u této demo identity.</p></div></div>}
          </div>
          <div className={account ? styles.overviewPreferences : undefined} hidden={!account && section !== "goal"}>
            <SettingsPreferences initialPreferences={initialPreferences} onDirtyChange={setPreferenceDirty} onEditingChange={(editing) => { setPreferenceEditing(editing); if (editing && section !== "goal") router.push("/settings?section=goal"); }} />
          </div>
          <section hidden={section !== "learning"} aria-labelledby="diagnostic-heading" className={styles.section}>
            <div className={styles.sectionHead}><h2 id="diagnostic-heading">Krátká diagnostika</h2><p>{props.hasDiagnostic ? "Tvoje odpovědi jsou uložené a pomáhají doporučit další krok." : "Diagnostiku zatím nemáš dokončenou."}</p></div>
            <div className={styles.card}><div className={styles.contentRow}><div><h3>{props.personalized ? "Zopakovat diagnostiku" : "Přizpůsobit učení"}</h3><p>Krátké otázky pomohou nastavit kontext učení. Postup v lekcích i cvičný kapitál ti zůstanou.</p></div><Link href={retakeHref} className={buttonVariants({ variant: "secondary", size: "compact" })}>{props.personalized ? "Zopakovat krátkou diagnostiku" : "Dokončit přizpůsobení"}<ArrowRight size={18} aria-hidden="true" /></Link></div></div>
            <div className={styles.sectionHead}><h2>Pokračuj vlastním tempem</h2><p>Hotové lekce si můžeš kdykoli zopakovat. Opakování nepřidává další odměnu.</p></div><Link href="/learn" className={styles.textLink}>Zpět na Učení<ArrowRight size={18} aria-hidden="true" /></Link>
          </section>
          <section hidden={section !== "format"} className={styles.section} aria-label="Jazyk a formát">
            <div className={styles.card}><dl className={styles.rows}><div><dt>Jazyk</dt><dd>Čeština</dd></div><div><dt>Formát čísel a dat</dt><dd>cs-CZ · 1 234,50 Kč</dd></div><div><dt>Časové pásmo učení</dt><dd>{props.timeZone}</dd></div><div><dt>Cvičný kapitál</dt><dd>CZK · česká koruna</dd></div></dl></div><p className={styles.hint}>Ceny nástrojů v Portfolio Lab uvádíme v původní měně. Hodnotu portfolia přepočítáváme do korun.</p>
          </section>
          <section hidden={section !== "portfolio"} className={styles.section} aria-labelledby="portfolio-settings-title"><div className={styles.sectionHead}><h2 id="portfolio-settings-title">Cvičné portfolio</h2><p>Učení v praxi s penězi, které nejsou skutečné.</p></div><PortfolioReset unlocked={props.portfolioUnlocked} earnedCapital={props.earnedCapital} /><Link className={styles.textLink} href="/lab/portfolio">Otevřít Portfolio Lab<ArrowRight size={18} aria-hidden="true" /></Link></section>
          <div hidden={section !== "data"}><AccountData active={section === "data"} saved={!identity.demo && !identity.guest} guest={Boolean(identity.guest)} hasPassword={props.deletion.hasPassword} fresh={props.deletion.fresh} reopenDeletion={props.deletion.reopen} accounts={props.initialAccounts} providers={props.providers} /></div>
          <div hidden={section !== "security"}><AccountSecurity providers={props.providers} initialError={props.initialError} initialAccounts={props.initialAccounts} email={identity.demo || identity.guest ? undefined : { address: identity.email, verified: identity.emailVerified }} /></div>
          {props.initialError && section !== "security" && <p role="alert" className={styles.error}>{props.initialError} <Link className={styles.textLink} href="/settings?section=security">Zkontrolovat přihlášení</Link></p>}
        </div>
      </div>
    </div>
    <footer className={styles.footer}><Link href="/learn" className={styles.wordmark} aria-label="investi · Učení">investi!</Link><p>Vzdělávání, ne investiční doporučení.</p><div><Link href="/">Jak to funguje</Link><Link href="/settings">Nastavení</Link>{legalLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div></footer>
    <dialog ref={signOutDialog} className={styles.dialog} aria-labelledby="unsaved-title" aria-describedby="unsaved-description" onCancel={(event) => { if (signingOut) event.preventDefault(); }} onClose={() => signOutTrigger.current?.focus()}><h2 id="unsaved-title">Máš neuložené změny</h2><p id="unsaved-description">Odhlášením ztratíš rozepsané změny nastavení. Už uložené předvolby, lekce a portfolio zůstanou.</p>{signOutError && <p role="alert" className={styles.error}>{signOutError}</p>}<div className={styles.actions}><Button variant="secondary" size="compact" disabled={signingOut} autoFocus onClick={() => signOutDialog.current?.close()}>Zůstat v nastavení</Button><Button loading={signingOut} onClick={() => void signOut()}>Odhlásit se</Button></div></dialog>
  </main>;
}

function Identity({ identity, accounts, onDirtyChange }: { identity: SettingsIdentity; accounts: LinkedAccountState | null; onDirtyChange: (dirty: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState(identity.name);
  const [savedName, setSavedName] = useState(identity.name);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { onDirtyChange(name !== savedName); }, [name, savedName, onDirtyChange]);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const methods = identity.demo ? "Anonymní demo" : identity.guest ? "Zatím bez účtu" : accounts ? [accounts.credential && "E-mail a heslo", accounts.google && "Google", accounts.facebook && "Facebook"].filter(Boolean).join(", ") || "Žádný připojený způsob" : "Údaje se nepodařilo načíst";
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) { setMessage({ ok: false, text: parsed.error.issues[0].message }); input.current?.focus(); return; }
    lock.current = true; setPending(true); setMessage(undefined);
    try {
      const result = await authClient.updateUser({ name: parsed.data });
      if (result.error) { setMessage({ ok: false, text: result.error.status === 401 ? "Relace skončila. Přihlas se znovu a ulož své jméno." : "Jméno se nepodařilo uložit. Zkus to znovu." }); return; }
      setSavedName(parsed.data); setName(parsed.data); setEditing(false); setMessage({ ok: true, text: "Jméno je uložené." }); router.refresh(); requestAnimationFrame(() => trigger.current?.focus());
    } catch { setMessage({ ok: false, text: "Jméno se nepodařilo uložit. Zkus to znovu. Zadané jméno zůstává zachované." }); }
    finally { lock.current = false; setPending(false); }
  }
  return <div className={styles.card}>
    <div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{savedName.trim().charAt(0).toUpperCase() || "I"}</span><div><h2>{savedName}</h2><p>Od {identity.since} · {identity.completed} z {identity.total} lekcí</p></div></div>
    <dl className={styles.rows}><div><dt>Jméno</dt><dd>{editing ? <form noValidate onSubmit={save} onReset={(event) => event.preventDefault()} className={styles.nameForm}><label htmlFor="display-name" className="sr-only">Jméno</label><input ref={input} id="display-name" autoComplete="name" value={name} disabled={pending} aria-invalid={message && !message.ok || undefined} aria-describedby={message && !message.ok ? "name-message" : "name-hint"} onChange={(event) => { setName(event.target.value); setMessage(undefined); }} /><p id="name-hint" className={styles.hint}>1–80 znaků. E-mail se nezmění.</p><div className={styles.actions}><Button type="submit" loading={pending}>{pending ? "Ukládám…" : "Uložit jméno"}</Button><Button variant="secondary" size="compact" disabled={pending} onClick={() => { setName(savedName); setEditing(false); setMessage(undefined); requestAnimationFrame(() => trigger.current?.focus()); }}>Zrušit</Button></div></form> : savedName}</dd>{!editing && <button ref={trigger} type="button" className={styles.textButton} onClick={() => { setEditing(true); setMessage(undefined); }}>Upravit</button>}</div>
      {!identity.demo && !identity.guest && <div><dt>E-mail</dt><dd><span>{identity.email}</span>{!identity.emailVerified && <small className={styles.unverified}>Neověřený</small>}</dd>{!identity.emailVerified && <Link href="/settings?section=security" className={styles.textButton}>Ověřit<span className="sr-only"> e-mail</span></Link>}</div>}
      <div><dt>Přihlášení</dt><dd>{methods}</dd><Link href="/settings?section=security" className={styles.textButton}>Změnit<span className="sr-only"> způsob přihlášení</span></Link></div>
    </dl>
    {message && <p id="name-message" className={message.ok ? styles.status : styles.error} role={message.ok ? "status" : "alert"}>{message.text}</p>}
  </div>;
}
