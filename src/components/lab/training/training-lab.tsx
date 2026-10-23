"use client";

import { useState, useTransition } from "react";
import { AppLink as Link } from "@/components/shell/app-link";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { actionLabels, decimalToMinor, monthLabel, percentText } from "@/features/ips/presentation";
import { formatCount } from "@/lib/formatters";
import type { PerformanceMetric } from "@/features/portfolio/performance";
import { recordTrainingAction, startTrainingAction } from "@/features/training/actions";
import type { TrainingView } from "@/features/training/presentation";
import { money, percent, quantity, signedMoney } from "../portfolio/lab-model";
import styles from "./training-lab.module.css";

type Scenario = { id: string; title: string; description: string; kind: "model" | "history" };
type Response = Awaited<ReturnType<typeof recordTrainingAction>>;

const indexText = (price: string) => Number(price).toLocaleString("cs-CZ", { maximumFractionDigits: 2 });
const metricText = (metric: PerformanceMetric) => metric.status === "available"
  ? `${percent(metric.annualizedBasisPoints ?? metric.basisPoints, { signed: true, digits: 2 })} ${metric.annualizedBasisPoints === null ? "za období" : "ročně"}`
  : "Nedostupné";

function sourceText(view: TrainingView) {
  const { source } = view;
  if (source.kind === "model") return "Modelový scénář: vymyšlená řada pro nácvik, ne předpověď ani historie.";
  return `${source.sample ? "Ukázková data" : "Historická data"} · ${source.sourceName} · ${source.symbol} (${source.instrumentName}) · cenový výnos bez dividend · index přepočtený na 100 na začátku, bez vlivu kurzu CZK/${source.currency}.`;
}

function planText(view: TrainingView) {
  const { plan } = view;
  const rebalancing = plan.rebalancing.mode === "band" ? `rebalancing při odchylce ${percentText(plan.rebalancing.bandBps)} p. b.`
    : plan.rebalancing.mode === "calendar" ? `rebalancing v měsíci ${monthLabel(plan.rebalancing.month)}` : "rebalancing novými příspěvky";
  return `Cíl ${percentText(plan.targetInvestedBps)} % v indexu · příspěvek ${money(plan.contributionMinor)} měsíčně · ${rebalancing} · při propadu: ${actionLabels[plan.drawdownAction].toLocaleLowerCase("cs-CZ")}.`;
}

export function TrainingLab({ initial, scenarios, planStatus }: { initial: TrainingView | null; scenarios: readonly Scenario[]; planStatus: "none" | "legacy" | "ready" }) {
  const [view, setView] = useState(initial);
  const [choosing, setChoosing] = useState(!initial);
  const [message, setMessage] = useState<{ kind: "error" | "status"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(call: () => Promise<Response>, success: string) {
    startTransition(async () => {
      const result = await call().catch((): Response => ({ ok: false, message: "Připojení selhalo. Zkus to znovu." }));
      if (result.view) setView(result.view);
      if (result.ok) setChoosing(false);
      setMessage(result.ok ? { kind: "status", text: success } : { kind: "error", text: result.message });
    });
  }

  return <main className={styles.page} data-save-state={pending ? "saving" : "idle"}>
    <header className={styles.header}>
      <Link href="/lab" className={styles.link}>Zpět do Labu</Link>
      <h1>Krizový nácvik</h1>
      <p>Projdi měsíc po měsíci propad trhu s tréninkovými penězi a vyzkoušej, jestli se držíš svého investičního plánu. Trénink nemění tvé portfolio ani cvičný kapitál.</p>
    </header>
    <p role="status" aria-live="polite" className={message?.kind === "status" ? styles.status : "sr-only"}>{message?.kind === "status" ? message.text : ""}</p>
    {message?.kind === "error" && <p role="alert" className={styles.error}>{message.text}</p>}
    {planStatus !== "ready" ? <NoPlan legacy={planStatus === "legacy"} />
      : choosing || !view ? <ScenarioPicker scenarios={scenarios} pending={pending} onCancel={view ? () => setChoosing(false) : undefined}
        onStart={(scenarioId) => run(() => startTrainingAction({ scenarioId, requestId: crypto.randomUUID() }), "Nácvik začal. Jsi v měsíci 0.")} />
      : <Session view={view} pending={pending} onNew={() => { setMessage(null); setChoosing(true); }}
        onAction={(action, success) => run(() => recordTrainingAction({ sessionId: view.sessionId, expectedMonth: view.month, clientIdempotencyKey: crypto.randomUUID(), action }), success)} />}
  </main>;
}

function NoPlan({ legacy }: { legacy: boolean }) {
  return <section className={styles.section} aria-labelledby="training-plan-heading">
    <h2 id="training-plan-heading" className={styles.title}>Nejdřív investiční plán</h2>
    <p>{legacy ? "Tvůj plán je ve starším formátu. Ulož jeho novou verzi, nácvik z ní převezme příspěvek, cílový podíl hotovosti a pravidla." : "Nácvik zkouší tvůj vlastní plán: měsíční příspěvek, cílový podíl hotovosti, rebalancing a pravidlo pro propad."}</p>
    <Link href="/lab/plan" className={styles.link}>Otevřít můj investiční plán</Link>
  </section>;
}

function ScenarioPicker({ scenarios, pending, onStart, onCancel }: { scenarios: readonly Scenario[]; pending: boolean; onStart: (id: string) => void; onCancel?: () => void }) {
  const [selected, setSelected] = useState(scenarios[0]?.id ?? "");
  return <form className={styles.section} onSubmit={(event) => { event.preventDefault(); onStart(selected); }}>
    <fieldset className={styles.fieldset}>
      <legend className={styles.title}>Vyber scénář</legend>
      <p className={styles.hint}>Začínáš se 100 000 Kč tréninkových peněz. Každý simulovaný měsíc přibude příspěvek z tvého plánu a náklady se počítají podle zvoleného ceníku brokera.</p>
      {scenarios.map((scenario) => <label key={scenario.id} className={styles.choice}>
        <input type="radio" name="scenario" value={scenario.id} checked={selected === scenario.id} onChange={() => setSelected(scenario.id)} />
        <span><strong>{scenario.title}</strong> <span className={styles.tag}>{scenario.kind === "model" ? "Modelový scénář" : "Historická řada"}</span><br />{scenario.description}</span>
      </label>)}
    </fieldset>
    <div className={styles.actions}>
      <Button type="submit" loading={pending} disabled={!selected}>Začít nácvik</Button>
      {onCancel && <Button variant="secondary" onClick={onCancel}>Zpět k nácviku</Button>}
    </div>
  </form>;
}

function Session({ view, pending, onAction, onNew }: { view: TrainingView; pending: boolean; onNew: () => void; onAction: (action: { kind: "buy"; amountMinor: string } | { kind: "sell"; quantity: string } | { kind: "advance" }, success: string) => void }) {
  const [amount, setAmount] = useState("");
  const [sellQuantity, setSellQuantity] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const current = view.points.at(-1)!;
  const change = Math.round((Number(current.price) / Number(view.points[0].price) - 1) * 10_000);
  function buy(amountMinor: string) {
    setInputError(null);
    onAction({ kind: "buy", amountMinor }, `Nakoupeno za ${money(amountMinor)}.`);
    setAmount("");
  }
  return <>
    <section className={styles.section} aria-labelledby="training-month-heading">
      <h2 id="training-month-heading" className={styles.title}>{view.scenario.title} · {view.monthLabel} <span className={styles.progress}>(měsíc {view.month} z {view.lastMonth})</span></h2>
      <p className={styles.hint}>{sourceText(view)}</p>
      <p className={styles.hint}>Tvůj plán (verze {view.plan.ipsVersion}): {planText(view)}</p>
      <figure className={styles.chart}>
        <figcaption>Index scénáře: {indexText(current.price)} ({percent(change, { signed: true, digits: 1 })} od začátku)</figcaption>
        <div className={styles.canvas} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={view.points.map((point) => ({ ...point, index: Number(point.price) }))} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" type="number" domain={[0, view.lastMonth]} tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis width={40} domain={["auto", "auto"]} tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
              <Line type="linear" dataKey="index" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <details className={styles.details}><summary>Zobrazit tabulku měsíců</summary>
          <div tabIndex={0} role="region" aria-label="Měsíce scénáře" className={styles.tableWrap}><table><thead><tr><th scope="col">Měsíc</th><th scope="col">Index</th><th scope="col">Hodnota portfolia</th></tr></thead>
            <tbody>{view.points.map((point) => <tr key={point.month}><th scope="row">{point.label}</th><td>{indexText(point.price)}</td><td>{money(point.valueMinor)}</td></tr>)}</tbody></table></div>
        </details>
      </figure>
      <dl className={styles.facts}>
        <div><dt>Hodnota tréninkového portfolia</dt><dd>{money(view.valueMinor)}</dd></div>
        <div><dt>Hotovost</dt><dd>{money(view.cashMinor)}</dd></div>
        <div><dt>Podíly indexu</dt><dd>{quantity(view.quantity)}</dd></div>
        <div><dt>Vloženo celkem</dt><dd>{money(view.contributedMinor)}</dd></div>
      </dl>
    </section>
    {view.finished ? <Evaluation view={view} onNew={onNew} /> : <section className={styles.section} aria-labelledby="training-actions-heading">
      <h2 id="training-actions-heading" className={styles.title}>Co uděláš v tomto měsíci?</h2>
      <p className={styles.hint}>Čekat a držet plán je platné rozhodnutí. Poplatky podle ceníku {view.feeProfileName}.</p>
      {inputError && <p role="alert" className={styles.error}>{inputError}</p>}
      <form className={styles.inline} onSubmit={(event) => {
        event.preventDefault();
        try { const minor = decimalToMinor(amount); if (minor === "0") throw new Error(); buy(minor); }
        catch { setInputError("Zadej částku v Kč, nejvýše se dvěma desetinnými místy."); }
      }}>
        <label className={styles.field}>Koupit za částku v Kč<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <Button type="submit" variant="secondary" loading={pending} disabled={!amount.trim()}>Koupit</Button>
        {view.maxBuyAmountMinor !== "0" && <Button variant="secondary" loading={pending} onClick={() => buy(view.maxBuyAmountMinor)}>Investovat hotovost ({money(view.maxBuyAmountMinor)})</Button>}
      </form>
      {view.quantity !== "0" && <form className={styles.inline} onSubmit={(event) => {
        event.preventDefault();
        if (!/^\d+([.,]\d{1,8})?$/.test(sellQuantity.trim())) { setInputError("Zadej množství s nejvýše 8 desetinnými místy."); return; }
        setInputError(null);
        onAction({ kind: "sell", quantity: sellQuantity.trim().replace(",", ".") }, "Prodej zaznamenán.");
        setSellQuantity("");
      }}>
        <label className={styles.field}>Prodat podíly (máš {quantity(view.quantity)})<input inputMode="decimal" value={sellQuantity} onChange={(event) => setSellQuantity(event.target.value)} /></label>
        <Button type="submit" variant="secondary" loading={pending} disabled={!sellQuantity.trim()}>Prodat</Button>
      </form>}
      <div className={styles.actions}>
        <Button loading={pending} onClick={() => onAction({ kind: "advance" }, view.month + 1 === view.lastMonth ? "Nácvik skončil. Níže je vyhodnocení." : `Měsíc ${view.month + 1}: přibyl příspěvek z plánu.`)}>
          {view.month + 1 === view.lastMonth ? "Dokončit poslední měsíc" : "Pokračovat na další měsíc"}
        </Button>
        <Button variant="ghost" onClick={onNew}>Začít jiný nácvik</Button>
      </div>
    </section>}
    {view.trades.length > 0 && <section className={styles.section} aria-labelledby="training-trades-heading">
      <h2 id="training-trades-heading" className={styles.title}>Tvoje obchody</h2>
      <ul className={styles.trades}>{view.trades.map((trade, index) => <li key={index}>
        <strong>{trade.side === "BUY" ? "Nákup" : "Prodej"}</strong> · {trade.label} · {quantity(trade.quantity)} podílů za {money(trade.grossMinor)} · poplatek {money(trade.feeMinor)}
        {trade.planStatus && <> · <span className={trade.planStatus === "outside-plan" ? styles.outside : styles.within}>{trade.planStatus === "outside-plan" ? "mimo pravidla plánu" : "podle pravidel plánu"}</span></>}
      </li>)}</ul>
    </section>}
  </>;
}

function Evaluation({ view, onNew }: { view: TrainingView; onNew: () => void }) {
  const result = view.evaluation!;
  const { plan } = view;
  return <section className={styles.section} aria-labelledby="training-result-heading">
    <h2 id="training-result-heading" className={styles.title}>Vyhodnocení podle tvého plánu</h2>
    <p className={styles.hint}>Hodnotíme postup, ne odhad vývoje trhu. Žádné skóre ani pořadí.</p>
    <dl className={styles.facts}>
      <div><dt>Prodeje mimo pravidla plánu</dt><dd>{result.sellsOutsidePlan === 0 ? "Žádné" : result.sellsOutsidePlan}</dd></div>
      <div><dt>Podíl v indexu na konci</dt><dd>{result.allocation.investedBps === null ? "Nedostupné" : `${percent(result.allocation.investedBps)} (cíl ${percentText(result.allocation.targetInvestedBps)} %)`}
        {result.allocation.status !== "information" && <> · {result.allocation.status === "within-plan" ? "v pásmu plánu" : "mimo pásmo plánu"}</>}</dd></div>
      <div><dt>Náklady (poplatky)</dt><dd>{money(result.feesMinor)} za {formatCount(result.tradeCount, ["obchod", "obchody", "obchodů"])}</dd></div>
      <div><dt>Obrat</dt><dd>{result.turnoverBps === null ? "Nedostupné" : `${percent(result.turnoverBps)} konečné hodnoty (${money(result.grossTradedMinor)} zobchodováno)`}</dd></div>
      <div><dt>Největší propad indexu</dt><dd>{percent(-Number(result.indexMaxDrawdownBps), { signed: true })}</dd></div>
      <div><dt>Časově vážený výnos (TWR)</dt><dd>{metricText(result.twr)}</dd></div>
      <div><dt>Peněžně vážený výnos (MWR)</dt><dd>{metricText(result.mwr)}</dd></div>
      <div><dt>Konečná hodnota / vloženo</dt><dd>{money(result.endingMinor)} / {money(result.contributedMinor)} ({signedMoney(result.gainMinor)})</dd></div>
    </dl>
    <details className={styles.details}><summary>Jak vyhodnocujeme</summary>
      <p>Prodej je podle pravidel jen tehdy, když vrací převáženou pozici k cíli: {plan.rebalancing.mode === "band" ? `podíl v indexu byl před prodejem nad cílem o víc než ${percentText(plan.rebalancing.bandBps)} p. b.` : plan.rebalancing.mode === "calendar" ? `v měsíci rebalancingu (${monthLabel(plan.rebalancing.month)}) a nad cílem${view.source.kind === "model" ? "; modelový kalendář začíná lednem" : ""}` : "tvůj plán vyrovnává váhy novými příspěvky, takže každý prodej je mimo pravidla"}. TWR měří výnos indexu a tvých rozhodnutí bez vlivu načasování příspěvků, MWR zahrnuje i načasování peněz; rozdíl sám o sobě není důkaz chyby. Obrat je zobchodovaný objem vůči konečné hodnotě. Dividendy, daně a úroky z hotovosti nejsou zahrnuté.</p>
    </details>
    <div className={styles.actions}><Button onClick={onNew}>Začít nový nácvik</Button><Link href="/lab/plan" className={styles.link}>Upravit investiční plán</Link></div>
  </section>;
}
