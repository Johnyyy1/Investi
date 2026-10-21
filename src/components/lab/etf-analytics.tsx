import { CircleHelp } from "lucide-react";
import type { Currency } from "@/features/market-data/contracts";
import type { EtfAllocation, EtfAnalyticsSnapshot, EtfDataset, EtfHolding } from "@/features/market-data/etf-analytics";
import { etfConcentration, formatEtfPercent, sortedHoldings } from "@/features/instruments/etf-presentation";

function magnitude(value: number | null, currency: Currency | null) {
  if (value === null) return "—";
  const scale = value >= 1e12 ? [1e12, "T"] as const : value >= 1e9 ? [1e9, "B"] as const : value >= 1e6 ? [1e6, "M"] as const : [1, ""] as const;
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(value / scale[0])}${scale[1]} ${currency ?? "· měna neuvedena"}`;
}
function money(value: number | null, currency: Currency | null) {
  return value === null || currency === null ? "—" : `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

const allocationLabels: Readonly<Record<string, string>> = {
  technology: "Technologie",
  financials: "Finance",
  health_care: "Zdravotnictví",
  consumer_discretionary: "Zbytná spotřeba",
  consumer_staples: "Nezbytná spotřeba",
  communication_services: "Komunikační služby",
  industrials: "Průmysl",
  energy: "Energetika",
  materials: "Materiály",
  utilities: "Veřejné služby",
  real_estate: "Nemovitosti",
  Technology: "Technologie",
  Financials: "Finance",
  Industrials: "Průmysl",
  Healthcare: "Zdravotnictví",
  "Consumer goods": "Spotřební zboží",
  Communication: "Komunikace",
  Energy: "Energetika",
  Materials: "Materiály",
  Utilities: "Veřejné služby",
  "Real estate": "Nemovitosti",
  "United States": "Spojené státy",
  Japan: "Japonsko",
  "United Kingdom": "Spojené království",
  China: "Čína",
  Canada: "Kanada",
  France: "Francie",
  Germany: "Německo",
  Switzerland: "Švýcarsko",
  India: "Indie",
  Taiwan: "Tchaj-wan",
  Netherlands: "Nizozemsko",
  Argentina: "Argentina",
  Australia: "Austrálie",
  "South Korea": "Jižní Korea",
  "Hong Kong": "Hongkong",
  Ireland: "Irsko",
};

function allocationLabel(value: string) {
  return allocationLabels[value] ?? value;
}
function metric(label: string, value: string, explanation: string, sourceDate?: string | null) {
  return <div key={label} className="min-w-0 py-2"><dt className="min-w-0 break-words text-small text-secondary">{label} <details className="inline-block align-middle"><summary aria-label={`Více o položce ${label}`} className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-sm text-primary-hover focus-visible:outline-2 focus-visible:outline-primary"><CircleHelp aria-hidden="true" className="size-4" /></summary><p className="mt-1 max-w-[24rem] break-words text-microcopy leading-relaxed text-secondary">{explanation}</p></details></dt><dd className="mt-1 break-words text-card-title font-bold tabular-nums">{value}</dd>{sourceDate !== undefined ? <dd className="mt-1 text-microcopy text-secondary">{sourceDate ? `Údaj k ${formatDate(sourceDate)}` : "Datum údaje neuvedeno"}</dd> : null}</div>;
}
function unavailable() { return <p role="status" className="mt-4 text-small text-secondary">Data této části teď nejsou dostupná. Zkus stránku načíst později.</p>; }
function formatDate(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
function coveragePercent(value: number | null) {
  return formatEtfPercent(value, value !== null && value > 0 && value < 0.0001 ? 4 : 2);
}
function freshness<T>(dataset: EtfDataset<T>, now: Date, holdings = false, mixedDates = false) {
  const age = dataset.asOf ? Math.floor((now.getTime() - Date.parse(dataset.asOf)) / 86_400_000) : null;
  return <div className="mt-3 space-y-1 text-microcopy text-secondary">
    <p>{dataset.isDeterministic ? "Ukázková data" : "Poslední dostupná data"}{mixedDates ? " · Data metrik mají vlastní datum" : dataset.asOf ? ` · ${holdings ? "Stav složení k" : "Stav dat k"} ${formatDate(dataset.asOf)}` : " · Datum zdroje nebylo uvedeno"}{dataset.completeness === "partial" ? " · Neúplná data" : ""}</p>
    {!dataset.isDeterministic ? <p>Načteno {formatDate(dataset.retrievedAt)}{holdings && age !== null && age >= 90 ? ` · Složení je staré ${age.toLocaleString("cs-CZ")} dní a může se lišit od dnešního.` : ""}</p> : null}
    {holdings && dataset.sourceKind === "regulatory-filing" ? <p>Snímek z regulatorního hlášení; zveřejnění může mít několikaměsíční zpoždění.</p> : null}
    {dataset.coverage ? <p>Zachycené zastoupení: {coveragePercent(dataset.coverage.knownWeight)}{dataset.coverage.unclassifiedWeight !== null ? ` · Bez zařazení: ${coveragePercent(dataset.coverage.unclassifiedWeight)}` : ""}. {dataset.coverage.classificationCoverage != null ? `Pokrytí klasifikace podle zdroje: ${coveragePercent(dataset.coverage.classificationCoverage)}. ` : ""}{dataset.coverage.inferred ? "Zařazení je odvozené a nemusí pokrývat celý fond. " : ""}{dataset.completeness === "partial" ? "Váhy nejsou přepočítané na 100 %." : ""}</p> : null}
  </div>;
}
function attribution(snapshot: EtfAnalyticsSnapshot | null) {
  const source = [snapshot?.holdings, snapshot?.info, snapshot?.sectors, snapshot?.countries].find((dataset) => dataset?.source)?.source;
  if (!source) return null;
  let safeUrl: string | null = null;
  try { const url = new URL(source.url); if (url.protocol === "https:" && !url.username && !url.password) safeUrl = url.href; } catch { /* Invalid links stay plain text. */ }
  return <footer className="min-w-0 border-t border-border pt-4 text-microcopy text-secondary">
    <p>Zdroj ETF dat: {safeUrl ? <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">{source.name}</a> : source.name} · {source.license}</p>
    {source.citation ? <details className="[overflow-wrap:anywhere]"><summary className="flex min-h-11 cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-primary">Podrobnosti zdroje</summary><p>{source.citation}</p></details> : null}
  </footer>;
}
function WeightBar({ weight, max }: { weight: number; max: number }) {
  return <div aria-hidden="true" className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary/75" style={{ width: `${Math.min(100, max > 0 ? weight / max * 100 : 0)}%` }} /></div>;
}
function exposure(title: string, id: string, explanation: string, dataset: EtfDataset<readonly EtfAllocation[]> | null, now: Date) {
  const rows = dataset ? [...dataset.value].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name)) : [];
  const max = rows[0]?.weight ?? 0;
  return <section aria-labelledby={id} className="min-w-0 border-t border-border pt-6"><h3 id={id} className="text-card-title font-bold">{title}</h3><p className="mt-1 text-small text-secondary">{explanation}</p>{rows.length ? <ul className="mt-4 divide-y divide-border/70">{rows.map((row) => <li key={row.name} className="min-w-0 py-2.5"><div className="flex min-w-0 items-baseline justify-between gap-3 text-small"><span className="min-w-0 break-words font-semibold">{allocationLabel(row.name)}</span><span className="shrink-0 tabular-nums">{formatEtfPercent(row.weight)}</span></div><WeightBar weight={row.weight} max={max} /></li>)}</ul> : unavailable()}{dataset ? freshness(dataset, now, true) : null}</section>;
}
function topHoldings(dataset: EtfAnalyticsSnapshot["holdings"], reportedTotal: number | null, now: Date) {
  const all = dataset ? sortedHoldings(dataset.value.rows) : [];
  const rows = all.slice(0, 10);
  const max = rows[0]?.weight ?? 0;
  const concentration = dataset ? etfConcentration(dataset.value) : null;
  return <section aria-labelledby="etf-holdings-heading" className="min-w-0 border-t border-border pt-6"><h3 id="etf-holdings-heading" className="text-card-title font-bold">Největší pozice</h3><p className="mt-1 text-small text-secondary">Největší vykázané pozice podle váhy v portfoliu. Sloupce jsou škálované podle největší zobrazené pozice.</p>{rows.length ? <><dl className="mt-5 grid grid-cols-1 gap-x-4 gap-y-3 border-y border-border py-4 text-small sm:grid-cols-3"><div><dt className="text-secondary">Největší pozice</dt><dd className="mt-1 font-bold tabular-nums">{formatEtfPercent(concentration!.largestWeight)}</dd></div><div><dt className="text-secondary">Podíl 10 největších pozic <details className="inline-block align-middle"><summary aria-label="Více o podílu 10 největších pozic" className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-sm text-primary-hover focus-visible:outline-2 focus-visible:outline-primary"><CircleHelp aria-hidden="true" className="size-4" /></summary><p className="mt-1 break-words text-microcopy font-normal text-secondary">Podíl fondu tvořený jeho deseti největšími vykázanými pozicemi.</p></details></dt><dd className="mt-1 font-bold tabular-nums">{formatEtfPercent(concentration!.topTenWeight)}</dd></div><div><dt className="text-secondary">Načtené pozice</dt><dd className="mt-1 font-bold tabular-nums">{concentration!.returnedCount}{reportedTotal !== null ? ` · ${reportedTotal.toLocaleString("cs-CZ")} celkem podle zdroje` : " · celkem neznámé"}</dd></div></dl><ol className="mt-2 divide-y divide-border/70">{rows.map((row: EtfHolding, index) => <li key={`${row.isin ?? row.symbol ?? row.name}-${index}`} className="min-w-0 py-3"><div className="flex min-w-0 items-start justify-between gap-3 text-small"><div className="min-w-0"><p className="break-words font-semibold">{row.name}</p>{row.symbol ? <p className="mt-0.5 break-all text-microcopy text-secondary">{row.symbol}</p> : null}</div><span className="shrink-0 font-bold tabular-nums">{formatEtfPercent(row.weight)}</span></div><WeightBar weight={row.weight} max={max} /></li>)}</ol></> : unavailable()}{dataset ? freshness(dataset, now, true) : null}</section>;
}

export function EtfAnalytics({ snapshot, message, now = new Date() }: { snapshot: EtfAnalyticsSnapshot | null; message: string | null; now?: Date }) {
  const info = snapshot?.info;
  const value = info?.value;
  return <div className="mt-8 space-y-8" data-testid="etf-analytics"><section aria-labelledby="etf-overview-heading" className="border-t border-border pt-7"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="etf-overview-heading" className="text-section-title font-bold">Přehled fondu</h2><p className="text-microcopy text-secondary">Složení portfolia · poslední dostupná data</p></div>{value ? <><dl className="mt-4 grid grid-cols-1 gap-x-6 min-[390px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">{metric("Nákladovost", formatEtfPercent(value.expenseRatio, 2), "Roční provozní náklady fondu jako procento aktiv.", value.expenseRatioAsOf)}{metric("AUM", magnitude(value.assetsUnderManagement, value.assetsCurrency), value.assetsScope === "etf-share-class" ? "Čistá aktiva samotné ETF třídy fondu." : value.assetsScope === "all-share-classes" ? "Aktiva všech tříd fondu dohromady, včetně podílových tříd mimo ETF." : "Celková aktiva spravovaná fondem. Zdroj nemusí uvádět jejich měnu.", value.assetsAsOf)}{metric("NAV", money(value.nav, value.navCurrency), "Hodnota podkladových aktiv fondu na jednu pozici. Liší se od jeho tržní ceny.")}{metric("Počet pozic", value.holdingsCount?.toLocaleString("cs-CZ") ?? "—", "Celkový počet pozic podle poskytovatele, pokud je dostupný.")}{metric("Založení", value.inceptionDate?.slice(0, 4) ?? "—", "Datum založení fondu, pokud ho zdroj poskytuje.")}</dl>{value.assetsUnderManagement !== null && value.assetsScope === "all-share-classes" ? <p className="text-microcopy text-secondary">AUM zahrnuje všechny třídy fondu.</p> : value.assetsUnderManagement !== null && value.assetsScope === "etf-share-class" ? <p className="text-microcopy text-secondary">AUM představuje čistá aktiva ETF třídy.</p> : null}{freshness(info, now, false, value.expenseRatioAsOf !== undefined || value.assetsAsOf !== undefined)}</> : <p role="status" className="mt-4 text-small text-secondary">{message ?? "Přehled fondu není z tohoto zdroje dostupný."}</p>}</section><div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">{topHoldings(snapshot?.holdings ?? null, snapshot?.info?.value.holdingsCount ?? null, now)}{exposure("Sektorové zastoupení", "etf-sectors-heading", "Jak jsou investice fondu rozděleny mezi ekonomická odvětví. Sloupce jsou škálované podle největšího zobrazeného zastoupení.", snapshot?.sectors ?? null, now)}</div>{exposure("Geografické zastoupení", "etf-countries-heading", "Investiční zastoupení podle země podle údajů zdroje. Sloupce jsou škálované podle největšího zobrazeného zastoupení.", snapshot?.countries ?? null, now)}{attribution(snapshot)}</div>;
}
