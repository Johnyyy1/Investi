import { scaledToDecimal } from "@/features/portfolio/decimal";
import { ipsSchema, type IpsPlan } from "./schema";
import type { ArtifactPayload } from "@/features/artifacts/schemas";

export const assetLabels = { equity: "Akcie", bonds: "Dluhopisy", other: "Ostatní" };
export const frequencyLabels = { monthly: "Každý měsíc", quarterly: "Každé čtvrtletí", annually: "Jednou ročně" };
export const actionLabels = { keep_plan: "Držet se plánu", review_plan: "Znovu posoudit plán", pause_contributions: "Pozastavit příspěvky", other: "Vlastní postup" };
export const reserveLabels = { building: "Rezervu tvořím", ready_for_goal: "Rezerva odpovídá mému cíli", needs_review: "Potřebuji ji prověřit", prefer_not_to_say: "Nechci uvádět" };
export const debtLabels = { none: "Bez drahého dluhu", plan_needed: "Potřebuji plán splácení", prefer_not_to_say: "Nechci uvádět" };
export const purposeLabels = { reserve: "Rezerva", housing: "Bydlení", retirement: "Důchod", education: "Vzdělání", other: "Jiný cíl" };
export const priorityLabels = { essential: "Nezbytný", important: "Důležitý", optional: "Volitelný" };
export const percentText = (bps: number) => scaledToDecimal(BigInt(bps), 2).replace(".", ",");
export const monthLabel = (month: number) => new Intl.DateTimeFormat("cs-CZ", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month - 1, 1)));
export const ipsDate = (value: string) => new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }).format(new Date(value));

/** Parse decimal text exactly; reject extra precision instead of silently rounding the learner's intent. */
export function decimalToMinor(value: string): string {
  const match = /^(\d{1,13})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error("Zadej nezáporné číslo s nejvýše dvěma desetinnými místy.");
  return (BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"))).toString();
}
export function decimalToBps(value: string): number {
  const units = BigInt(decimalToMinor(value));
  if (units > 10000n) throw new Error("Váha musí být mezi 0 a 100 %.");
  return Number(units);
}

export type IpsDraft = {
  goals: IpsPlan["goals"];
  foundation: IpsPlan["foundation"];
  lines: { type: "equity" | "bonds" | "other" | "instrument"; instrumentId: string; label: string; weight: string }[];
  cash: string; instruments: string; platform: string; amount: string; day: string;
  mode: IpsPlan["rebalancing"]["mode"]; band: string; rebalanceMonth: string;
  action: IpsPlan["drawdownRule"]["action"]; drawdown: string;
  frequency: IpsPlan["checkFrequency"]; reviewMonth: string; reason: string;
};
export function newIpsDraft(goals?: IpsPlan["goals"]): IpsDraft {
  return { goals: goals ?? [{ label: "", purpose: "other", horizonMonths: 0, priority: "important" }],
    foundation: { emergencyFund: "prefer_not_to_say", highCostDebt: "prefer_not_to_say" },
    lines: [], cash: "", instruments: "", platform: "", amount: "", day: "", mode: "contributions", band: "", rebalanceMonth: "",
    action: "review_plan", drawdown: "", frequency: "annually", reviewMonth: "", reason: "" };
}
export function draftFromPlan(payload: ArtifactPayload<"investment_plan">): IpsDraft {
  if (!("schemaVersion" in payload)) {
    return { ...newIpsDraft(payload.goals), cash: percentText(payload.allocation.find((line) => line.assetClass === "cash")?.weightBasisPoints ?? 0),
      lines: payload.allocation.filter((line) => line.assetClass !== "cash").map((line) => ({ type: line.assetClass as "equity" | "bonds" | "other", instrumentId: "", label: "", weight: percentText(line.weightBasisPoints) })),
      frequency: payload.reviewFrequency, drawdown: payload.crisisPlan };
  }
  return { ...newIpsDraft(payload.goals), foundation: payload.foundation,
    lines: payload.allocation.lines.map((line) => ({ type: "instrumentId" in line ? "instrument" : line.assetClass, instrumentId: "instrumentId" in line ? line.instrumentId : "", label: "instrumentId" in line ? line.instrumentId : "", weight: percentText(line.weightBps) })),
    cash: percentText(payload.allocation.cashBps), instruments: payload.instruments.join("\n"), platform: payload.platform,
    amount: scaledToDecimal(BigInt(payload.contribution.amountMinor), 2), day: String(payload.contribution.dayOfMonth),
    mode: payload.rebalancing.mode, band: payload.rebalancing.mode === "band" ? percentText(payload.rebalancing.bandBps) : "",
    rebalanceMonth: payload.rebalancing.mode === "calendar" ? String(payload.rebalancing.month) : "",
    action: payload.drawdownRule.action, drawdown: payload.drawdownRule.text, frequency: payload.checkFrequency,
    reviewMonth: String(payload.reviewMonth), reason: "" };
}
export function planFromDraft(draft: IpsDraft, signedAt: string): IpsPlan {
  return ipsSchema.parse({ schemaVersion: 2, goals: draft.goals, foundation: draft.foundation,
    allocation: { lines: draft.lines.map((line) => ({ ...(line.type === "instrument" ? { instrumentId: line.instrumentId } : { assetClass: line.type }), weightBps: decimalToBps(line.weight) })), cashBps: decimalToBps(draft.cash) },
    instruments: draft.instruments.split("\n").map((text) => text.trim()).filter(Boolean), platform: draft.platform,
    contribution: { amountMinor: decimalToMinor(draft.amount), dayOfMonth: Number(draft.day) },
    rebalancing: draft.mode === "calendar" ? { mode: draft.mode, month: Number(draft.rebalanceMonth) } : draft.mode === "band" ? { mode: draft.mode, bandBps: decimalToBps(draft.band) } : { mode: draft.mode },
    drawdownRule: { action: draft.action, text: draft.drawdown }, checkFrequency: draft.frequency, reviewMonth: Number(draft.reviewMonth), changeReason: draft.reason, signedAt });
}
