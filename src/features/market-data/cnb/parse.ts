import "server-only";

import type { CalendarDate } from "../contracts";
import { MarketDataError } from "../errors";

export const CNB_PROVIDER_ID = "cnb";

export interface CnbDailyRates {
  /** Declaration date printed on the first line of the file. */
  date: CalendarDate;
  /** CZK per one unit of the currency, already divided by the "množství" column. */
  rates: ReadonlyMap<string, number>;
}

function malformed(reason: string) {
  return new MarketDataError("MalformedProviderResponse", "ČNB returned malformed FX data.", {
    provider: CNB_PROVIDER_ID,
    operation: "response-validation",
    reason,
  });
}

function parseDate(line: string): CalendarDate {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})\b/.exec(line);
  if (!match) throw malformed("invalid-reference-date");
  const value = `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw malformed("invalid-reference-date");
  return value;
}

/** Divides a decimal-comma rate by a power-of-ten amount by shifting the exponent, avoiding float division noise. */
function perUnit(rateText: string, amountText: string) {
  if (!/^\d+(?:,\d+)?$/.test(rateText) || !/^[1-9]\d*$/.test(amountText)) return null;
  const rate = rateText.replace(",", ".");
  const amount = Number(amountText);
  const exponent = Math.log10(amount);
  const value = Number.isInteger(exponent) ? Number(`${rate}e-${exponent}`) : Number(rate) / amount;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Parses the ČNB daily fixing (`denni_kurz.txt`):
 * line 1 is "DD.MM.YYYY #n", line 2 the header, then "země|měna|množství|kód|kurz" rows.
 */
export function parseCnbDailyRates(text: string): CnbDailyRates {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) throw malformed("missing-rows");
  const date = parseDate(lines[0]);
  if (!lines[1].toLocaleLowerCase("cs-CZ").includes("kód")) throw malformed("missing-header");

  const rates = new Map<string, number>();
  for (const line of lines.slice(2)) {
    const columns = line.split("|").map((column) => column.trim());
    if (columns.length !== 5) throw malformed("invalid-row");
    const [, , amountText, code, rateText] = columns;
    if (!/^[A-Z]{3}$/.test(code)) throw malformed("invalid-currency-code");
    const value = perUnit(rateText, amountText);
    if (value === null) throw malformed("invalid-rate");
    rates.set(code, value);
  }
  return { date, rates };
}
