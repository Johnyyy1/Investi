import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { AppLink as Link } from "@/components/shell/app-link";
import type { ProcessFeedback as Feedback, ProcessMetric, ProcessReason, ProcessStatus } from "@/features/portfolio/process";
import { money, percent } from "./lab-model";
import shared from "./portfolio-lab.module.css";
import styles from "./process-feedback.module.css";

const statuses: Record<ProcessStatus, string> = {
  information: "Informace", "within-plan": "V pásmu plánu", "outside-plan": "Mimo pásmo plánu", unavailable: "Nedostupné",
};
const reasons: Record<ProcessReason, string> = {
  "missing-valuation": "Chybí úplné ocenění. Chybějící ceny ani kurzy nenahrazujeme nulou.",
  "no-capital": "Podíly lze určit až s nenulovou hodnotou portfolia.",
  "no-holdings": "Zatím držíš jen hotovost. Koncentraci investic zatím nelze měřit.",
  "no-ips": "Nejdřív si ulož investiční plán (IPS). Bez něj nemáme tvůj cíl.",
  "legacy-ips": "Starší plán nemá strukturované cíle a pásmo. Aktualizuj ho v Můj plán.",
  "asset-class-target": "Plán používá třídy aktiv. Pro přesné porovnání vyber v IPS konkrétní instrumenty; složení ETF neodhadujeme.",
};
const date = (value: string) => new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric" }).format(new Date(value));
const points = (value: string | null) => value === null ? "Nedostupné" : `${percent(value).replace(/\s*%$/, "")} p. b.`;

export function ProcessFeedback({ feedback: f }: { feedback: Feedback }) {
  const headline = f.allocation.status === "outside-plan" || f.cash.status === "outside-plan"
    ? "Plán a portfolio se rozešly."
    : f.allocation.status === "within-plan" ? "Portfolio je v pásmu tvého plánu."
      : f.ipsVersion === null ? "Začni vlastním investičním plánem." : "Podívej se, jak se drží tvůj plán.";
  const band = f.allocation.threshold === null ? "Pásmo v IPS neurčeno" : `Pásmo IPS ± ${points(f.allocation.threshold)}`;
  return <section className={`${shared.card} ${styles.panel}`} aria-labelledby="process-title" data-testid="portfolio-process">
    <h2 id="process-title">Jak se drží tvůj plán</h2>
    <p className={styles.headline}>{headline}</p>
    <p className={styles.intro}>Žádný spěch k obchodu. I ponechat portfolio podle plánu je rozhodnutí.</p>
    <ul className={styles.rules} aria-label="Ukazatele procesu">
      <Rule id="hhi" label="Koncentrace pozic (HHI)" metric={f.hhi}
        value={f.hhi.value === null ? "Nedostupné" : new Intl.NumberFormat("cs-CZ").format(Number(f.hhi.value))}
        criterion="Práh v IPS neurčen"
        explanation="Jedna pozice v širokém ETF může zahrnovat mnoho firem. Samotné HHI pozic nehodnotí diverzifikaci uvnitř fondu."
        method="Součet druhých mocnin vah investovaných pozic × 10 000. Váhy počítáme jen z investic, bez hotovosti. Jedna pozice má HHI 10 000; dvě stejně velké 5 000. Univerzální ideální hranici nestanovujeme." />
      <Rule id="largest-position" label="Největší pozice" metric={f.largestPosition}
        value={f.largestPosition.value === null ? "Nedostupné" : `${f.largestPosition.symbol} · ${percent(f.largestPosition.value)}`}
        criterion="Limit pozice v IPS neurčen"
        explanation="Podíl na celém portfoliu včetně hotovosti. Velká váha fondu není totéž jako velká váha jediné firmy."
        method="Největší tržní hodnota jedné pozice dělená celkovou hodnotou portfolia. Nejde o průhled do podkladových firem ETF." />
      <Rule id="costs" label="Zaznamenané náklady" metric={f.costs} value={money(f.costs.value!)}
        criterion="Rozpočet nákladů v IPS neurčen"
        explanation={`Poplatky ${money(f.costs.feesMinor)} · přirážky za konverzi ${money(f.costs.fxMarkupMinor)}.`}
        method="Součet skutečně uložených poplatků a přirážek za konverzi u nákupů i prodejů ve sledovaném období. Konverze už je součástí ceny obchodu, podruhé ji neodečítáme. Staré obchody nepřepočítáváme. Nezahrnuje TER fondů, neznámý tržní spread ani daně; nejde o úplné náklady investování ani roční odhad." />
      <Rule id="turnover" label="Obrat obchodů" metric={f.turnover}
        value={f.turnover.value === null ? "Nedostupné" : percent(f.turnover.value)}
        criterion="Rozpočet obratu v IPS neurčen"
        explanation={`${f.turnover.tradeCount} obchodů · objem nákupů a prodejů ${money(f.turnover.grossMinor)}. Vyšší aktivita není úspěch.`}
        method="Objem nákupů plus prodejů v Kč, bez samostatných poplatků, dělený dnešní hodnotou portfolia včetně hotovosti. Obě strany obchodu se počítají, údaj může přesáhnout 100 %. Jde o popis aktivity, ne standardizovaný roční obrat vůči průměrné hodnotě. Při kratší historii nepřepočítáváme na rok; nové vklady mění jmenovatel, nejsou obchody." />
      <Rule id="allocation" label="Soulad s alokací IPS" metric={f.allocation}
        value={f.allocation.value === null ? "Nedostupné" : `Největší odchylka ${points(f.allocation.value)}`}
        criterion={band}
        explanation="Porovnáváme poslední uloženou verzi IPS, včetně hotovosti. Odchylka je podnět ke kontrole plánu, ne pokyn k obchodu."
        method="Maximum absolutních rozdílů aktuální a cílové váhy. Zahrnuje i cíle bez pozice a pozice mimo plán. Hranice pásma je ještě uvnitř; stav vychází z nezaokrouhlených hodnot. Pro kalendářní plán nebo příspěvky bez pásma ukazujeme jen informaci. Uvedené hodnoty zaokrouhlujeme na desetinu procentního bodu." />
      <Rule id="cash" label="Hotovost vůči plánu" metric={f.cash}
        value={f.cash.currentBasisPoints === null ? "Nedostupné" : percent(f.cash.currentBasisPoints)}
        criterion={f.cash.targetBasisPoints === null ? "Cíl v IPS neurčen" : `Cíl ${percent(f.cash.targetBasisPoints)} · ${band}`}
        explanation={f.cash.value === null ? "Bez cíle a úplného ocenění přebytek hotovosti neurčujeme." : `Nad cílem ${points(f.cash.value)}. Hotovost může mít v plánu své místo; přebytek není vypočtená ztráta výnosu.`}
        method="Podíl hotovosti na celku minus cílový podíl z IPS; přebytek je nejméně nula. Stav pásma kontroluje odchylku v obou směrech. Bez tvého pásma nestanovujeme hodnocení ani univerzální optimální rezervu." />
    </ul>
    <p className={styles.period}>Náklady a obrat: {date(f.period.startedAt)} – {date(f.period.endedAt)}, nejvýše 365 dní aktivního portfolia. Kratší historii nepřepočítáváme na rok.{f.ipsVersion === null ? "" : ` IPS verze ${f.ipsVersion}.`}</p>
    <Link className={shared.textLink} href="/lab/plan">{f.ipsVersion === null ? "Vytvořit nebo aktualizovat plán" : "Otevřít Můj plán"}</Link>
  </section>;
}

function Rule({ id, label, metric, value, criterion, explanation, method }: {
  id: string; label: string; metric: ProcessMetric; value: string; criterion: string; explanation: string; method: string;
}) {
  const Icon = metric.status === "within-plan" ? CircleCheck : metric.status === "outside-plan" ? TriangleAlert : Info;
  return <li className={styles.rule} data-testid={`process-${id}`} data-status={metric.status}>
    <div className={styles.ruleHead}><h3><Icon size={17} aria-hidden="true" />{label}</h3><span className={styles.status}>{statuses[metric.status]}</span></div>
    <p className={shared.num}>{value}</p>
    <p className={styles.criterion}>{criterion}</p>
    <p className={styles.explanation}>{metric.reason ? reasons[metric.reason] : explanation}</p>
    <details className={styles.method}><summary aria-label={`Jak se počítá: ${label}`}>Jak se to počítá</summary><p>{method}</p></details>
  </li>;
}
