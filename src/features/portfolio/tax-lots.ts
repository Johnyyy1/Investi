import { getFact, isFactPending } from "@/features/facts/registry";
import { factToday } from "@/features/facts/resolve";
import type { FactVersion } from "@/features/facts/types";
import { decimalToQuantityUnits, quantityToDecimal, roundDivide } from "./decimal";
import type { TradeSide } from "./domain";

export interface TaxLotTrade {
  id: string;
  instrumentId: string;
  instrumentSymbol: string;
  side: TradeSide;
  quantity: string;
  grossAmountBaseMinor: bigint;
  feeBaseMinor: bigint;
  executedAt: Date;
}

export interface TaxLot {
  tradeId: string;
  instrumentId: string;
  symbol: string;
  acquiredAt: Date;
  remainingUnits: bigint;
  /** Remaining all-in purchase cost (execution notional + commission) in CZK minor units. */
  remainingCostMinor: bigint;
}

export interface TaxLotMatch { lotTradeId: string; acquiredAt: Date; quantityUnits: bigint; costMinor: bigint }

export interface TaxSale {
  tradeId: string;
  instrumentId: string;
  symbol: string;
  soldAt: Date;
  quantityUnits: bigint;
  /** Gross sale proceeds before commission, at the Lab's execution FX — not a tax exchange rate. */
  proceedsMinor: bigint;
  feeMinor: bigint;
  matches: TaxLotMatch[];
}

/**
 * Educational tranche map over the ordered immutable ledger. FIFO is a stated simulation
 * assumption: the pairing rule for a non-accounting individual awaits review
 * (`dan.parovani_transi`, #134). It is independent of the Lab's weighted-average P&L,
 * and deliberately has no time-test date predicate (`dan.datum_casoveho_testu`).
 */
export function taxLots(trades: readonly TaxLotTrade[]) {
  const queues = new Map<string, TaxLot[]>();
  const sales: TaxSale[] = [];
  for (const trade of trades) {
    const quantityUnits = decimalToQuantityUnits(trade.quantity);
    const queue = queues.get(trade.instrumentId) ?? [];
    queues.set(trade.instrumentId, queue);
    if (trade.side === "BUY") {
      queue.push({
        tradeId: trade.id, instrumentId: trade.instrumentId, symbol: trade.instrumentSymbol, acquiredAt: trade.executedAt,
        remainingUnits: quantityUnits, remainingCostMinor: trade.grossAmountBaseMinor + trade.feeBaseMinor,
      });
      continue;
    }
    const matches: TaxLotMatch[] = [];
    let open = quantityUnits;
    while (open > 0n) {
      const lot = queue[0];
      if (!lot) throw new Error(`Trade ledger oversells ${trade.instrumentId}.`);
      const taken = open < lot.remainingUnits ? open : lot.remainingUnits;
      // A fully consumed lot takes its exact remainder, so rounding never leaks between lots.
      const costMinor = taken === lot.remainingUnits ? lot.remainingCostMinor : roundDivide(lot.remainingCostMinor * taken, lot.remainingUnits);
      matches.push({ lotTradeId: lot.tradeId, acquiredAt: lot.acquiredAt, quantityUnits: taken, costMinor });
      lot.remainingUnits -= taken;
      lot.remainingCostMinor -= costMinor;
      open -= taken;
      if (lot.remainingUnits === 0n) queue.shift();
    }
    sales.push({
      tradeId: trade.id, instrumentId: trade.instrumentId, symbol: trade.instrumentSymbol, soldAt: trade.executedAt,
      quantityUnits, proceedsMinor: trade.grossAmountBaseMinor, feeMinor: trade.feeBaseMinor, matches,
    });
  }
  return { lots: [...queues.values()].flat().sort((a, b) => a.acquiredAt.getTime() - b.acquiredAt.getTime()), sales };
}

/** Calendar year in Europe/Prague, matching the fact registry's dates. */
export function pragueYear(at: Date) {
  return Number(factToday(at).slice(0, 4));
}

/** Gross sale proceeds of one calendar year, the sum compared with `dan.limit_100k` (income, not gain). */
export function yearSaleProceedsMinor(sales: readonly TaxSale[], year: number) {
  return sales.reduce((sum, sale) => pragueYear(sale.soldAt) === year ? sum + sale.proceedsMinor : sum, 0n);
}

/** Serializable "Daňový pohled" of the Lab. The limit shows only while a verified version
 * applies to `asOf`; another year's rule is never reused. */
export function presentTaxView(trades: readonly TaxLotTrade[], asOf: Date) {
  const { lots, sales } = taxLots(trades);
  const year = pragueYear(asOf);
  let limit: FactVersion | null = null;
  try {
    limit = getFact("dan.limit_100k", factToday(asOf));
  } catch {
    limit = null;
  }
  const amount = limit?.value.amount;
  const usable = limit && !isFactPending(limit) && typeof amount === "number" ? { amount, verifiedAt: limit.verifiedAt } : null;
  return {
    year,
    proceedsMinor: yearSaleProceedsMinor(sales, year).toString(),
    saleCount: sales.filter(({ soldAt }) => pragueYear(soldAt) === year).length,
    limitMinor: usable ? (BigInt(usable.amount) * 100n).toString() : null,
    limitVerifiedAt: usable?.verifiedAt ?? null,
    lots: lots.map((lot) => ({
      tradeId: lot.tradeId, symbol: lot.symbol, acquiredAt: lot.acquiredAt.toISOString(),
      quantity: quantityToDecimal(lot.remainingUnits), costMinor: lot.remainingCostMinor.toString(),
    })),
  };
}
export type TaxView = ReturnType<typeof presentTaxView>;

export interface TaxRecordTrade extends TaxLotTrade {
  instrumentName: string;
  unitPrice: string;
  quoteCurrency: string;
  fxRateToBase: string;
  referenceFxRateToBase: string | null;
  fxRateProvider: string | null;
  fxReferenceDate: string | null;
  fxRateIsDeterministic: boolean | null;
  marketDataIsDeterministic: boolean;
  fxMarkupBaseMinor: bigint | null;
  feeProfileId: string | null;
  cashDeltaBaseMinor: bigint;
}

const recordColumns = [
  "Datum obchodu", "Číslo obchodu", "Instrument", "Název", "Směr", "Množství", "Cena", "Měna", "Kurz obchodu", "Referenční kurz",
  "Zdroj kurzu", "Datum kurzu", "Poplatek Kč", "Přirážka za konverzi Kč", "Částka v Kč", "Peněžní tok Kč", "Cvičný tarif", "Tranše (FIFO, předpoklad)", "Data",
];
const pragueDateTime = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague", dateStyle: "short", timeStyle: "short" });
/** Czech spreadsheet convention: decimal comma, no trailing zeros. */
const decimal = (value: string) => (value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value).replace(".", ",");
const kc = (minor: bigint) => {
  const absolute = minor < 0n ? -minor : minor;
  return `${minor < 0n ? "-" : ""}${absolute / 100n},${(absolute % 100n).toString().padStart(2, "0")}`;
};
const cell = (value: string) => /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
/** Provider text must not run as a spreadsheet formula. */
const text = (value: string) => /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

/** Semicolon CSV of the active generation's practice trades in the record format of lesson 2.4.9. */
export function taxRecordCsv(trades: readonly TaxRecordTrade[], exportedAt: Date) {
  const sales = new Map(taxLots(trades).sales.map((sale) => [sale.tradeId, sale]));
  const preamble = `# Investník Portfolio Lab: cvičné obchody nanečisto. Vzdělávací evidence, ne daňový doklad ani poradenství; stav k ${factToday(exportedAt)}. `
    + "Párování tranší FIFO je předpoklad simulace, správná metoda čeká na odborné ověření. Částky v Kč používají kurz obchodu v Labu, ne daňový kurz.";
  const rows = trades.map((trade) => {
    const sale = sales.get(trade.id);
    const lots = sale
      ? sale.matches.map((match) => `${match.lotTradeId} (${factToday(match.acquiredAt)}) × ${decimal(quantityToDecimal(match.quantityUnits))}`).join(" | ")
      : `nová tranše ${trade.id}`;
    const fxSource = trade.fxRateProvider ? `${trade.fxRateProvider}${trade.fxRateIsDeterministic ? " (ukázková data)" : ""}` : "neuvedeno";
    return [
      pragueDateTime.format(trade.executedAt), trade.id, text(trade.instrumentSymbol), text(trade.instrumentName), trade.side === "BUY" ? "Nákup" : "Prodej",
      decimal(trade.quantity), decimal(trade.unitPrice), trade.quoteCurrency, decimal(trade.fxRateToBase), trade.referenceFxRateToBase ? decimal(trade.referenceFxRateToBase) : "",
      fxSource, trade.fxReferenceDate ?? "", kc(trade.feeBaseMinor), trade.fxMarkupBaseMinor === null ? "" : kc(trade.fxMarkupBaseMinor),
      kc(trade.grossAmountBaseMinor), kc(trade.cashDeltaBaseMinor), trade.feeProfileId ?? "", lots, trade.marketDataIsDeterministic ? "ukázková data" : "tržní data",
    ].map(cell).join(";");
  });
  // BOM lets Excel read the diacritics as UTF-8.
  return `\uFEFF${[cell(preamble), recordColumns.join(";"), ...rows].join("\r\n")}\r\n`;
}
