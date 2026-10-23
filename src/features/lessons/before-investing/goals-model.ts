import { artifactPayloadSchemas, type ArtifactPayload } from "@/features/artifacts/schemas";
import { decimalToMinor } from "@/features/ips/presentation";
import { scaledToDecimal } from "@/features/portfolio/decimal";

export const GOALS_LESSON_ID = "before-investing-goals";
export type MappedGoal = ArtifactPayload<"goal_map">["goals"][number];
export type GoalDraft = Pick<MappedGoal, "label" | "purpose" | "priority"> & { amount: string; year: string };
export const emptyGoal = (): GoalDraft => ({ label: "", purpose: "other", priority: "essential", amount: "", year: "" });
export const horizonCategory = (months: number) => months <= 36 ? "Do 3 let včetně" : months <= 84 ? "Nad 3 až 7 let včetně" : "Nad 7 let";

/** Calendar-year estimate, deliberately not a precise spending date or an allocation recommendation. */
export function goalMapFromDraft(drafts: readonly GoalDraft[], noSpecificGoal: boolean, currentYear: number): ArtifactPayload<"goal_map"> {
  if (noSpecificGoal) return { goals: [], noSpecificGoal: true };
  if (!drafts.length || drafts.length > 10) throw new Error("Přidej alespoň jeden cíl.");
  const goals = drafts.map(({ amount, year, ...goal }) => {
    if (!/^\d{4}$/.test(year) || Number(year) < currentYear || Number(year) > currentYear + 100) throw new Error("Doplň rok od letoška do sta let.");
    return { ...goal, targetYear: Number(year), horizonMonths: Math.max(1, (Number(year) - currentYear) * 12), ...(amount.trim() ? { amountMinor: decimalToMinor(amount) } : {}) };
  });
  const parsed = artifactPayloadSchemas.goal_map.safeParse({ goals });
  if (!parsed.success) throw new Error("Doplň název cíle do 160 znaků a platnou částku (nebo ji nech prázdnou).");
  return parsed.data;
}

export function goalDraftsFromMap(map: ArtifactPayload<"goal_map">, currentYear: number): GoalDraft[] {
  return map.goals.map(({ label, purpose, priority, amountMinor, targetYear, horizonMonths }) => ({
    label, purpose, priority, amount: amountMinor === undefined ? "" : scaledToDecimal(BigInt(amountMinor), 2).replace(".", ","),
    year: String(targetYear ?? currentYear + Math.ceil(horizonMonths / 12)),
  }));
}

/** New map metadata must not enter the strict, independently versioned IPS goal contract. */
export function goalsForIps(map: ArtifactPayload<"goal_map">) {
  return map.goals.length ? map.goals.map(({ label, purpose, priority, horizonMonths }) => ({ label, purpose, priority, horizonMonths })) : undefined;
}
