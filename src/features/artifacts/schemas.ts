import { z } from "zod";
import { ipsSchema } from "@/features/ips/schema";
import { availableLessons } from "@/features/learning/catalog";

const shortText = z.string().trim().min(1).max(160);
const explanation = z.string().trim().min(1).max(2000);
const texts = z.array(shortText).min(1).max(20);
const basisPoints = z.number().int().min(0).max(10000);
// Exact educational amounts; never use these learner-authored values as Lab execution inputs.
const minorUnits = z.string().regex(/^(0|[1-9]\d{0,14})$/);
const currency = z.enum(["CZK", "EUR", "USD"]);
const horizon = z.number().int().min(1).max(1200);
const goal = z.strictObject({
  label: shortText,
  purpose: z.enum(["reserve", "housing", "retirement", "education", "other"]),
  horizonMonths: horizon,
  priority: z.enum(["essential", "important", "optional"]),
});
const checklistItem = z.strictObject({ label: shortText, checked: z.boolean() });

/** Payload contracts v1. Readiness stores categories and a next step, never budget/debt amounts. */
export const artifactPayloadSchemas = {
  goal_map: z.strictObject({ goals: z.array(goal).min(1).max(10) }),
  financial_checkup: z.strictObject({
    budget: z.enum(["reviewed", "needs_review", "prefer_not_to_say"]),
    expensiveDebt: z.enum(["none", "plan_needed", "prefer_not_to_say"]),
    reserve: z.enum(["building", "ready_for_goal", "needs_review", "prefer_not_to_say"]),
    nextStep: z.enum(["review_budget", "make_debt_plan", "build_reserve", "define_goals", "continue_learning"]),
  }),
  fee_profile: z.strictObject({
    label: shortText,
    currency,
    orderFeeMinor: minorUnits,
    minimumOrderFeeMinor: minorUnits,
    orderFeeBasisPoints: basisPoints,
    fxSpreadBasisPoints: basisPoints,
    monthlyFeeMinor: minorUnits,
  }),
  etf_checklist: z.strictObject({
    instrument: shortText,
    ucits: z.enum(["yes", "no", "unknown"]),
    kidReviewed: z.boolean(),
    costsReviewed: z.boolean(),
    diversificationReviewed: z.boolean(),
    rationale: explanation,
  }),
  safeguards: z.strictObject({ rules: z.array(z.strictObject({ trigger: shortText, action: explanation })).min(1).max(20) }),
  investment_plan: z.union([ipsSchema, z.strictObject({
    goals: z.array(goal).min(1).max(10),
    horizonMonths: horizon,
    allocation: z.array(z.strictObject({ assetClass: z.enum(["equity", "bonds", "cash", "other"]), weightBasisPoints: basisPoints })).min(1).max(4)
      .refine((lines) => new Set(lines.map((line) => line.assetClass)).size === lines.length, "Duplicate asset class")
      .refine((lines) => lines.reduce((sum, line) => sum + line.weightBasisPoints, 0) === 10000, "Weights must total 10000 basis points"),
    reviewFrequency: z.enum(["monthly", "quarterly", "annually"]),
    rebalanceRule: explanation,
    crisisPlan: explanation,
  })]),
  trade_checklist: z.strictObject({ items: z.array(checklistItem).min(1).max(20) }),
  business_map: z.strictObject({ company: shortText, customers: texts, revenueDrivers: texts, advantages: texts, risks: texts }),
  investment_thesis: z.strictObject({ company: shortText, thesis: explanation, assumptions: texts, evidence: texts, risks: texts, exitCriteria: texts, reviewOn: z.iso.date() }),
  journal: z.strictObject({ entries: z.array(z.strictObject({ date: z.iso.date(), decision: explanation, reasoning: explanation, nextReviewOn: z.iso.date() })).min(1).max(30) }),
};

export type ArtifactKind = keyof typeof artifactPayloadSchemas;
export const artifactKinds = Object.keys(artifactPayloadSchemas) as [ArtifactKind, ...ArtifactKind[]];
export const artifactKindSchema = z.enum(artifactKinds);
export type ArtifactPayload<K extends ArtifactKind> = z.infer<(typeof artifactPayloadSchemas)[K]>;
export type ArtifactContent = { [K in ArtifactKind]: { kind: K; payload: ArtifactPayload<K> } }[ArtifactKind];

const variant = <K extends ArtifactKind>(kind: K) => z.strictObject({ kind: z.literal(kind), payload: artifactPayloadSchemas[kind] });
export const artifactContentSchema = z.discriminatedUnion("kind", [
  variant("goal_map"), variant("financial_checkup"), variant("fee_profile"), variant("etf_checklist"), variant("safeguards"),
  variant("investment_plan"), variant("trade_checklist"), variant("business_map"), variant("investment_thesis"), variant("journal"),
]);
export const artifactSourceSchema = z.string().max(100).refine((id) => availableLessons.some((lesson) => lesson.id === id)).nullable();
export const saveArtifactSchema = z.strictObject({
  content: artifactContentSchema,
  sourceLessonId: artifactSourceSchema,
  consent: z.literal(true),
  requestId: z.uuid(),
});
export type SaveArtifactInput = z.input<typeof saveArtifactSchema>;
export const listArtifactsSchema = z.strictObject({ kind: artifactKindSchema.optional() });
export const deleteArtifactSchema = z.strictObject({ id: z.uuid() });

/** One current document per kind. Revisions are separate from payload schema evolution. */
export type LearnerArtifact = ArtifactContent & { id: string; version: number; sourceLessonId: string | null; createdAt: string };
export type ArtifactRequirement = { kind: ArtifactKind; source?: "current_lesson" | "any_lesson" };
