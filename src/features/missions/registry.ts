/** Versioned checks are immutable once used: new criteria need a new mission ID. */
export type MissionDefinition = { id: string; lessonId: string; title: string } & (
  | { context: "personal"; check: "ips-etf-purchase-v1"; params: { minimumPurchases: 1 } }
  | { context: "scenario" | "training"; check: "diversification-rules-v1"; params: { model: "diversification-v1" } }
);

export const missions: readonly MissionDefinition[] = [
  // Reserved for 2.5.3; registering a mission does not publish or alter a lesson.
  { id: "ips-etf-purchase-v1", lessonId: "first-practice-purchase", title: "Cvičný nákup ETF podle IPS", context: "personal", check: "ips-etf-purchase-v1", params: { minimumPurchases: 1 } },
  { id: "diversification-rules-v1", lessonId: "diversification-scenario", title: "Rozlož scénářové portfolio", context: "scenario", check: "diversification-rules-v1", params: { model: "diversification-v1" } },
  { id: "allocation-training-v1", lessonId: "foundations-portfolio", title: "Procvič rozložení portfolia", context: "training", check: "diversification-rules-v1", params: { model: "diversification-v1" } },
];

export function getMission(id: string, lessonId?: string) {
  const mission = missions.find((item) => item.id === id && (lessonId === undefined || item.lessonId === lessonId));
  if (!mission) throw new Error("Unknown mission or lesson.");
  return mission;
}
