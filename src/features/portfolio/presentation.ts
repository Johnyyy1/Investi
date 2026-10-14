import type { PortfolioMarketDataMode } from "./market-data";

export function portfolioDataSourceLabel(mode: PortfolioMarketDataMode) {
  return mode === "sample" ? "Ukázková data" : "Tržní pozorování";
}

export function showSampleDataIndicator(mode: PortfolioMarketDataMode) {
  return mode === "sample";
}

export type GainLossState = "unavailable" | "positive" | "negative" | "neutral";

export function gainLossState(value: string | null): GainLossState {
  if (value === null) return "unavailable";
  const amount = BigInt(value);
  if (amount > 0n) return "positive";
  if (amount < 0n) return "negative";
  return "neutral";
}

function fxSourceName(provider: string | null) {
  if (provider === "cnb") return "Kurz ČNB";
  if (provider?.includes("frankfurter")) return "Referenční kurz ECB";
  if (provider === "investi-deterministic") return "Ukázkový kurz";
  return "Kurz";
}

/** "Kurz ČNB 21,745 Kč/USD ze dne 13. 10. 2026" — the rate actually used for a CZK conversion. */
export function fxRateLabel(provider: string | null, rate: number | string, currency: string, referenceDate: string) {
  const formattedRate = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(rate));
  const formattedDate = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${referenceDate}T00:00:00.000Z`));
  return `${fxSourceName(provider)} ${formattedRate} Kč/${currency} ze dne ${formattedDate}`;
}

export const FX_UNAVAILABLE_MESSAGE = "Teď nemůžeme přepočítat cenu na koruny. Nákup zkus prosím později.";
