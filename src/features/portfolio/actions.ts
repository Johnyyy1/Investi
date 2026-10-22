"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isMarketDataError } from "@/features/market-data/errors";
import { enforceMarketDataBudget } from "@/features/rate-limit";
import { isRequestRateLimitedError } from "@/features/rate-limit/limiter";
import { marketDataLimitMessage } from "@/features/rate-limit/policy";
import { getCurrentUser } from "@/lib/session";
import { requirePortfolioLabUnlock } from "@/features/progression/repository";
import { PortfolioInputError, priceToDecimal, quantityToDecimal, fxToDecimal } from "./decimal";
import { portfolioMarketData } from "./environment";
import { allocationExecutionSchema, allocationInputSchema, idempotencySchema, instrumentIdSchema, tradeInputSchema } from "./input";
import { BROKER_FEE_PROFILES } from "./costs";
import { executeAllocation, executeTrade, resetActivePortfolio, reviewAllocation, reviewTrade, setBrokerFeeProfile } from "./repository";
import { loadAllocationQuotes, loadInstrumentPreview, loadPortfolioView } from "./service";

function messageFor(error: unknown, context: "trade" | "preview" = "trade") {
  const message = tradeMessageFor(error);
  // Nothing was submitted while the order panel is loading, so do not claim a trade was refused.
  return context === "preview" ? message.replace(/ Obchod nebyl proveden\.$/, "") : message;
}

function tradeMessageFor(error: unknown) {
  if (error instanceof PortfolioInputError) return error.message;
  if (isRequestRateLimitedError(error)) return marketDataLimitMessage(error.decision);
  if (error instanceof z.ZodError) return "Mix se nepodařilo přečíst. Zkontroluj váhy a zkus to znovu.";
  if (isMarketDataError(error)) {
    if (error.code === "FxUnavailable") return "Teď nemůžeme přepočítat cenu na koruny. Obchod nebyl proveden.";
    if (error.code === "InstrumentNotFound" || error.code === "UnsupportedInstrument") return "Tento instrument není z nastaveného zdroje tržních dat dostupný.";
    if (error.code === "RateLimited") return "Tržní data jsou dočasně omezená. Zkus to za chvíli znovu.";
    if (error.code === "ProviderAuthentication" || error.code === "ProviderConfiguration") return "Tržní data nejsou správně nastavená. Obchod nebyl proveden.";
    if (error.code === "InvalidSearchQuery") return "Zadej pro hledání alespoň dva platné znaky.";
    return "Aktuální tržní pozorování není dostupné. Obchod nebyl proveden.";
  }
  return "Portfolio se nepodařilo aktualizovat. Zkus to znovu.";
}

async function authenticatedUser() {
  const current = await getCurrentUser();
  if (!current) throw new PortfolioInputError("PortfolioUnavailable", "Relace skončila. Přihlas se znovu a pokračuj v Portfolio Labu.");
  try { await requirePortfolioLabUnlock(current.id); }
  catch { throw new PortfolioInputError("PortfolioUnavailable", "Portfolio Lab je zamčený. Dokonči Základy investování a odemkni ho."); }
  return current;
}

export async function searchPortfolioInstrumentsAction(query: string) {
  try {
    const current = await authenticatedUser();
    const parsed = z.string().trim().min(2).max(80).safeParse(query);
    if (!parsed.success) return { ok: false as const, message: "Zadej pro hledání alespoň dva platné znaky.", results: [] };
    const value = parsed.data;
    await enforceMarketDataBudget(current.id, "search");
    const results = await portfolioMarketData.service.searchInstruments(value);
    return { ok: true as const, results: results.filter(({ assetType }) => assetType !== "cash" && assetType !== "index") };
  } catch (error) {
    return { ok: false as const, message: messageFor(error), results: [] };
  }
}

export async function loadInstrumentPreviewAction(instrumentId: string) {
  try {
    const current = await authenticatedUser();
    const id = instrumentIdSchema.parse(instrumentId);
    await enforceMarketDataBudget(current.id, "instrument-preview");
    const preview = await loadInstrumentPreview(id);
    if (!preview) return { ok: false as const, message: "S tímto instrumentem nelze ve vzdělávacím portfoliu obchodovat." };
    return { ok: true as const, preview };
  } catch (error) {
    return { ok: false as const, message: messageFor(error, "preview") };
  }
}

async function tradeAction(input: unknown, side: "BUY" | "SELL") {
  try {
    const current = await authenticatedUser();
    const parsed = tradeInputSchema.parse(input);
    const result = await executeTrade(current.id, { ...parsed, side }, (lookups) => enforceMarketDataBudget(current.id, "trade", lookups));
    const portfolio = await loadPortfolioView(current.id);
    revalidatePath("/lab/portfolio");
    return { ok: true as const, duplicate: result.duplicate, portfolio };
  } catch (error) {
    return { ok: false as const, message: messageFor(error) };
  }
}

export async function reviewPortfolioTradeAction(input: unknown) {
  try {
    const current = await authenticatedUser();
    const parsed = z.object({ instrumentId: instrumentIdSchema, quantity: z.string().min(1).max(40), side: z.enum(["BUY", "SELL"]) }).strict().parse(input);
    await enforceMarketDataBudget(current.id, "instrument-preview");
    return { ok: true as const, cost: await reviewTrade(current.id, parsed) };
  } catch (error) {
    return { ok: false as const, message: messageFor(error, "preview") };
  }
}

export async function setBrokerFeeProfileAction(input: unknown) {
  try {
    const current = await authenticatedUser();
    const parsed = z.object({ profileId: z.string().refine((id) => BROKER_FEE_PROFILES.some((profile) => profile.id === id)) }).strict().parse(input);
    const feeProfileId = await setBrokerFeeProfile(current.id, parsed.profileId);
    revalidatePath("/lab/portfolio");
    return { ok: true as const, feeProfileId };
  } catch (error) {
    return { ok: false as const, message: messageFor(error) };
  }
}

export async function buyPortfolioAction(input: unknown) {
  return tradeAction(input, "BUY");
}

export async function sellPortfolioAction(input: unknown) {
  return tradeAction(input, "SELL");
}

export async function resetPortfolioAction(input: unknown) {
  try {
    const current = await authenticatedUser();
    const parsed = z.object({ clientIdempotencyKey: idempotencySchema }).parse(input);
    const result = await resetActivePortfolio(current.id, parsed.clientIdempotencyKey);
    const portfolio = await loadPortfolioView(current.id);
    revalidatePath("/lab/portfolio");
    return { ok: true as const, duplicate: result.duplicate, portfolio };
  } catch (error) {
    return { ok: false as const, message: messageFor(error) };
  }
}

export async function loadAllocationQuotesAction(instrumentIds: unknown) {
  try {
    const current = await authenticatedUser();
    const ids = [...new Set(z.array(instrumentIdSchema).min(1).max(24).parse(instrumentIds))];
    await enforceMarketDataBudget(current.id, "allocation-quotes", ids.length);
    return { ok: true as const, quotes: await loadAllocationQuotes(ids) };
  } catch (error) {
    return { ok: false as const, message: messageFor(error) };
  }
}

/** Server-planned estimate of the trades a mix would execute right now. Nothing is written. */
export async function reviewPortfolioAllocationAction(input: unknown) {
  try {
    const current = await authenticatedUser();
    const parsed = allocationInputSchema.parse(input);
    const { plan, observations } = await reviewAllocation(current.id, parsed, (lookups) => enforceMarketDataBudget(current.id, "allocation-quotes", lookups));
    const describe = (instrumentId: string) => {
      const observation = observations.get(instrumentId)!;
      return {
        instrumentId,
        symbol: observation.instrument.symbol,
        name: observation.instrument.name,
        assetType: observation.instrument.assetType,
        quoteCurrency: observation.instrument.quoteCurrency,
        price: priceToDecimal(observation.priceUnits),
        fxRate: fxToDecimal(observation.fxUnits),
        fxReferenceDate: observation.fx.referenceDate,
        isDeterministic: observation.quote.provenance.isDeterministic,
      };
    };
    return {
      ok: true as const,
      review: {
        totalValueMinor: plan.totalValueMinor.toString(),
        targetCashMinor: plan.targetCashMinor.toString(),
        resultingCashMinor: plan.resultingCashMinor.toString(),
        trades: plan.trades.map((trade) => ({ ...describe(trade.instrumentId), side: trade.side, quantity: quantityToDecimal(trade.quantityUnits), grossMinor: trade.grossMinor.toString(), feeBaseMinor: trade.feeBaseMinor.toString(), fxMarkupBaseMinor: trade.fxMarkupBaseMinor.toString(), cashDeltaBaseMinor: trade.cashDeltaBaseMinor.toString() })),
        positions: plan.positions.map((position) => ({
          ...describe(position.instrumentId),
          weightBasisPoints: position.weightBasisPoints,
          targetValueMinor: position.targetValueMinor.toString(),
          currentValueMinor: position.currentValueMinor.toString(),
          resultingValueMinor: position.resultingValueMinor.toString(),
          resultingQuantity: quantityToDecimal(position.resultingQuantityUnits),
        })),
      },
    };
  } catch (error) {
    return { ok: false as const, message: messageFor(error) };
  }
}

export async function savePortfolioAllocationAction(input: unknown) {
  try {
    const current = await authenticatedUser();
    const parsed = allocationExecutionSchema.parse(input);
    const result = await executeAllocation(current.id, parsed, (lookups) => enforceMarketDataBudget(current.id, "allocation", lookups));
    revalidatePath("/lab/portfolio");
    return { ok: true as const, duplicate: result.duplicate, tradeCount: result.tradeCount };
  } catch (error) {
    return { ok: false as const, message: messageFor(error) };
  }
}
