"use server";

import { z } from "zod";
import { backtestHistoryPlans } from "@/features/backtesting/catalog";
import { BacktestDataError } from "@/features/backtesting/spec";
import { isGuestIdentity } from "@/features/guest/identity";
import { isMarketDataError } from "@/features/market-data/errors";
import { portfolioMarketData } from "@/features/portfolio/environment";
import { PortfolioInputError, parseQuantity } from "@/features/portfolio/decimal";
import { quantitySchema } from "@/features/portfolio/input";
import { enforceMarketDataBudget } from "@/features/rate-limit";
import { isRequestRateLimitedError } from "@/features/rate-limit/limiter";
import { marketDataLimitMessage } from "@/features/rate-limit/policy";
import { getCurrentUser } from "@/lib/session";
import { logUnexpectedError } from "@/lib/server-errors";
import { TrainingActionError, type TrainingAction } from "./domain";
import { presentTraining, type TrainingView } from "./presentation";
import { appendTrainingAction, loadLatestTraining, startTrainingSession, TrainingSessionError } from "./repository";
import { availableScenarios, loadScenarioSeries } from "./scenarios";

type TrainingResponse = { ok: true; view: TrainingView } | { ok: false; message: string; view?: TrainingView };

const startSchema = z.strictObject({ scenarioId: z.string().min(1).max(60), requestId: z.uuid() });
/** The browser sends only the learner's choice; prices, values and fees come from the replay. */
const actionSchema = z.strictObject({
  sessionId: z.uuid(),
  expectedMonth: z.number().int().min(0).max(600),
  clientIdempotencyKey: z.uuid(),
  action: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("buy"), amountMinor: z.string().regex(/^[1-9]\d{0,14}$/) }),
    z.strictObject({ kind: z.literal("sell"), quantity: quantitySchema }),
    z.strictObject({ kind: z.literal("advance") }),
  ]),
});

const expected = (error: unknown) => error instanceof TrainingActionError || error instanceof TrainingSessionError || error instanceof BacktestDataError
  || error instanceof PortfolioInputError || error instanceof z.ZodError || isRequestRateLimitedError(error);

function messageFor(error: unknown) {
  if (error instanceof TrainingActionError || error instanceof TrainingSessionError || error instanceof BacktestDataError || error instanceof PortfolioInputError) return error.message;
  if (isRequestRateLimitedError(error)) return marketDataLimitMessage(error.decision);
  if (error instanceof z.ZodError) return "Akci se nepodařilo přečíst. Zkontroluj zadání a zkus to znovu.";
  if (isMarketDataError(error)) return "Cenová historie teď není dostupná. Nácvik jsme nespustili, zkus to za chvíli znovu.";
  return "Nácvik se teď nepodařilo uložit. Zkus to znovu.";
}

async function currentView(userId: string) {
  const latest = await loadLatestTraining(userId);
  return latest ? presentTraining(latest.session, latest.setup, latest.state) : undefined;
}

async function savedOwner() {
  const owner = await getCurrentUser();
  return owner && !isGuestIdentity(owner) ? owner : null;
}

/** Starts a session on fictional money. Practice Capital and the personal portfolio are never read or written. */
export async function startTrainingAction(input: unknown): Promise<TrainingResponse> {
  try {
    const owner = await savedOwner();
    if (!owner) return { ok: false, message: "Pro nácvik se přihlas k uloženému účtu." };
    const { scenarioId, requestId } = startSchema.parse(input);
    const plan = backtestHistoryPlans[portfolioMarketData.provider];
    if (availableScenarios(plan).find(({ id }) => id === scenarioId)?.kind === "history") await enforceMarketDataBudget(owner.id, "backtest");
    const series = await loadScenarioSeries(portfolioMarketData.service, plan, scenarioId);
    await startTrainingSession(owner.id, { scenarioId, requestId, series });
    return { ok: true, view: (await currentView(owner.id))! };
  } catch (error) {
    if (!expected(error)) logUnexpectedError("training", "start", error);
    return { ok: false, message: messageFor(error) };
  }
}

export async function recordTrainingAction(input: unknown): Promise<TrainingResponse> {
  const owner = await savedOwner().catch(() => null);
  if (!owner) return { ok: false, message: "Relace skončila. Přihlas se znovu." };
  try {
    const parsed = actionSchema.parse(input);
    const action: TrainingAction = parsed.action.kind === "buy" ? { kind: "buy", amountMinor: BigInt(parsed.action.amountMinor) }
      : parsed.action.kind === "sell" ? { kind: "sell", quantityUnits: parseQuantity(parsed.action.quantity) } : { kind: "advance" };
    await appendTrainingAction(owner.id, { ...parsed, action });
    return { ok: true, view: (await currentView(owner.id))! };
  } catch (error) {
    if (!expected(error)) logUnexpectedError("training", "record action", error);
    // A refused action returns the authoritative state, so a stale tab catches up.
    return { ok: false, message: messageFor(error), view: await currentView(owner.id).catch(() => undefined) };
  }
}
