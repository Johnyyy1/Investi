import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { learnerArtifact, trainingAction, trainingSession, user } from "@/db/schema";
import { isGuestIdentity } from "@/features/guest/identity";
import { ipsSchema } from "@/features/ips/schema";
import { brokerFeeProfile } from "@/features/portfolio/costs";
import { decimalToPriceUnits, decimalToQuantityUnits, quantityToDecimal } from "@/features/portfolio/decimal";
import { readBrokerFeeProfile } from "@/features/portfolio/repository";
import { replayTraining, TRAINING_INITIAL_CAPITAL_MINOR, trainingPlanFromIps, type TrainingAction, type TrainingSetup } from "./domain";
import type { TrainingSeries } from "./scenarios";

export class TrainingSessionError extends Error {
  constructor(readonly code: "SavedAccount" | "NoPlan" | "LegacyPlan" | "NotFound" | "Stale" | "KeyReused", message: string) {
    super(message);
    this.name = "TrainingSessionError";
  }
}

type SessionRow = typeof trainingSession.$inferSelect;
type ActionRow = typeof trainingAction.$inferSelect;
type Reader = Pick<typeof db, "select">;

export function trainingSetup(row: SessionRow): TrainingSetup {
  return {
    dates: row.series.points.map(({ date }) => date), prices: row.series.points.map(({ price }) => decimalToPriceUnits(price)),
    initialCapitalMinor: row.initialCapitalMinor, plan: row.plan, feeProfile: brokerFeeProfile(row.feeProfileId),
  };
}

function actionFromRow(row: Pick<ActionRow, "kind" | "amountMinor" | "quantity">): TrainingAction {
  if (row.kind === "buy") return { kind: "buy", amountMinor: row.amountMinor! };
  if (row.kind === "sell") return { kind: "sell", quantityUnits: decimalToQuantityUnits(row.quantity!) };
  return { kind: "advance" };
}

/** The latest IPS revision as a training plan, or why it cannot be used. */
async function readPlan(reader: Reader, userId: string) {
  const [latest] = await reader.select().from(learnerArtifact).where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.kind, "investment_plan"))).orderBy(desc(learnerArtifact.version)).limit(1);
  if (!latest) return { status: "none" as const };
  const parsed = ipsSchema.safeParse(latest.payload);
  return parsed.success ? { status: "ready" as const, artifactId: latest.id, plan: trainingPlanFromIps(parsed.data, latest.version) } : { status: "legacy" as const };
}

export async function readTrainingPlanStatus(userId: string) {
  return (await readPlan(db, userId)).status;
}

/** One session per request id. The series is loaded before the transaction and frozen here. */
export async function startTrainingSession(userId: string, input: { scenarioId: string; requestId: string; series: TrainingSeries }) {
  return db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: user.id, isAnonymous: user.isAnonymous, anonymousKind: user.anonymousKind }).from(user).where(eq(user.id, userId)).for("update");
    if (!owner || isGuestIdentity(owner)) throw new TrainingSessionError("SavedAccount", "Pro nácvik si nejdřív ulož účet.");
    const [retry] = await tx.select().from(trainingSession).where(and(eq(trainingSession.userId, userId), eq(trainingSession.requestId, input.requestId)));
    if (retry) {
      if (retry.scenarioId !== input.scenarioId) throw new TrainingSessionError("KeyReused", "Tento požadavek už patří jinému nácviku. Načti stránku znovu.");
      return { sessionId: retry.id, duplicate: true };
    }
    const plan = await readPlan(tx, userId);
    if (plan.status === "none") throw new TrainingSessionError("NoPlan", "Nácvik zkouší tvůj investiční plán. Nejdřív si ho ulož.");
    if (plan.status === "legacy") throw new TrainingSessionError("LegacyPlan", "Plán je ve starším formátu. Ulož jeho novou verzi a nácvik spusť znovu.");
    const profile = await readBrokerFeeProfile(tx, userId);
    const sessionId = randomUUID();
    await tx.insert(trainingSession).values({
      id: sessionId, userId, scenarioId: input.scenarioId, startedAt: new Date(), ipsArtifactId: plan.artifactId, plan: plan.plan,
      series: input.series, feeProfileId: profile.id, initialCapitalMinor: TRAINING_INITIAL_CAPITAL_MINOR, requestId: input.requestId,
    });
    return { sessionId, duplicate: false };
  });
}

const sameAction = (row: ActionRow, action: TrainingAction) => row.kind === action.kind
  && (action.kind !== "buy" || row.amountMinor === action.amountMinor)
  && (action.kind !== "sell" || decimalToQuantityUnits(row.quantity!) === action.quantityUnits);

/** Appends one action under the session lock after replaying and validating it. A retry is answered from the log. */
export async function appendTrainingAction(userId: string, input: { sessionId: string; expectedMonth: number; clientIdempotencyKey: string; action: TrainingAction }) {
  return db.transaction(async (tx) => {
    const [session] = await tx.select().from(trainingSession).where(and(eq(trainingSession.id, input.sessionId), eq(trainingSession.userId, userId))).for("update");
    if (!session) throw new TrainingSessionError("NotFound", "Nácvik se nepodařilo najít. Načti stránku znovu.");
    const rows = await tx.select().from(trainingAction).where(eq(trainingAction.sessionId, session.id)).orderBy(asc(trainingAction.sequence));
    const retry = rows.find((row) => row.clientIdempotencyKey === input.clientIdempotencyKey);
    if (retry) {
      if (!sameAction(retry, input.action)) throw new TrainingSessionError("KeyReused", "Tento požadavek už patří jiné akci. Načti stránku znovu.");
      return { duplicate: true };
    }
    const setup = trainingSetup(session);
    const actions = rows.map(actionFromRow);
    if (replayTraining(setup, actions).month !== input.expectedMonth) throw new TrainingSessionError("Stale", "Nácvik se mezitím posunul, třeba v jiném okně. Zobrazujeme aktuální měsíc.");
    const state = replayTraining(setup, [...actions, input.action]);
    const { action } = input;
    await tx.insert(trainingAction).values({
      sessionId: session.id, sequence: rows.length, month: input.expectedMonth, kind: action.kind, createdAt: new Date(), clientIdempotencyKey: input.clientIdempotencyKey,
      amountMinor: action.kind === "buy" ? action.amountMinor : null, quantity: action.kind === "sell" ? quantityToDecimal(action.quantityUnits) : null,
    });
    return { duplicate: false, month: state.month };
  });
}

/** The learner's most recent session with its replayed state, or null. */
export async function loadLatestTraining(userId: string) {
  const [session] = await db.select().from(trainingSession).where(eq(trainingSession.userId, userId)).orderBy(desc(trainingSession.startedAt)).limit(1);
  if (!session) return null;
  const rows = await db.select().from(trainingAction).where(eq(trainingAction.sessionId, session.id)).orderBy(asc(trainingAction.sequence));
  const setup = trainingSetup(session);
  return { session, setup, state: replayTraining(setup, rows.map(actionFromRow)) };
}
