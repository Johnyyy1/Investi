import type { ArtifactPayload } from "@/features/artifacts/schemas";
import { actionLabels, assetLabels, debtLabels, frequencyLabels, ipsDate, monthLabel, percentText, priorityLabels, purposeLabels, reserveLabels } from "@/features/ips/presentation";
import { scaledToDecimal } from "@/features/portfolio/decimal";
import styles from "./ips-builder.module.css";

export function IpsSummary({ plan }: { plan: ArtifactPayload<"investment_plan"> }) {
  const goals = <><dt>Cíle a horizont</dt><dd><ul>{plan.goals.map((goal, index) => <li key={index}>{goal.label} · {purposeLabels[goal.purpose]} · {goal.horizonMonths} měsíců · {priorityLabels[goal.priority]}</li>)}</ul></dd></>;
  if (!("schemaVersion" in plan)) return <dl className={styles.snapshot}>{goals}<dt>Horizont původního plánu</dt><dd>{plan.horizonMonths} měsíců</dd><dt>Alokace</dt><dd>{plan.allocation.map((line) => `${line.assetClass === "cash" ? "Hotovost" : assetLabels[line.assetClass]} ${percentText(line.weightBasisPoints)} %`).join(" · ")}</dd><dt>Kontrola</dt><dd>{frequencyLabels[plan.reviewFrequency]}</dd><dt>Rebalancing</dt><dd>{plan.rebalanceRule}</dd><dt>Pravidlo propadu</dt><dd>{plan.crisisPlan}</dd></dl>;
  return <dl className={styles.snapshot}>{goals}
    <dt>Finanční základ</dt><dd>{reserveLabels[plan.foundation.emergencyFund]} · {debtLabels[plan.foundation.highCostDebt]}</dd>
    <dt>Alokace</dt><dd><ul>{plan.allocation.lines.map((line, index) => <li key={index}>{"instrumentId" in line ? line.instrumentId : assetLabels[line.assetClass]} · {percentText(line.weightBps)} %</li>)}<li>Hotovost · {percentText(plan.allocation.cashBps)} %</li></ul></dd>
    <dt>Nástroje a platforma</dt><dd>{plan.instruments.join("\n")} · {plan.platform}</dd>
    <dt>Pravidelný příspěvek</dt><dd>{scaledToDecimal(BigInt(plan.contribution.amountMinor), 2).replace(".", ",")} Kč · den {plan.contribution.dayOfMonth} v měsíci</dd>
    <dt>Rebalancing</dt><dd>{plan.rebalancing.mode === "calendar" ? `Kalendářně · ${monthLabel(plan.rebalancing.month)}` : plan.rebalancing.mode === "band" ? `Při odchylce ${percentText(plan.rebalancing.bandBps)} procentního bodu` : "Novými příspěvky"}</dd>
    <dt>Pravidlo propadu</dt><dd>{actionLabels[plan.drawdownRule.action]} · {plan.drawdownRule.text}</dd>
    <dt>Kontrola a přezkum</dt><dd>{frequencyLabels[plan.checkFrequency]} · přezkum: {monthLabel(plan.reviewMonth)}</dd>
    <dt>Zdůvodnění této verze</dt><dd>{plan.changeReason}</dd><dt>Potvrzení plánu</dt><dd>{ipsDate(plan.signedAt)} (čas uvedený při potvrzení)</dd>
  </dl>;
}
