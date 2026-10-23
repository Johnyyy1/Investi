import { OVERFITTING_NOTICE_AT } from "@/features/backtesting/attempts";
import { ipsSchema } from "@/features/ips/schema";
import type { TradeSide } from "./domain";

/** Decision-time cards: deterministic rules over a planned action. A card informs and never blocks it. */
export type DecisionCardKind = "outside-ips" | "disposition" | "turnover" | "overfitting";

/** Copy and the lesson each card links to; `lessonLink` hides the link until that lesson is published. */
export const DECISION_CARDS: Record<DecisionCardKind, { title: string; body: string; lessonId: string }> = {
  "outside-ips": {
    title: "Tento nákup není ve tvém plánu",
    body: "Mix v tvém investičním plánu tento instrument neobsahuje. Pokud jde o změnu plánu, zapiš si nejdřív důvod. Nákup tím není zakázaný.",
    lessonId: "before-investing-goals",
  },
  disposition: {
    title: "Prodáváš pozici v zisku a ztrátové držíš",
    body: "Častý vzorec je prodávat vítěze a čekat, až se ztrátové pozice vrátí. Rozhoduj podle plánu a dnešního pohledu na každou pozici, ne podle nákupní ceny. Jeden prodej sám chybu neprokazuje.",
    lessonId: "volatility-max-drawdown",
  },
  turnover: {
    title: "Pět a více obchodů za posledních 7 dní",
    body: "Každý obchod stojí poplatek a konverzi a časté změny vzdalují portfolio od plánu. Zkontroluj, jestli tenhle obchod plán opravdu potřebuje.",
    lessonId: "foundations-markets",
  },
  overfitting: {
    title: "Pět a více různých pokusů pro jeden cíl",
    body: "Výběr nejlepšího minulého výsledku může zachytit náhodu. Před dalším pokusem si zapiš pravidlo a ověř ho na datech, která nesloužila k jeho ladění. Počet pokusů sám neprokazuje chybu.",
    lessonId: "correlation-not-causation",
  },
};

export const TURNOVER_CARD_TRADES = 5;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface TradeCardInput {
  side: TradeSide;
  instrumentId: string;
  now: Date;
  /** Executed trades of the active generation. */
  trades: readonly { executedAt: Date }[];
  /** Unrealized gain per holding; null while its valuation is unavailable. */
  holdings: readonly { instrumentId: string; gainLossMinor: bigint | null }[];
  /** Latest saved investment plan payload, if any. */
  ips: unknown;
}

/** Applicable cards in display priority. A missing valuation or plan yields no card, never a failure. */
export function tradeDecisionCards(input: TradeCardInput): DecisionCardKind[] {
  const cards: DecisionCardKind[] = [];
  const plan = ipsSchema.safeParse(input.ips);
  // Asset-class plans cannot be matched to one instrument without guessing its class.
  const planned = plan.success && plan.data.allocation.lines.every((line) => "instrumentId" in line)
    ? plan.data.allocation.lines.map((line) => "instrumentId" in line ? line.instrumentId : "") : null;
  if (input.side === "BUY" && planned && !planned.includes(input.instrumentId)) cards.push("outside-ips");
  const sold = input.holdings.find(({ instrumentId }) => instrumentId === input.instrumentId);
  if (input.side === "SELL" && sold?.gainLossMinor != null && sold.gainLossMinor > 0n
    && input.holdings.some(({ instrumentId, gainLossMinor }) => instrumentId !== input.instrumentId && gainLossMinor != null && gainLossMinor < 0n)) cards.push("disposition");
  const now = input.now.getTime();
  const recent = input.trades.filter(({ executedAt }) => executedAt.getTime() > now - WEEK_MS && executedAt.getTime() <= now).length;
  if (recent + 1 >= TURNOVER_CARD_TRADES) cards.push("turnover");
  return cards;
}

export function backtestDecisionCards(attemptsForGoal: number): DecisionCardKind[] {
  return attemptsForGoal >= OVERFITTING_NOTICE_AT ? ["overfitting"] : [];
}

/** A learner-written rule from the saved safeguards output (#127). */
export interface Safeguard { trigger: string; action: string }

export interface DecisionCardPreferences { disabled: DecisionCardKind[]; shownAt: Partial<Record<DecisionCardKind, number>> }
export const DECISION_CARD_PREFERENCES_KEY = "investi:decision-cards:v1";
export const DECISION_CARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const kinds = Object.keys(DECISION_CARDS) as DecisionCardKind[];

export function readDecisionCardPreferences(value: string | null): DecisionCardPreferences {
  try {
    const parsed = JSON.parse(value ?? "{}") as Partial<DecisionCardPreferences>;
    const shownAt = Object.fromEntries(Object.entries(parsed.shownAt ?? {}).filter(([kind, at]) => kinds.includes(kind as DecisionCardKind) && Number.isFinite(at)));
    return { disabled: (parsed.disabled ?? []).filter((kind) => kinds.includes(kind)), shownAt };
  } catch {
    return { disabled: [], shownAt: {} };
  }
}

/** At most one card per action: the first candidate the learner has not turned off or seen within the cooldown. */
export function pickDecisionCard(candidates: readonly DecisionCardKind[], preferences: DecisionCardPreferences, now: number): DecisionCardKind | null {
  return candidates.find((kind) => !preferences.disabled.includes(kind) && now - (preferences.shownAt[kind] ?? -Infinity) >= DECISION_CARD_COOLDOWN_MS) ?? null;
}
