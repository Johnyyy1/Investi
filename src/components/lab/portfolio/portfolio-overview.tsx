"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, BookOpen, ChartLine, ChartNoAxesColumn, ChevronDown, CircleAlert,
  CircleCheck, CircleOff, Ellipsis, Hourglass, Info, Minus, Moon, ReceiptText, RotateCcw, Sparkles,
  TrendingDown, TrendingUp, TriangleAlert, Wallet, X,
} from "lucide-react";
import { instrumentDetailHref } from "@/features/instruments/routes";
import { resetPortfolioAction } from "@/features/portfolio/actions";
import type { PortfolioView } from "@/features/portfolio/service";
import { formatDecimal } from "@/lib/formatters";
import { AllocationDonut } from "./allocation-donut";
import { InstrumentSearch } from "./instrument-search";
import {
  contributionRows, contributionStory, currencyName, dataStatus, fxRate, groupOf, groupOrder, groups, groupSummaries, minor, money,
  percent, quantity, signedMoney, trend, wholeMoney, type DataStatus, type GroupSummary, type Holding,
} from "./lab-model";
import styles from "./portfolio-lab.module.css";

export const PORTFOLIO_LESSON_HREF = "/learn/investing-foundations/your-first-portfolio";
const TIME_ZONE = "Europe/Prague";

function dateLabel(value: string, withYear = true) {
  return new Intl.DateTimeFormat("cs-CZ", { timeZone: TIME_ZONE, day: "numeric", month: "numeric", ...(withYear ? { year: "numeric" } : {}) }).format(new Date(value));
}
function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}
function timeLabel(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function fxSourceLabel(view: PortfolioView) {
  const provider = view.holdings.find(({ fxProvider }) => fxProvider)?.fxProvider ?? null;
  if (view.marketDataMode === "sample" || provider === "investi-deterministic") return "ukázkový kurz";
  if (provider?.includes("frankfurter")) return "referenční kurz ECB";
  return "referenční kurz";
}

const trendIcons: Record<ReturnType<typeof trend>, LucideIcon> = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus, unknown: Minus };

function Change({ value, basisPoints }: { value: string | null; basisPoints?: string | null }) {
  const direction = trend(value);
  const Icon = trendIcons[direction];
  const spoken = direction === "up" ? "Zisk" : direction === "down" ? "Ztráta" : "Beze změny";
  if (value === null) return <span className={styles.change}>změna nedostupná</span>;
  return <span className={`${styles.change} ${styles.num}`} aria-label={`${spoken} ${money(minor(value) < 0n ? -minor(value) : minor(value))}${basisPoints != null ? `, ${percent(basisPoints, { signed: true })}` : ""}`}>
    <Icon size={13} aria-hidden="true" />{signedMoney(value)}{basisPoints != null ? <> · {percent(basisPoints, { signed: true })}</> : null}
  </span>;
}

export function PortfolioOverview({ view, notice: initialNotice = null }: { view: PortfolioView; notice?: { title: string; detail: string } | null }) {
  const router = useRouter();
  const [notice, setNotice] = useState(initialNotice);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [resetting, startReset] = useTransition();
  const resetDialog = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const resetKey = useRef<string | null>(null);
  const focusAfterReset = useRef(false);

  const status = dataStatus(view);
  const hasHoldings = view.holdings.length > 0;
  const hasCapital = minor(view.earnedPracticeCapitalMinor) > 0n || minor(view.availableCashMinor) > 0n;
  const firstVisit = !hasHoldings && view.recentActivity.length === 0;
  const hasHistory = hasHoldings || view.recentActivity.length > 0;
  const refresh = () => startRefresh(() => router.refresh());

  useEffect(() => {
    // The options menu disappears with the reset; move focus to the new first action instead of losing it.
    if (!focusAfterReset.current || !firstVisit) return;
    focusAfterReset.current = false;
    document.getElementById("first-buy-search")?.focus();
  }, [firstVisit, view.portfolioId]);

  function reset() {
    if (resetting) return;
    resetKey.current ??= crypto.randomUUID();
    setResetError(null);
    startReset(async () => {
      const response = await resetPortfolioAction({ clientIdempotencyKey: resetKey.current });
      if (!response.ok) { setResetError(response.message); return; }
      resetKey.current = null;
      focusAfterReset.current = true;
      resetDialog.current?.close();
      setNotice({ title: "Portfolio resetováno", detail: "Veškerý získaný cvičný kapitál je opět k dispozici. Postup v učení i dřívější obchody zůstávají zapsané." });
      router.refresh();
    });
  }

  return <main className={styles.page} data-state={!hasCapital && !hasHoldings ? "zero" : firstVisit ? "first-visit" : status.kind}>
    <div className={styles.container}>
      {firstVisit ? null : <header className={styles.header}>
        <div className={styles.eyebrowRow}><p className={styles.eyebrow}>Portfolio Lab · Cvičné portfolio</p>{view.marketDataMode === "sample" ? <span className={styles.sampleTag}>Ukázková data</span> : null}</div>
        <h1>Moje portfolio</h1>
        <div className={styles.headerActions}>
          {hasHistory ? <div className={styles.menuWrap}>
            <button ref={menuButton} type="button" className={styles.iconButton} aria-label="Možnosti portfolia" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false); }}><Ellipsis size={20} aria-hidden="true" /></button>
            {menuOpen ? <div role="menu" aria-label="Možnosti portfolia" className={styles.menu} onKeyDown={(event) => { if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); } }}>
              <button type="button" role="menuitem" autoFocus onClick={() => { setMenuOpen(false); setResetError(null); resetDialog.current?.showModal(); }}>Resetovat portfolio</button>
            </div> : null}
          </div> : null}
        </div>
        <p className={styles.meta}>Otevřeno {dateLabel(view.openedAt)} · cvičné peníze, nic skutečného</p>
      </header>}
      {firstVisit || (!hasCapital && !hasHoldings) ? null : <div className={styles.buyBar}><InstrumentSearch sample={view.marketDataMode === "sample"} /></div>}

      {notice ? <div className={styles.notice} role="status"><CircleCheck size={18} aria-hidden="true" /><div className={styles.noticeText}><strong>{notice.title}</strong><p>{notice.detail}</p></div><button type="button" aria-label="Zavřít potvrzení" onClick={() => setNotice(null)}><X size={18} aria-hidden="true" /></button></div> : null}

      {!hasCapital && !hasHoldings ? <ZeroCapital cashMinor={view.availableCashMinor} />
        : firstVisit ? <FirstVisit view={view} />
          : <>
            <StatusBanner view={view} status={status} refreshing={refreshing} onRetry={refresh} />
            {status.kind === "unavailable" ? <Missing view={view} status={status} refreshing={refreshing} onRetry={refresh} /> : <Overview view={view} status={status} />}
          </>}

      <footer className={styles.footer}><p>investi!</p><p>Výukový model s cvičnými penězi. Nejde o investiční doporučení ani odhad budoucího výnosu.</p></footer>
    </div>

    <dialog ref={resetDialog} className={styles.dialog} aria-labelledby="reset-title" aria-describedby="reset-description" onCancel={(event) => { if (resetting) event.preventDefault(); }} onClose={() => {
      setResetError(null);
      // The menu item that opened the dialog is gone; return focus to its trigger, also after the browser's own restore.
      const restore = () => (menuButton.current?.isConnected ? menuButton.current : document.getElementById("first-buy-search"))?.focus();
      restore();
      requestAnimationFrame(restore);
    }}>
      <div className={styles.dialogInner}>
        <h2 id="reset-title">Resetovat portfolio?</h2>
        <p id="reset-description">Pozice se uzavřou a veškerý získaný cvičný kapitál bude znovu k dispozici jako hotovost. Postup v učení i dřívější obchody zůstanou zaznamenané.</p>
        {resetError ? <p role="alert" className={styles.error}>{resetError}</p> : null}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.secondary} disabled={resetting} onClick={() => resetDialog.current?.close()}>Ponechat portfolio</button>
          <button type="button" className={styles.danger} disabled={resetting} aria-busy={resetting || undefined} onClick={reset}>{resetting ? "Resetuji…" : "Resetovat portfolio"}</button>
        </div>
      </div>
    </dialog>
  </main>;
}

function ZeroCapital({ cashMinor }: { cashMinor: string }) {
  return <section className={`${styles.card} ${styles.zero}`} aria-labelledby="zero-capital-title">
    <div className={styles.emptyHead}><p className={styles.sectionLabel}>Tvoje portfolio</p><p className={styles.meta}>Hotovost <strong className={styles.num} data-testid="portfolio-cash">{money(cashMinor)}</strong></p></div>
    <h2 id="zero-capital-title">Získej kapitál učením</h2>
    <p>Cvičný kapitál dostáváš za dokončené lekce. Až nějaký budeš mít, nakoupíš za něj první akcii, ETF nebo dluhopis.</p>
    <Link href="/learn" className={styles.primary}>Pokračovat v učení<ArrowRight size={18} aria-hidden="true" /></Link>
  </section>;
}

function FirstVisit({ view }: { view: PortfolioView }) {
  const capital = minor(view.availableCashMinor);
  const share = (basisPoints: bigint) => (capital * basisPoints) / 10_000n;
  const sample = view.marketDataMode === "sample";
  const example = [
    { id: "equity", label: "Akcie", color: groups.equity.color, basisPoints: 6_000 },
    { id: "bond", label: "Dluhopisy", color: groups.bond.color, basisPoints: 3_000 },
    { id: "cash", label: "Hotovost", color: groups.cash.color, basisPoints: 1_000 },
  ];
  return <div className={styles.firstVisit}>
    <section className={styles.hero} aria-labelledby="lab-title">
      <div className={styles.heroCopy}>
        <div className={styles.eyebrowRow}><p className={styles.eyebrow}>Portfolio Lab</p>{sample ? <span className={styles.sampleTag}>Ukázková data</span> : null}</div>
        <h1 id="lab-title">Zkus si investovat nanečisto.</h1>
        <p><span className={styles.num} data-testid="portfolio-cash">{money(capital)}</span> cvičného kapitálu. Žádné skutečné peníze ani obchody.</p>
      </div>
      <div className={styles.guideScene}>
        <p className={styles.bubble}>Váha je díl z celku: 60&nbsp;% z <span className={styles.num}>{wholeMoney(capital)}</span> je <span className={styles.num}>{wholeMoney(share(6_000n))}</span>.</p>
        <Image className={styles.guide} src="/investi-assets/guide/03-explaining.webp" alt="" width={627} height={627} sizes="(min-width: 1024px) 254px, 210px" priority />
      </div>
    </section>
    <section className={`${styles.card} ${styles.empty}`} aria-labelledby="empty-title">
      <div className={styles.emptyHead}><p className={styles.sectionLabel}>Tvoje portfolio</p><p className={styles.meta}>Odděleno od XP</p></div>
      <h2 id="empty-title">Zatím tu nic není. Začni prvním nákupem.</h2>
      <p>Najdi firmu, fond nebo dluhopis a otevři jeho detail s grafem. Tam zvolíš počet kusů, pokyn zkontroluješ a nakoupíš nanečisto. Koláč pak ukáže, kolik máš v akciích, dluhopisech a v hotovosti.</p>
      <ul className={styles.facts}>
        <li><Wallet size={20} aria-hidden="true" /><strong className={styles.num}>{money(capital)}</strong><span>cvičný kapitál z lekcí, ne tvoje peníze</span></li>
        <li><ChartLine size={20} aria-hidden="true" /><strong>{sample ? "Ukázkové ceny" : "Tržní ceny"}</strong><span>{sample ? "pevná výuková sada, ne tržní data" : "pozorování od poskytovatele, mohou být zpožděná"}</span></li>
        <li><CircleOff size={20} aria-hidden="true" /><strong>Mimo XP</strong><span>zisk ani ztráta body nemění</span></li>
      </ul>
      <div className={styles.emptySearch}><InstrumentSearch id="first-buy-search" label="Najdi, co chceš koupit" sample={sample} /></div>
    </section>
    <div className={styles.column}>
      <section className={`${styles.card} ${styles.example}`} aria-labelledby="example-title">
        <p id="example-title" className={styles.sectionLabel}>Příklad rozdělení · ne doporučení</p>
        <AllocationDonut label={`Příklad rozdělení ${money(capital)}: akcie 60 %, dluhopisy 30 %, hotovost 10 %.`} center="příklad" segments={example.map((segment) => ({ ...segment, value: percent(segment.basisPoints, { digits: 0 }), detail: wholeMoney(share(BigInt(segment.basisPoints))) }))} />
      </section>
      <section className={styles.steps} aria-labelledby="steps-title">
        <h2 id="steps-title" className={styles.sectionLabel}>Jak Lab funguje</h2>
        <ol>
          <li><span>01</span><h3>Najdeš nástroj</h3><p>Akcie, ETF a dluhopisy z nastaveného zdroje dat. Detail ukáže cenu, graf a základní údaje.</p></li>
          <li><span>02</span><h3>Nakoupíš za hotovost</h3><p>Zvolíš počet kusů, i zlomek. Před potvrzením uvidíš odhad ceny v korunách.</p></li>
          <li><span>03</span><h3>Sleduješ rozložení</h3><p>Kolik máš v akciích, ETF, dluhopisech a hotovosti, přepočteno {sample ? "ukázkovým" : "referenčním"} kurzem. Nic nepředpovídáme.</p></li>
        </ol>
      </section>
    </div>
  </div>;
}

function StatusBanner({ view, status, refreshing, onRetry }: { view: PortfolioView; status: DataStatus; refreshing: boolean; onRetry: () => void }) {
  if (status.kind === "none") return null;
  const sample = view.marketDataMode === "sample";
  const fx = view.holdings.find(({ fxRate: rate, quoteCurrency }) => rate && quoteCurrency !== "CZK");
  const fxText = fx ? ` · ${fxSourceLabel(view)} ${fxRate(fx.fxRate!)} Kč/${fx.quoteCurrency}${fx.fxReferenceDate ? ` z ${dateLabel(fx.fxReferenceDate)}` : ""}` : "";
  const content: Record<Exclude<DataStatus["kind"], "none">, { icon: LucideIcon; title: string; detail: string; kind: string; retry?: boolean }> = {
    fresh: sample
      ? { icon: Info, kind: "sample", title: "Ukázková data", detail: `Pevná výuková sada, ne tržní ceny · stav k ${status.kind === "fresh" && status.observedAt ? dateTimeLabel(status.observedAt) : "—"}${fxText}` }
      : { icon: CircleCheck, kind: "fresh", title: "Čerstvá tržní data", detail: `Poslední cena ${status.kind === "fresh" && status.observedAt ? dateTimeLabel(status.observedAt) : "—"}${fxText}` },
    closed: { icon: Moon, kind: "closed", title: `Trh je zavřený${sample ? " · ukázková data" : ""}`, detail: `Hodnota podle zavíracích cen z ${status.kind === "closed" && status.observedAt ? dateTimeLabel(status.observedAt) : "posledního obchodního dne"}. Nakupovat a prodávat půjde, až se trh otevře.` },
    stale: { icon: TriangleAlert, kind: "stale", retry: true, title: `Data jsou zastaralá${sample ? " · ukázková data" : ""}`, detail: `Nejstarší cena je z ${status.kind === "stale" && status.observedAt ? dateTimeLabel(status.observedAt) : "—"}. Čísla můžou být neaktuální, nakupovat ani prodávat teď nejde.` },
    unavailable: { icon: CircleAlert, kind: "unavailable", retry: false, title: status.kind === "unavailable" && status.missing < status.total ? "Některé ceny chybí" : "Data nedostupná", detail: status.kind === "unavailable" ? `Oceněno ${status.total - status.missing} z ${status.total} položek. Chybějící cenu nepočítáme jako nulu.` : "" },
  };
  const item = content[status.kind];
  const Icon = item.icon;
  return <div className={styles.status} data-kind={item.kind} role="status">
    <Icon size={18} aria-hidden="true" />
    <div className={styles.statusText}><strong>{item.title}</strong><p className={styles.num}>{item.detail}</p></div>
    {item.retry ? <button type="button" className={`${styles.textLink} ${styles.statusRetry}`} onClick={onRetry} disabled={refreshing}><RotateCcw size={16} aria-hidden="true" />{refreshing ? "Načítám…" : "Načíst znovu"}</button> : null}
  </div>;
}

function valueLabel(view: PortfolioView, status: DataStatus) {
  if (status.kind === "closed") return `Hodnota při zavření${status.observedAt ? ` ${dateLabel(status.observedAt, false)}` : ""}`;
  if (status.kind === "stale") return `Naposledy známá hodnota${status.observedAt ? ` · ${timeLabel(status.observedAt)}` : ""}`;
  return view.marketDataMode === "sample" ? "Hodnota podle ukázkových cen" : "Hodnota teď";
}

function Overview({ view, status }: { view: PortfolioView; status: DataStatus }) {
  const rows = groupSummaries(view);
  const contributions = view.holdings.length > 0 ? contributionRows(view, rows) : null;
  const story = contributions ? contributionStory(view, contributions) : null;
  return <div className={styles.layout}>
    <div className={styles.column}>
      <ValueCard view={view} status={status} />
      {contributions && story ? <Story view={view} contributions={contributions} story={story} /> : null}
    </div>
    <div className={styles.column}>
      <HoldingsCard view={view} />
      <AllocationCard view={view} rows={rows} />
      <Activity view={view} />
    </div>
  </div>;
}

function ValueCard({ view, status }: { view: PortfolioView; status: DataStatus }) {
  const gain = view.investmentGainLossMinor;
  const GainIcon = trend(gain) === "down" ? TrendingDown : TrendingUp;
  const attribution = view.attribution;
  const currencies = attribution?.currencies ?? [];
  const foreign = [...new Set(view.holdings.map(({ quoteCurrency }) => quoteCurrency).filter((currency) => currency !== "CZK"))];
  return <section className={`${styles.card} ${styles.value} ${status.kind === "stale" ? styles.valueStale : ""}`} aria-labelledby="portfolio-value-label">
    <p id="portfolio-value-label" className={styles.valueLabel}>{valueLabel(view, status)}</p>
    <p className={`${styles.valueAmount} ${styles.num}`} data-testid="portfolio-value">{view.portfolioTotalMinor === null ? "—" : money(view.portfolioTotalMinor)}</p>
    <dl className={styles.metrics}>
      <div className={`${styles.metric} ${styles.metricPrimary}`}>
        <GainIcon size={18} aria-hidden="true" />
        <dt className={styles.metricLabel}>Zisk / ztráta od {dateLabel(view.openedAt, false)}<span className={styles.num}>{percent(view.investmentGainLossBasisPoints, { signed: true })}</span></dt>
        <dd className={`${styles.metricAmount} ${styles.num}`} data-testid="portfolio-gain-loss">{gain === null ? "—" : signedMoney(gain)}</dd>
      </div>
      {attribution ? <>
        <div className={styles.metric}><ChartLine size={18} aria-hidden="true" /><dt className={styles.metricLabel}>Z toho pohyb cen{foreign.length ? <span>v {foreign.join(", ")}</span> : null}</dt><dd className={`${styles.metricAmount} ${styles.num}`} data-testid="portfolio-price-effect">{signedMoney(attribution.priceEffectMinor)}</dd></div>
        {foreign.length ? <div className={styles.metric}><ArrowLeftRight size={18} aria-hidden="true" /><dt className={styles.metricLabel}>{currencies.length === 1 ? `Z toho kurz ${currencies[0].currency === "USD" ? "dolaru" : currencies[0].currency === "EUR" ? "eura" : currencies[0].currency}` : "Z toho kurzy měn"}{currencies.length === 1 ? <span className={styles.num}>{fxRate(currencies[0].purchaseFxRate)} → {fxRate(currencies[0].currentFxRate)}</span> : null}</dt><dd className={`${styles.metricAmount} ${styles.num}`} data-testid="portfolio-fx-effect">{signedMoney(attribution.fxEffectMinor)}</dd></div> : null}
        {minor(attribution.realizedGainLossMinor) !== 0n ? <div className={styles.metric}><ReceiptText size={18} aria-hidden="true" /><dt className={styles.metricLabel}>Z toho uzavřené prodeje</dt><dd className={`${styles.metricAmount} ${styles.num}`}>{signedMoney(attribution.realizedGainLossMinor)}</dd></div> : null}
      </> : null}
    </dl>
    <p className={styles.context}>
      <span>Hotovost <strong className={styles.num} data-testid="portfolio-cash">{money(view.availableCashMinor)}</strong></span>
      <span>Investováno <strong className={styles.num} data-testid="portfolio-invested">{view.holdingsMarketValueMinor === null ? "neúplné" : money(view.holdingsMarketValueMinor)}</strong></span>
      <span>Cvičný kapitál <strong className={styles.num} data-testid="portfolio-capital">{money(view.earnedPracticeCapitalMinor)}</strong></span>
    </p>
    <p className={styles.contributionNote}><Info size={15} aria-hidden="true" />Kapitál z lekcí je vklad, ne výnos. Do zisku ani ztráty se nepočítá.</p>
  </section>;
}

function Story({ view, contributions, story }: { view: PortfolioView; contributions: NonNullable<ReturnType<typeof contributionRows>>; story: NonNullable<ReturnType<typeof contributionStory>> }) {
  const largest = contributions.reduce((max, row) => { const size = row.effectMinor < 0n ? -row.effectMinor : row.effectMinor; return size > max ? size : max; }, 0n);
  return <section className={`${styles.card} ${styles.story}`} aria-labelledby="story-title">
    <div className={styles.storyBody}>
      <div className={styles.storyEyebrow}><Sparkles size={16} aria-hidden="true" /><p className={styles.sectionLabel}>Co se stalo?</p></div>
      <p className={styles.meta}>Od začátku portfolia {dateLabel(view.openedAt)}</p>
      <h2 id="story-title">{story.headline}</h2>
      {story.sentences.map((sentence) => <p key={sentence}>{sentence}</p>)}
    </div>
    {contributions.every(({ effectMinor }) => effectMinor === 0n) ? null : <div className={styles.contrib}>
      <p className={styles.sectionLabel}>Co pohnulo výsledkem</p>
      <table className={styles.contribTable} role="table">
        <caption className="sr-only">Příspěvky k zisku nebo ztrátě od začátku portfolia v korunách</caption>
        <thead className="sr-only" role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Část</th><th scope="col" role="columnheader">Příspěvek</th></tr></thead>
        <tbody role="rowgroup">{contributions.map((row) => {
          const size = row.effectMinor < 0n ? -row.effectMinor : row.effectMinor;
          const width = largest === 0n ? 0 : Math.max(size === 0n ? 0 : 2, Number((size * 1000n) / largest) / 20);
          return <tr key={row.id} role="row" data-testid={`contribution-${row.id}`}>
            <th scope="row" role="rowheader">{row.label}{row.detail ? <small>{row.detail}</small> : null}</th>
            <td role="cell" className={styles.num}>{signedMoney(row.effectMinor)}</td>
            <td aria-hidden="true" className={styles.barCell}><div className={styles.bar}>{size > 0n ? <span data-sign={row.effectMinor > 0n ? "up" : "down"} style={{ width: `${width}%`, background: row.color }} /> : null}</div></td>
          </tr>;
        })}</tbody>
        <tfoot role="rowgroup"><tr role="row"><th scope="row" role="rowheader">Celkem</th><td role="cell" className={styles.num}>{view.investmentGainLossMinor === null ? "—" : signedMoney(view.investmentGainLossMinor)}</td></tr></tfoot>
      </table>
    </div>}
    <div className={styles.storyFoot}>
      <p className={styles.honesty}><Info size={15} aria-hidden="true" />Popis toho, co se už stalo, ne předpověď. Ceny se mění oběma směry.</p>
      <Link className={styles.textLink} href={PORTFOLIO_LESSON_HREF}><BookOpen size={16} aria-hidden="true" />Lekce: Portfolio, váhy a diverzifikace<ArrowRight size={16} aria-hidden="true" /></Link>
      <p className={styles.meta}><Hourglass size={14} aria-hidden="true" />Připravujeme: Volatilita · kapitola 03</p>
    </div>
  </section>;
}

function HoldingRow({ holding }: { holding: Holding }) {
  return <li className={styles.row} data-testid={`holding-${holding.symbol}`}>
    <span className={styles.dot} style={{ background: groups[groupOf(holding.assetType)].color }} aria-hidden="true" />
    <div className={styles.rowIdentity}>
      <p className={styles.rowTop}><span className={styles.chip}>{holding.symbol}</span><span className={styles.num}>{percent(holding.portfolioWeightBasisPoints)}</span></p>
      <Link className={styles.rowName} href={instrumentDetailHref(holding.instrumentId)}>{holding.name}<span className="sr-only">: detail, nákup a prodej</span></Link>
    </div>
    <div className={styles.rowValue}>
      <strong className={styles.num}>{holding.marketValueMinor === null ? "—" : money(holding.marketValueMinor)}</strong>
      <Change value={holding.gainLossMinor} basisPoints={holding.gainLossBasisPoints} />
    </div>
    <p className={`${styles.meta} ${styles.num} ${styles.rowMeta}`}>{quantity(holding.quantity)} ks · {holding.currentPrice ? `${formatDecimal(Number(holding.currentPrice), { maximumFractionDigits: 4 })} ${holding.currentPriceCurrency}` : "cena chybí"}{holding.quoteUsability === "closed-market-reference" ? " · zavírací cena" : holding.quoteUsability === "stale" ? " · zastaralá cena" : ""}</p>
  </li>;
}

/** Rows follow the allocation groups (as in the Pen), largest value first within a group. */
function byGroup(holdings: readonly Holding[]) {
  const value = (holding: Holding) => holding.marketValueMinor === null ? -1n : minor(holding.marketValueMinor);
  return [...holdings].sort((a, b) => groupOrder.indexOf(groupOf(a.assetType)) - groupOrder.indexOf(groupOf(b.assetType)) || (value(b) > value(a) ? 1 : value(b) < value(a) ? -1 : a.symbol.localeCompare(b.symbol)));
}

function HoldingsCard({ view }: { view: PortfolioView }) {
  const currencies = view.attribution?.currencies ?? [];
  const fxEffect = view.attribution ? minor(view.attribution.fxEffectMinor) : 0n;
  return <section className={`${styles.card} ${styles.holdings}`} aria-labelledby="holdings-title">
    <div className={styles.cardHead}><h2 id="holdings-title">Položky</h2><p className={styles.meta}>v Kč · {fxSourceLabel(view)}</p></div>
    <ul className={styles.rows} aria-label="Položky portfolia">
      {byGroup(view.holdings).map((holding) => <HoldingRow key={holding.instrumentId} holding={holding} />)}
      <li className={styles.row} data-testid="holding-cash">
        <span className={styles.dot} style={{ background: groups.cash.color }} aria-hidden="true" />
        <div className={styles.rowIdentity}>
          <p className={styles.rowTop}><span className={styles.chip}>Kč</span><span className={styles.num}>{percent(view.cashWeightBasisPoints)}</span></p>
          <p className={styles.rowName}>Hotovost v korunách</p>
        </div>
        <div className={styles.rowValue}><strong className={styles.num}>{money(view.availableCashMinor)}</strong><span className={styles.change}>bez kurzu a výnosu</span></div>
      </li>
    </ul>
    <div className={styles.total}><span>Celkem</span><div className={styles.rowValue}><strong className={styles.num}>{view.portfolioTotalMinor === null ? "—" : money(view.portfolioTotalMinor)}</strong><Change value={view.investmentGainLossMinor} basisPoints={view.investmentGainLossBasisPoints} /></div></div>
    {currencies.length > 0 ? <p className={styles.note}><ArrowLeftRight size={15} aria-hidden="true" /><span>
      Hodnota = kusy × cena v {currencies.map(({ currency }) => currency).join(" nebo ")} × {fxSourceLabel(view)}.{" "}
      {currencies.map((item) => `${currencyName(item.currency)}: při nákupu průměrně ${fxRate(item.purchaseFxRate)}, teď ${fxRate(item.currentFxRate)} Kč.`).join(" ")}{" "}
      {fxEffect === 0n ? "Kurz zatím výsledek nezměnil." : `Přepočet kurzem ${fxEffect > 0n ? "přidal" : "ubral"} ${money(fxEffect < 0n ? -fxEffect : fxEffect)}.`}
    </span></p> : null}
  </section>;
}

function AllocationCard({ view, rows }: { view: PortfolioView; rows: readonly GroupSummary[] }) {
  const complete = rows.every((row) => row.weightBasisPoints !== null);
  const count = view.holdings.length + (minor(view.availableCashMinor) > 0n ? 1 : 0);
  return <section className={`${styles.card} ${styles.allocation}`} aria-labelledby="allocation-title">
    <div className={styles.cardHead}><h2 id="allocation-title">Rozložení</h2><p className={styles.meta}>podíl na celé hodnotě</p></div>
    {complete ? <AllocationDonut
      label={`Rozložení portfolia: ${rows.map((row) => `${groups[row.group].label} ${percent(row.weightBasisPoints)}${row.valueMinor === null ? "" : `, ${money(row.valueMinor)}`}`).join("; ")}.`}
      center={`${count} ${count === 1 ? "položka" : count < 5 ? "položky" : "položek"}`}
      segments={rows.map((row) => ({ id: row.group, label: groups[row.group].label, color: groups[row.group].color, basisPoints: row.weightBasisPoints ?? 0, value: percent(row.weightBasisPoints), detail: row.valueMinor === null ? undefined : money(row.valueMinor) }))}
    /> : <p className={styles.meta}>Rozložení ukážeme, až budou známé ceny všech položek.</p>}
    <div className={styles.drift}>
      <p>Kolik z celé hodnoty máš v akciích, ETF, dluhopisech a v hotovosti. Rozložení se mění s cenami i s každým nákupem a prodejem. Kapitál z nových lekcí přibude do hotovosti.</p>
      <Link className={styles.textLink} href={PORTFOLIO_LESSON_HREF}>Lekce: Portfolio, váhy a diverzifikace<ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
  </section>;
}

function Activity({ view }: { view: PortfolioView }) {
  if (view.recentActivity.length === 0) return null;
  return <details className={`${styles.card} ${styles.activity}`}>
    <summary>Poslední obchody · {view.recentActivity.length}<ChevronDown size={18} aria-hidden="true" /></summary>
    <ul aria-label="Poslední obchody nanečisto">{view.recentActivity.map((trade) => <li key={trade.id}>
      <span><strong>{trade.side === "BUY" ? "Nákup" : "Prodej"} {trade.symbol}</strong> · <span className={styles.num}>{quantity(trade.quantity)} ks</span></span>
      <span className={styles.num}><strong>{money(trade.grossAmountBaseMinor)}</strong></span>
      <span className={styles.meta}>{trade.name}</span>
      <span className={styles.meta}>{dateLabel(trade.executedAt)}</span>
    </li>)}</ul>
  </details>;
}

function Missing({ view, status, refreshing, onRetry }: { view: PortfolioView; status: Extract<DataStatus, { kind: "unavailable" }>; refreshing: boolean; onRetry: () => void }) {
  const partial = status.missing < status.total;
  return <div className={styles.layout}>
    <div className={styles.column}>
      <div className={styles.missing}>
        <div className={styles.missingScene}>
          <p className={styles.bubble}>Hledám nejnovější ceny. Hádat je nebudu.</p>
          <Image className={styles.guide} src="/investi-assets/guide/20-searching-box.webp" alt="" width={872} height={654} sizes="230px" />
        </div>
        <section className={`${styles.card} ${styles.missingCard}`} aria-labelledby="missing-title">
          <div className={styles.emptyHead}><p className={styles.sectionLabel}>Něco chybí</p><p className={styles.meta}>Tržní data</p></div>
          <h2 id="missing-title">{partial ? "Některé ceny se teď nenačetly." : "Ceny se teď nenačetly."}</h2>
          <p>Bez cen všech položek nevíme, kolik má portfolio hodnotu. Proto ji neukazujeme a nic neodhadujeme.</p>
          <button type="button" className={styles.primary} onClick={onRetry} disabled={refreshing}>{refreshing ? "Načítám…" : "Načíst znovu"}<RotateCcw size={18} aria-hidden="true" /></button>
          <p className={styles.meta}>Tvoje pozice jsou v bezpečí. Co víme jistě, je níž.</p>
        </section>
      </div>
      <section className={`${styles.card} ${styles.known}`} aria-labelledby="known-title">
        <div className={styles.cardHead}><h2 id="known-title">Co víme jistě</h2><p className={styles.meta}>z uložených obchodů</p></div>
        <ul className={styles.rows}>
          {byGroup(view.holdings).map((holding) => {
            return <li key={holding.instrumentId} data-testid={`holding-${holding.symbol}`}>
              <span className={styles.dot} style={{ background: groups[groupOf(holding.assetType)].color }} aria-hidden="true" />
              <div className={styles.rowIdentity}><p className={styles.rowTop}><span className={styles.chip}>{holding.symbol}</span><span className={styles.num}>{quantity(holding.quantity)} ks</span></p><Link className={styles.rowName} href={instrumentDetailHref(holding.instrumentId)}>{holding.name}</Link></div>
              <div><strong className={styles.num}>{money(holding.costBasisMinor)}</strong><span>nakoupeno</span>{holding.marketValueMinor === null ? <span>cena chybí</span> : <span className={styles.num}>teď {money(holding.marketValueMinor)}</span>}</div>
            </li>;
          })}
          <li data-testid="holding-cash">
            <span className={styles.dot} style={{ background: groups.cash.color }} aria-hidden="true" />
            <div className={styles.rowIdentity}><p className={styles.rowTop}><span className={styles.chip}>Kč</span></p><p className={styles.rowName}>Hotovost v korunách</p></div>
            <div><strong className={styles.num} data-testid="portfolio-cash">{money(view.availableCashMinor)}</strong><span>přesně z účetní knihy</span></div>
          </li>
        </ul>
        <p className={styles.note}><ChartNoAxesColumn size={15} aria-hidden="true" />Hodnotu, změnu i rozložení ukážeme, až budou data. Odhadovat je nebudeme.</p>
      </section>
    </div>
    <div className={styles.column}><Activity view={view} /></div>
  </div>;
}
