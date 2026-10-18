import { AppLink as Link } from "@/components/shell/app-link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ComparePicker } from "@/components/lab/compare-picker";
import { InstrumentComparisonView } from "@/components/lab/instrument-comparison";
import { LockedPortfolioLab } from "@/components/lab/locked-portfolio-lab";
import { PageFrame } from "@/components/shell/page-frame";
import { Feedback } from "@/components/ui/feedback";
import { loadInstrumentComparison } from "@/features/instruments/comparison-loader";
import { parseChartRange } from "@/features/instruments/history";
import { instrumentCompareHref, resolveInstrumentQueryParam } from "@/features/instruments/routes";
import { isMarketDataError } from "@/features/market-data/errors";
import { FIXTURE_RETRIEVED_AT } from "@/features/market-data/deterministic/fixtures";
import { portfolioMarketData } from "@/features/portfolio/environment";
import { marketDataMode } from "@/features/portfolio/market-data";
import { loadPortfolioLabUnlockStatus } from "@/features/progression/repository";
import { rateLimiter } from "@/features/rate-limit";
import { marketDataBuckets, marketDataLimitMessage } from "@/features/rate-limit/policy";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Srovnání instrumentů | Portfolio Lab" };

type SearchParams = { a?: string | string[]; b?: string | string[]; range?: string | string[] };

/** Absent stays null; anything present but malformed (including a repeated parameter) is a 404. */
function instrumentParam(value: string | string[] | undefined) {
  if (value === undefined) return null;
  return resolveInstrumentQueryParam(value) ?? notFound();
}

function Frame({ children }: { children: ReactNode }) {
  return <PageFrame width="wide" className="max-w-[80rem] pt-6 pb-28 sm:pt-7 sm:pb-10 lg:pt-8">
    <Link href="/lab/portfolio" className="inline-flex min-h-11 items-center text-small font-semibold text-primary-hover">← Portfolio Lab</Link>
    {children}
  </PageFrame>;
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const unlock = await loadPortfolioLabUnlockStatus(user.id);
  if (!unlock.unlocked) return <LockedPortfolioLab unlock={unlock} />;
  const params = await searchParams;
  const first = instrumentParam(params.a);
  const second = instrumentParam(params.b);
  const range = parseChartRange(params.range);
  if (first === null && second !== null) redirect(instrumentCompareHref(second, null, range));
  const sample = marketDataMode(portfolioMarketData) === "sample";

  const budget = await rateLimiter.consume(marketDataBuckets(user.id, "instrument-compare"));
  if (!budget.allowed) return <Frame><div className="mt-6"><h1 className="text-page-title font-bold">Srovnání teď nelze načíst</h1><Feedback state="warning" role="status" className="mt-5">{marketDataLimitMessage(budget)}</Feedback></div></Frame>;

  if (first === null || second === null || first === second) {
    let firstName: string | null = null;
    if (first !== null) {
      try { firstName = (await portfolioMarketData.service.getInstrumentMetadata(first)).name; }
      catch (error) { if (isMarketDataError(error) && (error.code === "InstrumentNotFound" || error.code === "UnsupportedInstrument")) notFound(); }
    }
    return <Frame>
      <header className="mt-3 max-w-2xl sm:mt-5">
        <p className="text-microcopy font-bold uppercase tracking-[0.12em] text-primary-hover">Srovnání instrumentů</p>
        <h1 className="mt-2 wrap-anywhere text-page-title font-bold tracking-[-0.025em]">{first === null ? "Co chceš porovnat?" : `Porovnat ${firstName ?? first} s…`}</h1>
        <p className="mt-3 text-small leading-relaxed text-secondary">Dva instrumenty srovnáš podle cenového výnosu, kolísání, největšího propadu a toho, jak spolu jejich ceny souvisely.</p>
      </header>
      {first !== null && first === second ? <Feedback state="warning" role="status" className="mt-5 max-w-2xl">Instrument nejde porovnat sám se sebou. Vyber jiný.</Feedback> : null}
      <div className="mt-6 max-w-xl"><ComparePicker id="compare-search" label={first === null ? "První instrument" : "Druhý instrument"} first={first} range={range} sample={sample} /></div>
    </Frame>;
  }

  const comparison = await loadInstrumentComparison(portfolioMarketData.service, first, second, range, env.MARKET_DATA_PROVIDER === "deterministic" ? new Date(env.DETERMINISTIC_MARKET_NOW ?? FIXTURE_RETRIEVED_AT) : new Date());
  if (comparison.instrumentMissing) notFound();
  return <Frame><InstrumentComparisonView data={comparison} sample={sample} /></Frame>;
}
