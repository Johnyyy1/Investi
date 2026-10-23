import "server-only";
import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { learnerArtifact, missionAttempt, portfolio, portfolioTrade, user } from "@/db/schema";
import { readPracticeCapitalEntitlementMinor } from "@/features/rewards/repository";
import { ipsSchema } from "@/features/ips/schema";
import { checkIpsPurchase, checkScenario } from "./checks";
import { getMission } from "./registry";

type Reader = Pick<typeof db, "select">;
export async function hasCompletedMission(query: Reader, userId: string, missionId: string) {
  const [row] = await query.select({ id: missionAttempt.id }).from(missionAttempt).where(and(eq(missionAttempt.userId, userId), eq(missionAttempt.missionId, missionId), eq(missionAttempt.completed, true))).limit(1);
  return Boolean(row);
}

/** Same owner lock as trades, resets and lesson completion. No portfolio writes or awards. */
export async function verifyMission(userId: string, missionId: string, requestId: string, input?: unknown) {
  const mission = getMission(missionId);
  return db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
    if (!owner) throw new Error("Missing mission owner.");
    if (mission.context !== "personal") {
      const result = checkScenario(input);
      const [retry] = await tx.select().from(missionAttempt).where(and(eq(missionAttempt.userId, userId), eq(missionAttempt.missionId, missionId), eq(missionAttempt.requestId, requestId)));
      const evidence = { context: mission.context, check: mission.check, params: mission.params, ...result };
      if (retry) {
        if (!isDeepStrictEqual(retry.evidence, evidence)) throw new Error("Request already belongs to another decision.");
      } else await tx.insert(missionAttempt).values({ id: randomUUID(), userId, missionId, requestId, evidence, completed: result.completed });
      const completed = await hasCompletedMission(tx, userId, missionId);
      return { completed, rules: result.rules, message: !result.completed && completed ? "Tento pokus pravidla nesplňuje. Dřívější ověřené splnění mise zůstává uložené." : result.completed ? "Mise splněna. Server ověřil všechna pravidla scénáře." : "Tento pokus ještě nesplňuje pravidla. Uprav rozložení a zkus to znovu." };
    }
    if (input !== undefined) throw new Error("Personal evidence is server-owned.");
    if (await hasCompletedMission(tx, userId, missionId)) return { completed: true, message: "Mise už je ověřená. Další obchod není potřeba." };
    const earned = await readPracticeCapitalEntitlementMinor(tx, userId);
    if (earned === 0n) return { completed: false, message: "Zatím nemáš cvičný kapitál. Vrať se k učení; další obchod teď není potřeba." };
    const [plan] = await tx.select().from(learnerArtifact).where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.kind, "investment_plan"))).orderBy(desc(learnerArtifact.version)).limit(1);
    if (!plan) return { completed: false, message: "Nejdřív ulož IPS s konkrétním ETF. Samotný název fondu v poznámce nestačí." };
    const target = ipsSchema.safeParse(plan.payload);
    if (!target.success || !target.data.allocation.lines.some((line) => "instrumentId" in line)) return { completed: false, message: "Nejdřív ulož IPS s konkrétními instrumenty. Samotná třída aktiv ani název fondu v poznámce nestačí." };
    const trades = await tx.select({ id: portfolioTrade.id, instrumentId: portfolioTrade.instrumentId, instrumentAssetType: portfolioTrade.instrumentAssetType, side: portfolioTrade.side, executedAt: portfolioTrade.executedAt }).from(portfolioTrade).innerJoin(portfolio, eq(portfolio.id, portfolioTrade.portfolioId)).where(eq(portfolio.userId, userId)).orderBy(portfolioTrade.executedAt, portfolioTrade.id);
    const trade = checkIpsPurchase(plan.payload, plan.createdAt, trades);
    if (trade) {
      await tx.insert(missionAttempt).values({ id: randomUUID(), userId, missionId, requestId: "personal", completed: true, evidence: { context: mission.context, check: mission.check, params: mission.params, artifactId: plan.id, tradeId: trade.id } });
      return { completed: true, message: "Mise splněna. Server ověřil cvičný nákup ETF uvedeného v uloženém IPS." };
    }
    return { completed: false, message: "Zatím chybí cvičný nákup ETF z konkrétního mixu IPS po jeho uložení. Prodej, výnos ani počet dalších obchodů se nehodnotí." };
  });
}
