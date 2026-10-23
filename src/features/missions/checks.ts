import { z } from "zod";
import { evaluateScenario, lessonInstrumentIds } from "@/features/lessons/diversification/model";
import { ipsSchema } from "@/features/ips/schema";

const percent = z.number().int().min(0).max(100).multipleOf(10);
export const scenarioDecisionSchema = z.strictObject({
  allocation: z.strictObject(Object.fromEntries(lessonInstrumentIds.map((id) => [id, percent])) as Record<(typeof lessonInstrumentIds)[number], typeof percent>)
    .refine((allocation) => Object.values(allocation).reduce((sum, value) => sum + value, 0) <= 100),
  prediction: z.enum(["pass", "fail"]),
});
export type ScenarioDecision = z.infer<typeof scenarioDecisionSchema>;

/** No prices, return target or client verdict enters the process criteria. */
export function checkScenario(input: unknown) {
  const decision = scenarioDecisionSchema.parse(input);
  const result = evaluateScenario(decision.allocation);
  return { decision, completed: result.passed, rules: result.rules.map(({ id, label, percent, maxPercent, pass }) => ({ id, label, percent, maxPercent, pass })) };
}

export type PurchaseEvidence = { id: string; instrumentId: string; instrumentAssetType: string; side: string; executedAt: Date };
export function checkIpsPurchase(payload: unknown, planCreatedAt: Date, trades: readonly PurchaseEvidence[]) {
  const parsed = ipsSchema.safeParse(payload);
  if (!parsed.success) return undefined;
  // Free-text instrument names are not identities. Only explicit instrument lines can prove a match.
  const planned = new Set(parsed.data.allocation.lines.flatMap((line) => "instrumentId" in line ? [line.instrumentId] : []));
  return trades.find((trade) => trade.side === "BUY" && trade.instrumentAssetType === "etf" && planned.has(trade.instrumentId) && trade.executedAt >= planCreatedAt);
}
