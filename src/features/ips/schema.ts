import { z } from "zod";
import { instrumentIdSchema } from "@/features/portfolio/input";

const text = z.string().trim().min(1, "Doplň text.").max(160, "Použij nejvýše 160 znaků.");
const explanation = z.string().trim().min(1, "Doplň pravidlo nebo zdůvodnění.").max(2000, "Použij nejvýše 2 000 znaků.");
const bps = z.number().int().min(0).max(10000);
const positiveBps = bps.refine((n) => n > 0, "Váha musí být větší než 0 %.");
const month = z.number().int().min(1).max(12);
export const ipsGoalSchema = z.strictObject({
  label: text,
  purpose: z.enum(["reserve", "housing", "retirement", "education", "other"]),
  horizonMonths: z.number().int().min(1).max(1200),
  priority: z.enum(["essential", "important", "optional"]),
});

/** Payload schema v2; artifact revision numbers remain independent of the schema version. */
export const ipsSchema = z.strictObject({
  schemaVersion: z.literal(2),
  goals: z.array(ipsGoalSchema).min(1).max(10),
  foundation: z.strictObject({
    emergencyFund: z.enum(["building", "ready_for_goal", "needs_review", "prefer_not_to_say"]),
    highCostDebt: z.enum(["none", "plan_needed", "prefer_not_to_say"]),
  }),
  allocation: z.strictObject({
    lines: z.array(z.union([
      z.strictObject({ assetClass: z.enum(["equity", "bonds", "other"]), weightBps: positiveBps }),
      z.strictObject({ instrumentId: instrumentIdSchema, weightBps: positiveBps }),
    ])).max(12),
    cashBps: bps,
  }).superRefine(({ lines, cashBps }, ctx) => {
    if (lines.reduce((sum, line) => sum + line.weightBps, cashBps) !== 10000) ctx.addIssue({ code: "custom", message: "Váhy včetně hotovosti musí dát přesně 100 %." });
    const keys = lines.map((line) => "assetClass" in line ? `class:${line.assetClass}` : `instrument:${line.instrumentId}`);
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", message: "Každý nástroj nebo třídu aktiv uveď jen jednou." });
    // Mixing the two representations can double count exposure and cannot be applied unambiguously.
    if (lines.some((line) => "assetClass" in line) && lines.some((line) => "instrumentId" in line)) ctx.addIssue({ code: "custom", message: "Zvol buď třídy aktiv, nebo konkrétní instrumenty pro celý mix." });
  }),
  instruments: z.array(text).min(1).max(20),
  platform: text,
  contribution: z.strictObject({ amountMinor: z.string().regex(/^(0|[1-9]\d{0,14})$/, "Částku ulož v celých haléřích."), dayOfMonth: z.number().int().min(1).max(28) }),
  rebalancing: z.discriminatedUnion("mode", [
    z.strictObject({ mode: z.literal("calendar"), month }),
    z.strictObject({ mode: z.literal("band"), bandBps: positiveBps }),
    z.strictObject({ mode: z.literal("contributions") }),
  ]),
  drawdownRule: z.strictObject({ action: z.enum(["keep_plan", "review_plan", "pause_contributions", "other"]), text: explanation }),
  checkFrequency: z.enum(["monthly", "quarterly", "annually"]),
  reviewMonth: month,
  changeReason: explanation,
  // A learner-declared acknowledgement, not evidence for awards or completion. createdAt is server time.
  signedAt: z.iso.datetime(),
});
export type IpsPlan = z.infer<typeof ipsSchema>;
