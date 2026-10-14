import "server-only";

import type { Currency, FxRate, Instrument, MarketSessionState, Quote, QuoteUsabilityStatus, UtcTimestamp } from "@/features/market-data/contracts";
import type { FxDataProviderName, MarketDataProviderName } from "@/features/market-data/composition";
import { isMarketDataError, MarketDataError } from "@/features/market-data/errors";
import type { MarketDataService } from "@/features/market-data/service";
import {
  fxToDecimal,
  fxUnitsFromNumber,
  grossBaseMinor,
  parseQuantity,
  PortfolioInputError,
  priceToDecimal,
  priceUnitsFromNumber,
} from "./decimal";

export interface PortfolioMarketDataGateway {
  provider: MarketDataProviderName;
  fxProvider: FxDataProviderName;
  service: MarketDataService;
}

export type PortfolioMarketDataMode = "sample" | "market";
export type ValuationUnavailableReason = "quote" | "fx" | "instrument" | "rate-limit" | "provider";

export interface PortfolioExecutionObservation {
  instrument: Instrument;
  quote: Quote;
  quantityUnits: bigint;
  priceUnits: bigint;
  fxUnits: bigint;
  grossMinor: bigint;
  fx: FxRate;
}

export interface PortfolioHoldingMarketObservation {
  instrumentId: string;
  marketValueMinor: bigint | null;
  currentPrice: string | null;
  currentPriceCurrency: Currency | null;
  quoteObservedAt: UtcTimestamp | null;
  quoteRetrievedAt: UtcTimestamp | null;
  quoteUsability: QuoteUsabilityStatus | null;
  marketSessionState: MarketSessionState | null;
  usableForExecution: boolean;
  fxReferenceDate: string | null;
  fxRetrievedAt: UtcTimestamp | null;
  fxProvider: string | null;
  /** Current valuation FX (base per quote unit) as a 12 dp decimal string. */
  fxRate: string | null;
  unavailableReason?: ValuationUnavailableReason;
}

export interface PortfolioInstrumentPreview {
  instrument: Instrument;
  price: string;
  /** Null when no CZK rate is available; the native price is still shown and buying is blocked. */
  estimatedUnitCostBaseMinor: string | null;
  quoteObservedAt: UtcTimestamp;
  quoteRetrievedAt: UtcTimestamp;
  /** CZK per quote-currency unit as a 12 dp decimal string. */
  fxRate: string | null;
  fxReferenceDate: string | null;
  fxProvider: string | null;
  provider: string;
  dataset: string;
  marketDataMode: PortfolioMarketDataMode;
  quoteUsability: QuoteUsabilityStatus;
  marketSessionState: MarketSessionState;
  usableForExecution: boolean;
}

export function marketDataMode(gateway: PortfolioMarketDataGateway): PortfolioMarketDataMode {
  return gateway.provider === "deterministic" ? "sample" : "market";
}

export function assertCompatibleInstrumentId(gateway: PortfolioMarketDataGateway, instrumentId: string) {
  const fmpIdentity = instrumentId.startsWith("FMP:");
  const compatible = gateway.provider === "fmp" ? fmpIdentity : !fmpIdentity;
  if (!compatible) {
    throw new MarketDataError("UnsupportedInstrument", "This persisted instrument belongs to a different market-data provider.", {
      configuredProvider: gateway.provider,
      instrumentId,
    });
  }
}

function assertTradeable(instrument: Instrument) {
  if (instrument.assetType === "cash" || instrument.assetType === "index") {
    throw new PortfolioInputError("InvalidInstrument", "Pro toto vzdělávací portfolio vyber akcii, ETF nebo dluhopis.");
  }
}

function assertQuoteMatchesInstrument(instrument: Instrument, quote: Quote) {
  if (quote.instrumentId !== instrument.instrumentId || quote.currency !== instrument.quoteCurrency) {
    throw new MarketDataError("MalformedProviderResponse", "The quote does not match the resolved instrument.", {
      instrumentId: instrument.instrumentId,
      operation: "portfolio-execution",
    });
  }
}

export async function observePortfolioExecution(
  gateway: PortfolioMarketDataGateway,
  instrumentId: string,
  quantity: string,
  baseCurrency: Currency,
): Promise<PortfolioExecutionObservation> {
  assertCompatibleInstrumentId(gateway, instrumentId);
  const quantityUnits = parseQuantity(quantity);
  const instrument = await gateway.service.getInstrumentMetadata(instrumentId);
  assertTradeable(instrument);
  const quote = await gateway.service.getQuote(instrument.instrumentId);
  assertQuoteMatchesInstrument(instrument, quote);
  if (!quote.usability.usableForExecution) {
    if (quote.usability.marketState === "closed") {
      throw new PortfolioInputError("MarketClosed", "Trh je nyní zavřený. Nové simulované investice vyžadují aktuální tržní pozorování.");
    }
    throw new PortfolioInputError("QuoteUnavailable", "Aktuální tržní pozorování není pro simulaci tohoto obchodu dost čerstvé.");
  }
  const fx = await gateway.service.getFxRate(quote.currency, baseCurrency, quote.observedAt);
  const priceUnits = priceUnitsFromNumber(quote.price);
  const fxUnits = fxUnitsFromNumber(fx.rate);
  const grossMinor = grossBaseMinor(quantityUnits, priceUnits, fxUnits);
  if (grossMinor <= 0n) throw new PortfolioInputError("InvalidQuantity", "Toto množství je příliš malé na obchodní hodnotu alespoň jeden haléř.");
  return {
    instrument,
    quote,
    quantityUnits,
    priceUnits,
    fxUnits,
    grossMinor,
    fx,
  };
}

export async function loadPortfolioInstrumentPreview(
  gateway: PortfolioMarketDataGateway,
  instrumentId: string,
): Promise<PortfolioInstrumentPreview | null> {
  assertCompatibleInstrumentId(gateway, instrumentId);
  const instrument = await gateway.service.getInstrumentMetadata(instrumentId);
  if (instrument.assetType === "cash" || instrument.assetType === "index") return null;
  const quote = await gateway.service.getQuote(instrumentId);
  assertQuoteMatchesInstrument(instrument, quote);
  if (!quote.usability.usableForValuation) return null;
  let fx: FxRate | null = null;
  try {
    fx = await gateway.service.getFxRate(quote.currency, "CZK", quote.observedAt);
  } catch (error) {
    if (!isMarketDataError(error)) throw error;
    console.error("[portfolio:preview] CZK rate unavailable", { instrumentId, currency: quote.currency, code: error.code, message: error.message, context: error.context });
  }
  const priceUnits = priceUnitsFromNumber(quote.price);
  const fxUnits = fx ? fxUnitsFromNumber(fx.rate) : null;
  return {
    instrument,
    price: priceToDecimal(priceUnits),
    estimatedUnitCostBaseMinor: fxUnits === null ? null : grossBaseMinor(parseQuantity("1"), priceUnits, fxUnits).toString(),
    quoteObservedAt: quote.observedAt,
    quoteRetrievedAt: quote.retrievedAt,
    fxRate: fxUnits === null ? null : fxToDecimal(fxUnits),
    fxReferenceDate: fx?.referenceDate ?? null,
    fxProvider: fx?.provenance.provider ?? null,
    provider: quote.provenance.provider,
    dataset: quote.provenance.dataset,
    marketDataMode: quote.provenance.isDeterministic ? "sample" : "market",
    quoteUsability: quote.usability.status,
    marketSessionState: quote.usability.marketState,
    usableForExecution: quote.usability.usableForExecution,
  };
}

function failureReason(error: unknown, operation: "quote" | "fx"): ValuationUnavailableReason {
  if (!isMarketDataError(error)) return "provider";
  if (error.code === "RateLimited") return "rate-limit";
  if (error.code === "InstrumentNotFound" || error.code === "UnsupportedInstrument") return "instrument";
  if (error.code === "FxUnavailable") return "fx";
  if (["ProviderAuthentication", "ProviderConfiguration", "ProviderUnavailable", "MalformedProviderResponse"].includes(error.code)) return "provider";
  return operation;
}

function unavailableHolding(instrumentId: string, reason: ValuationUnavailableReason): PortfolioHoldingMarketObservation {
  return {
    instrumentId,
    marketValueMinor: null,
    currentPrice: null,
    currentPriceCurrency: null,
    quoteObservedAt: null,
    quoteRetrievedAt: null,
    quoteUsability: null,
    marketSessionState: null,
    usableForExecution: false,
    fxReferenceDate: null,
    fxRetrievedAt: null,
    fxProvider: null,
    fxRate: null,
    unavailableReason: reason,
  };
}

export async function observePortfolioHoldingValue(
  gateway: PortfolioMarketDataGateway,
  holding: { instrumentId: string; quantityUnits: bigint },
  baseCurrency: Currency,
): Promise<PortfolioHoldingMarketObservation> {
  try {
    assertCompatibleInstrumentId(gateway, holding.instrumentId);
  } catch (error) {
    return unavailableHolding(holding.instrumentId, failureReason(error, "quote"));
  }

  let quote: Quote;
  try {
    quote = await gateway.service.getQuote(holding.instrumentId);
    if (!quote.usability.usableForValuation) return unavailableHolding(holding.instrumentId, "quote");
  } catch (error) {
    return unavailableHolding(holding.instrumentId, failureReason(error, "quote"));
  }

  try {
    // Current valuation uses the current reference FX fixing independently from the security observation.
    const fx = await gateway.service.getFxRate(quote.currency, baseCurrency, quote.retrievedAt);
    const priceUnits = priceUnitsFromNumber(quote.price);
    const fxUnits = fxUnitsFromNumber(fx.rate);
    return {
      instrumentId: holding.instrumentId,
      marketValueMinor: grossBaseMinor(holding.quantityUnits, priceUnits, fxUnits),
      currentPrice: priceToDecimal(priceUnits),
      currentPriceCurrency: quote.currency,
      quoteObservedAt: quote.observedAt,
      quoteRetrievedAt: quote.retrievedAt,
      quoteUsability: quote.usability.status,
      marketSessionState: quote.usability.marketState,
      usableForExecution: quote.usability.usableForExecution,
      fxReferenceDate: fx.referenceDate,
      fxRetrievedAt: fx.retrievedAt,
      fxProvider: fx.provenance.provider,
      fxRate: fxToDecimal(fxUnits),
    };
  } catch (error) {
    return unavailableHolding(holding.instrumentId, failureReason(error, "fx"));
  }
}

export type AllocationQuoteStatus = "executable" | "market-closed" | "stale" | "unavailable" | "unsupported";

export interface AllocationQuote {
  instrumentId: string;
  status: AllocationQuoteStatus;
  instrument: Instrument | null;
  /** Native price and the estimated CZK cost of one unit; present whenever the quote is usable for valuation. */
  price: string | null;
  unitCostBaseMinor: string | null;
  fxRate: string | null;
  fxReferenceDate: string | null;
  quoteObservedAt: UtcTimestamp | null;
  marketDataMode: PortfolioMarketDataMode | null;
}

/**
 * Builder status for one instrument. Unlike execution it never throws for an unusable
 * quote: it says why the instrument cannot be bought right now, and it never turns a
 * missing price into zero. The authoritative check is repeated when the mix is executed.
 */
export async function observeAllocationQuote(
  gateway: PortfolioMarketDataGateway,
  instrumentId: string,
  baseCurrency: Currency,
): Promise<AllocationQuote> {
  const empty = { instrument: null, price: null, unitCostBaseMinor: null, fxRate: null, fxReferenceDate: null, quoteObservedAt: null, marketDataMode: null };
  try {
    assertCompatibleInstrumentId(gateway, instrumentId);
    const instrument = await gateway.service.getInstrumentMetadata(instrumentId);
    if (instrument.assetType === "cash" || instrument.assetType === "index") return { instrumentId, status: "unsupported", ...empty, instrument };
    const quote = await gateway.service.getQuote(instrument.instrumentId);
    assertQuoteMatchesInstrument(instrument, quote);
    const status: AllocationQuoteStatus = quote.usability.usableForExecution ? "executable"
      : quote.usability.marketState === "closed" ? "market-closed"
        : quote.usability.usableForValuation ? "stale" : "unavailable";
    if (!quote.usability.usableForValuation) return { instrumentId, status, ...empty, instrument };
    const fx = await gateway.service.getFxRate(quote.currency, baseCurrency, quote.observedAt);
    const priceUnits = priceUnitsFromNumber(quote.price);
    const fxUnits = fxUnitsFromNumber(fx.rate);
    return {
      instrumentId,
      status,
      instrument,
      price: priceToDecimal(priceUnits),
      unitCostBaseMinor: grossBaseMinor(parseQuantity("1"), priceUnits, fxUnits).toString(),
      fxRate: fxToDecimal(fxUnits),
      fxReferenceDate: fx.referenceDate,
      quoteObservedAt: quote.observedAt,
      marketDataMode: quote.provenance.isDeterministic ? "sample" : "market",
    };
  } catch (error) {
    if (isMarketDataError(error) && (error.code === "InstrumentNotFound" || error.code === "UnsupportedInstrument")) return { instrumentId, status: "unsupported", ...empty };
    return { instrumentId, status: "unavailable", ...empty };
  }
}
