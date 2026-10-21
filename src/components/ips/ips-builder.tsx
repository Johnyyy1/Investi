"use client";
import { cloneElement, useEffect, useId, useRef, useState, useTransition, type ReactElement } from "react";
import { z } from "zod";
import { Button, ButtonLink } from "@/components/ui/button";
import { InstrumentSearch } from "@/components/lab/portfolio/instrument-search";
import { deleteArtifact, saveArtifact } from "@/features/artifacts/actions";
import { artifactConsentText } from "@/features/artifacts/presentation";
import type { LearnerArtifact } from "@/features/artifacts/schemas";
import { applyIpsTargetAction, searchIpsInstrumentsAction } from "@/features/ips/actions";
import { actionLabels, assetLabels, debtLabels, decimalToBps, draftFromPlan, frequencyLabels, ipsDate, monthLabel, newIpsDraft, percentText, planFromDraft, priorityLabels, purposeLabels, reserveLabels, type IpsDraft } from "@/features/ips/presentation";
import type { IpsPlan } from "@/features/ips/schema";
import { IpsSummary } from "./ips-summary";
import styles from "./ips-builder.module.css";

type PlanArtifact = Extract<LearnerArtifact, { kind: "investment_plan" }>;
function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) { const id = useId(); return <div className={styles.field}><label htmlFor={id}>{label}</label>{cloneElement(children, { id })}</div>; }
function Options({ values }: { values: Record<string, string> }) { return Object.entries(values).map(([value, label]) => <option key={value} value={value}>{label}</option>); }
function Months() { return <><option value="">Vyber měsíc</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{monthLabel(i + 1)}</option>)}</>; }
const validationLabels: Record<string, string> = { goals: "Cíle a horizont", foundation: "Finanční základ", allocation: "Alokace", instruments: "Nástroje", platform: "Platforma", contribution: "Příspěvek (částka a den 1–28)", rebalancing: "Rebalancing (měsíc nebo kladné pásmo)", drawdownRule: "Pravidlo propadu", checkFrequency: "Kontrola", reviewMonth: "Měsíc přezkumu", changeReason: "Zdůvodnění verze" };
function validationMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return `${validationLabels[String(issue.path[0])] ?? "Plán"}: ${issue.code === "custom" || issue.code === "too_small" && typeof issue.minimum === "number" && issue.minimum === 1 && issue.origin === "string" ? issue.message : "Doplň platnou hodnotu v této části."}`;
  }
  return error instanceof Error ? error.message : "Zkontroluj plán.";
}

export function IpsBuilder({ history, goals, portfolioId, sample }: { history: PlanArtifact[]; goals?: IpsPlan["goals"]; portfolioId: string | null; sample: boolean }) {
  const [versions, setVersions] = useState(history);
  const current = versions[0];
  const [draft, setDraft] = useState<IpsDraft>(() => current ? draftFromPlan(current.payload) : newIpsDraft(goals));
  const [consent, setConsent] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lock = useRef(false);
  const saveRequest = useRef<{ fingerprint: string; id: string; plan: IpsPlan } | null>(null);
  const applyRequest = useRef<{ artifactId: string; portfolioId: string; requestId: string } | null>(null);
  useEffect(() => { if (message && !message.ok) errorRef.current?.focus(); }, [message]);
  function update(patch: Partial<IpsDraft>) { if (lock.current) return; setDraft((old) => ({ ...old, ...patch, ...(!dirty && current && !("reason" in patch) ? { reason: "" } : {}) })); setDirty(true); setMessage(null); }
  function cancelDelete() { if (lock.current) return; setConfirmDelete(false); deleteRef.current?.focus(); }
  function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setMessage(null);
    start(async () => { try { await task(); } catch { setMessage({ ok: false, text: "Připojení se nepodařilo. Plán zůstává na této stránce. Zkus to znovu." }); } finally { lock.current = false; } });
  }
  function save() {
    if (!consent) return;
    run(async () => {
      const fingerprint = JSON.stringify(draft);
      if (saveRequest.current?.fingerprint !== fingerprint) {
        try { saveRequest.current = { fingerprint, id: crypto.randomUUID(), plan: planFromDraft(draft, new Date().toISOString()) }; }
        catch (error) { setMessage({ ok: false, text: validationMessage(error) }); return; }
      }
      const request = saveRequest.current!;
      const result = await saveArtifact({ content: { kind: "investment_plan", payload: request.plan }, sourceLessonId: null, consent: true, requestId: request.id });
      if (!result.ok) { setMessage({ ok: false, text: result.message }); return; }
      const artifact = result.artifact as PlanArtifact;
      setVersions((old) => [artifact, ...old.filter((version) => version.id !== artifact.id)]);
      setDirty(false); setMessage({ ok: true, text: `Plán je uložený. Verze ${artifact.version}.` });
    });
  }
  function apply() {
    if (!current || !portfolioId || dirty) return;
    run(async () => {
      if (applyRequest.current?.artifactId !== current.id || applyRequest.current.portfolioId !== portfolioId) applyRequest.current = { artifactId: current.id, portfolioId, requestId: crypto.randomUUID() };
      const result = await applyIpsTargetAction(applyRequest.current);
      setMessage({ ok: result.ok, text: result.ok ? "Alokace je uložená jako cílový mix. Žádný obchod se neprovedl." : result.message });
    });
  }
  function remove() {
    if (!current) return;
    run(async () => {
      const result = await deleteArtifact({ id: current.id });
      if (!result.ok) { setMessage({ ok: false, text: result.message }); return; }
      setVersions([]); setDraft(newIpsDraft(goals)); setDirty(false); setConsent(false); setConfirmDelete(false); saveRequest.current = null; applyRequest.current = null;
      setMessage({ ok: true, text: "Plán a všechny jeho verze jsou smazané. Uložené cílové mixy a obchody zůstávají v historii Labu." });
      requestAnimationFrame(() => headingRef.current?.focus());
    });
  }
  let total: string;
  try { total = `${percentText(draft.lines.reduce((sum, line) => sum + decimalToBps(line.weight), decimalToBps(draft.cash)))} % ze 100 %`; }
  catch { total = "Doplň všechny váhy včetně hotovosti. Celkem mají dát 100 %."; }
  const instrumentMode = draft.lines.some((line) => line.type === "instrument");
  const classMode = draft.lines.some((line) => line.type !== "instrument");

  return <main className={styles.page}>
    <header className={styles.header}>
      <a className={styles.link} href="/lab">Zpět do Labu</a>
      <h1 ref={headingRef} tabIndex={-1}>Můj investiční plán</h1>
      <p>Sepiš si cíle a pravidla pro klidné i náročné období. IPS je tvoje vlastní rozhodnutí. investi nenavrhuje doporučené portfolio.</p>
      <p className={styles.hint}>Do uložení zůstává koncept jen na této stránce. Nezadávej čísla účtů ani citlivé podrobnosti.</p>
      {current && !("schemaVersion" in current.payload) && <p className={styles.hint}>Máš uložený původní plán. Doplň nová pole; uložením vznikne další verze a původní zůstane v historii.</p>}
    </header>
    <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); save(); }}>
      <fieldset className={styles.section} disabled={pending} aria-label="Investiční plán">
        <fieldset className={styles.section}><legend>Cíle a horizont</legend>
          {goals && !current && <p className={styles.hint}>Cíle jsou převzaté z tvé uložené mapy. Můžeš je upravit.</p>}
          {draft.goals.map((goal, index) => <div className={styles.entry} key={index}>
            <h3>Cíl {index + 1}</h3>
            <Field label={`Název cíle ${index + 1}`}><input maxLength={160} value={goal.label} onChange={(e) => update({ goals: draft.goals.map((g, i) => i === index ? { ...g, label: e.target.value } : g) })} /></Field>
            <div className={styles.row}><Field label={`Účel cíle ${index + 1}`}><select value={goal.purpose} onChange={(e) => update({ goals: draft.goals.map((g, i) => i === index ? { ...g, purpose: e.target.value as typeof goal.purpose } : g) })}><Options values={purposeLabels} /></select></Field>
              <Field label={`Horizont cíle ${index + 1} v měsících`}><input type="number" min={1} max={1200} value={goal.horizonMonths || ""} onChange={(e) => update({ goals: draft.goals.map((g, i) => i === index ? { ...g, horizonMonths: Number(e.target.value) } : g) })} /></Field></div>
            <Field label={`Priorita cíle ${index + 1}`}><select value={goal.priority} onChange={(e) => update({ goals: draft.goals.map((g, i) => i === index ? { ...g, priority: e.target.value as typeof goal.priority } : g) })}><Options values={priorityLabels} /></select></Field>
            {draft.goals.length > 1 && <Button variant="ghost" size="compact" onClick={() => update({ goals: draft.goals.filter((_, i) => i !== index) })}>Odebrat cíl {index + 1}</Button>}
          </div>)}
          <Button variant="secondary" size="compact" disabled={draft.goals.length >= 10} onClick={() => update({ goals: [...draft.goals, { label: "", purpose: "other", horizonMonths: 0, priority: "important" }] })}>Přidat cíl</Button>
        </fieldset>
        <fieldset className={styles.section}><legend>Finanční základ</legend><p className={styles.hint}>Stačí stav. Výši příjmů, dluhu ani rezervy neukládáme.</p><div className={styles.row}>
          <Field label="Pohotovostní rezerva"><select value={draft.foundation.emergencyFund} onChange={(e) => update({ foundation: { ...draft.foundation, emergencyFund: e.target.value as IpsPlan["foundation"]["emergencyFund"] } })}><Options values={reserveLabels} /></select></Field>
          <Field label="Drahý dluh"><select value={draft.foundation.highCostDebt} onChange={(e) => update({ foundation: { ...draft.foundation, highCostDebt: e.target.value as IpsPlan["foundation"]["highCostDebt"] } })}><Options values={debtLabels} /></select></Field></div>
        </fieldset>
        <fieldset className={styles.section}><legend>Moje cílová alokace</legend>
          <p className={styles.hint}>Zvol vlastní váhy tříd aktiv, nebo konkrétní instrumenty. Pro přenos do Labu potřebuješ instrumenty. Hotovost je součástí cíle; nemusíš ji utratit.</p>
          {draft.lines.map((line, index) => <div className={styles.entry} key={`${index}-${line.instrumentId}`}>
            {line.type === "instrument" ? <h3>{line.label || line.instrumentId}</h3> : <Field label={`Třída aktiv ${index + 1}`}><select value={line.type} onChange={(e) => update({ lines: draft.lines.map((l, i) => i === index ? { ...l, type: e.target.value as "equity" | "bonds" | "other" } : l) })}><Options values={assetLabels} /></select></Field>}
            <Field label={`Váha položky ${index + 1} v %`}><input inputMode="decimal" value={line.weight} onChange={(e) => update({ lines: draft.lines.map((l, i) => i === index ? { ...l, weight: e.target.value } : l) })} /></Field>
            <Button variant="ghost" size="compact" onClick={() => update({ lines: draft.lines.filter((_, i) => i !== index) })}>Odebrat položku {index + 1}</Button>
          </div>)}
          {!instrumentMode && <div className={styles.actions}><Button variant="secondary" size="compact" disabled={draft.lines.length >= 3} onClick={() => update({ lines: [...draft.lines, { type: (["equity", "bonds", "other"] as const).find((type) => !draft.lines.some((line) => line.type === type)) ?? "other", instrumentId: "", label: "", weight: "" }] })}>Přidat třídu aktiv</Button></div>}
          {!classMode && draft.lines.length < 12 && <div className={styles.entry}><InstrumentSearch id="ips-instrument" label="Přidat konkrétní instrument" sample={sample} searchAction={searchIpsInstrumentsAction}
            target={{ href: () => "", hint: "Vyhledej název nebo ticker. Výběrem přidáš nástroj do plánu bez nákupu.", opening: "Přidávám nástroj…" }}
            onSelect={(result) => { if (!draft.lines.some((line) => line.instrumentId === result.instrumentId)) update({ lines: [...draft.lines, { type: "instrument", instrumentId: result.instrumentId, label: `${result.symbol} · ${result.name}`, weight: "" }] }); }} /></div>}
          <Field label="Cílová hotovost v %"><input inputMode="decimal" value={draft.cash} onChange={(e) => update({ cash: e.target.value })} /></Field><p className={styles.total} aria-live="polite">{total}</p>
        </fieldset>
        <fieldset className={styles.section}><legend>Nástroje a platforma</legend><div className={styles.fields}>
          <Field label="Zvolené nástroje a proč (jeden na řádek)"><textarea maxLength={3200} value={draft.instruments} onChange={(e) => update({ instruments: e.target.value })} /></Field>
          <Field label="Zvolená platforma nebo co ještě ověřím"><input maxLength={160} value={draft.platform} onChange={(e) => update({ platform: e.target.value })} /></Field></div>
        </fieldset>
        <fieldset className={styles.section}><legend>Pravidelný příspěvek</legend><p className={styles.hint}>Plánovaná vlastní částka v Kč, nikoli pokyn ani vklad do Labu. Nula je platná. Den 1–28 existuje v každém měsíci.</p><div className={styles.row}>
          <Field label="Měsíční částka v Kč"><input inputMode="decimal" value={draft.amount} onChange={(e) => update({ amount: e.target.value })} /></Field>
          <Field label="Den v měsíci (1–28)"><input type="number" min={1} max={28} value={draft.day} onChange={(e) => update({ day: e.target.value })} /></Field></div>
        </fieldset>
        <fieldset className={styles.section}><legend>Pravidla údržby a propadu</legend><div className={styles.fields}>
          <Field label="Způsob rebalancingu"><select value={draft.mode} onChange={(e) => update({ mode: e.target.value as IpsDraft["mode"] })}><Options values={{ contributions: "Novými příspěvky", calendar: "V určeném měsíci", band: "Při odchylce od cíle" }} /></select></Field>
          {draft.mode === "calendar" && <Field label="Měsíc rebalancingu"><select value={draft.rebalanceMonth} onChange={(e) => update({ rebalanceMonth: e.target.value })}><Months /></select></Field>}
          {draft.mode === "band" && <Field label="Pásmo odchylky v procentních bodech"><input inputMode="decimal" value={draft.band} onChange={(e) => update({ band: e.target.value })} /></Field>}
          <Field label="Akce při propadu"><select value={draft.action} onChange={(e) => update({ action: e.target.value as IpsDraft["action"] })}><Options values={actionLabels} /></select></Field>
          <Field label="Co při propadu udělám a co si ověřím"><textarea maxLength={2000} value={draft.drawdown} onChange={(e) => update({ drawdown: e.target.value })} /></Field>
          <div className={styles.row}><Field label="Jak často portfolio zkontroluji"><select value={draft.frequency} onChange={(e) => update({ frequency: e.target.value as IpsDraft["frequency"] })}><Options values={frequencyLabels} /></select></Field>
            <Field label="Měsíc přezkumu celého plánu"><select value={draft.reviewMonth} onChange={(e) => update({ reviewMonth: e.target.value })}><Months /></select></Field></div></div>
        </fieldset>
        <fieldset className={styles.section}><legend>Potvrzení verze</legend><div className={styles.fields}>
          <Field label="Proč tento plán ukládám nebo měním"><textarea maxLength={2000} value={draft.reason} onChange={(e) => update({ reason: e.target.value })} /></Field>
          <div className={styles.save}><label className={styles.consent}><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>Potvrzuji tento plán. {artifactConsentText}</span></label>
            <div className={styles.actions}><Button type="submit" disabled={!consent} loading={pending}>Uložit verzi plánu</Button></div></div></div>
        </fieldset>
      </fieldset>
    </form>
    {message && <p ref={errorRef} tabIndex={-1} role={message.ok ? "status" : "alert"} className={message.ok ? styles.status : styles.error}>{message.text}</p>}
    {current && <section className={styles.saved} aria-labelledby="saved-plan-title"><h2 id="saved-plan-title" className={styles.title}>Uložený plán · verze {current.version}</h2>
      <p>Uloženo {ipsDate(current.createdAt)}. Cílový mix je záměr; jeho převzetí neprovádí nákupy, prodeje ani příspěvky.</p>
      {dirty && <p className={styles.hint}>Máš neuložené změny. Před převzetím alokace ulož novou verzi.</p>}
      <div className={styles.actions}>{portfolioId ? <Button variant="secondary" loading={pending} disabled={dirty || !("schemaVersion" in current.payload)} onClick={apply}>Použít alokaci IPS jako cílový mix</Button> : <ButtonLink href="/lab/portfolio" variant="secondary">Otevřít Portfolio Lab</ButtonLink>}
        <a className={styles.link} href="/api/ips/export" download>Exportovat všechny verze (JSON)</a></div>
      <p className={styles.hint}>Třídy aktiv a samotná hotovost zůstávají platným plánem. Pro cílový mix v Labu zvol konkrétní instrumenty. Plán lze sepsat i před odemčením Labu.</p>
      <div className={styles.history}><h3 className={styles.title}>Historie verzí</h3>{versions.map((version) => <details key={version.id}><summary>Verze {version.version} · {ipsDate(version.createdAt)} · {"schemaVersion" in version.payload ? version.payload.changeReason : "Původní plán"}</summary><IpsSummary plan={version.payload} /></details>)}</div>
      <div className={styles.actions}><Button ref={deleteRef} variant="dangerQuiet" disabled={pending} onClick={() => setConfirmDelete(true)}>Smazat plán</Button></div>
      {confirmDelete && <div className={styles.confirm} onKeyDown={(e) => { if (e.key === "Escape") cancelDelete(); }}><p>Smazat plán a všechny jeho verze? V historii Labu zůstanou dříve uložené cílové mixy i obchody.</p><div className={styles.actions}><Button autoFocus variant="secondary" disabled={pending} onClick={cancelDelete}>Ponechat plán</Button><Button variant="danger" loading={pending} onClick={remove}>Smazat všechny verze plánu</Button></div></div>}
    </section>}
  </main>;
}
