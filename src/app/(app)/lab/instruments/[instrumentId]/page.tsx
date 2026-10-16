import { AppLink as Link } from "@/components/shell/app-link";
import { notFound, redirect } from "next/navigation";
import { InstrumentDetailView } from "@/components/lab/instrument-detail";
import { PageFrame } from "@/components/shell/page-frame";
import { Feedback } from "@/components/ui/feedback";
import { loadInstrumentDetail } from "@/features/instruments/detail";
import { parseChartRange } from "@/features/instruments/history";
import { resolveInstrumentRouteParam } from "@/features/instruments/routes";
import { FIXTURE_RETRIEVED_AT } from "@/features/market-data/deterministic/fixtures";
import { portfolioMarketData } from "@/features/portfolio/environment";
import { loadPortfolioView } from "@/features/portfolio/service";
import { getCurrentUser } from "@/lib/session";
import { env } from "@/lib/env";
import { loadPortfolioLabUnlockStatus } from "@/features/progression/repository";
import { LockedPortfolioLab } from "@/components/lab/locked-portfolio-lab";
import { rateLimiter } from "@/features/rate-limit";
import { marketDataBuckets, marketDataLimitMessage } from "@/features/rate-limit/policy";

export const metadata = { title: "Instrument | Portfolio Lab" };

export default async function InstrumentPage({ params, searchParams }: { params: Promise<{ instrumentId: string }>; searchParams: Promise<{ range?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const unlock = await loadPortfolioLabUnlockStatus(user.id);
  if (!unlock.unlocked) return <LockedPortfolioLab unlock={unlock} />;
  const instrumentId = resolveInstrumentRouteParam((await params).instrumentId);
  if (!instrumentId) notFound();
  const range = parseChartRange((await searchParams).range);
  const budget = await rateLimiter.consume(marketDataBuckets(user.id, "instrument-detail"));
  if (!budget.allowed) return <PageFrame width="wide" className="max-w-[80rem] pt-6 pb-28 sm:pt-7 sm:pb-10 lg:pt-8">
    <Link href="/lab/portfolio" className="inline-flex min-h-11 items-center text-small font-semibold text-primary-hover">← Portfolio Lab</Link>
    <div className="mt-6"><h1 className="text-page-title font-bold">Instrument teď nelze načíst</h1><Feedback state="warning" role="status" className="mt-5">{marketDataLimitMessage(budget)}</Feedback></div>
  </PageFrame>;
  const [detail, portfolio] = await Promise.all([
    loadInstrumentDetail(portfolioMarketData.service, instrumentId, range, env.MARKET_DATA_PROVIDER === "deterministic" ? new Date(env.DETERMINISTIC_MARKET_NOW ?? FIXTURE_RETRIEVED_AT) : new Date()),
    loadPortfolioView(user.id),
  ]);
  if (detail.instrumentMissing) notFound();
  return <PageFrame width="wide" className="max-w-[80rem] pt-6 pb-28 sm:pt-7 sm:pb-10 lg:pt-8">
    <Link href="/lab/portfolio" className="inline-flex min-h-11 items-center text-small font-semibold text-primary-hover">← Portfolio Lab</Link>
    {detail.instrument ? <InstrumentDetailView instrument={detail.instrument} quote={detail.quote ? {
      price: detail.quote.price,
      observedAt: detail.quote.observedAt,
      status: detail.quote.usability.status,
      marketState: detail.quote.usability.marketState,
    } : null} quoteMessage={detail.quoteMessage} historyMessage={detail.historyMessage} points={detail.points} historyPartial={detail.historyPartial} metrics={detail.metrics} homeCurrency={detail.homeCurrency} homeCurrencyMessage={detail.homeCurrencyMessage} fundamentals={detail.fundamentals} fundamentalsMessage={detail.fundamentalsMessage} etfAnalytics={detail.etfAnalytics} etfAnalyticsMessage={detail.etfAnalyticsMessage} range={range} portfolio={portfolio} />
      : <div className="mt-6"><h1 className="text-page-title font-bold">Instrument není dostupný</h1><Feedback state="warning" role="status" className="mt-5">{detail.metadataMessage}</Feedback></div>}
  </PageFrame>;
}
