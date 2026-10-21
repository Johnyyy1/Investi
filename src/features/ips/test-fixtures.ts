import type { IpsPlan } from "./schema";
import { artifactExamples } from "@/features/artifacts/test-fixtures";

export const exampleIps: IpsPlan = { schemaVersion: 2, goals: artifactExamples.goal_map.goals,
  foundation: { emergencyFund: "building", highCostDebt: "none" },
  allocation: { lines: [{ instrumentId: "IE-XETR:VWCE", weightBps: 8000 }], cashBps: 2000 }, instruments: ["Široké ETF"], platform: "Fiktivní broker",
  contribution: { amountMinor: "250025", dayOfMonth: 15 }, rebalancing: { mode: "band", bandBps: 500 },
  drawdownRule: { action: "keep_plan", text: "Přečtu si cíle před každým rozhodnutím." }, checkFrequency: "quarterly", reviewMonth: 10,
  changeReason: "První verze mého plánu.", signedAt: "2026-10-21T12:00:00.000Z" };
