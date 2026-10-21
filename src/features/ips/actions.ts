"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { isGuestIdentity } from "@/features/guest/identity";
import { requirePortfolioLabUnlock } from "@/features/progression/repository";
import { enforceMarketDataBudget } from "@/features/rate-limit";
import { portfolioMarketData } from "@/features/portfolio/environment";
import { PortfolioInputError } from "@/features/portfolio/decimal";
import { applyIpsTarget } from "./repository";

const applySchema = z.strictObject({ artifactId: z.uuid(), portfolioId: z.uuid(), requestId: z.uuid() });
export async function applyIpsTargetAction(input: unknown) {
  try {
    const owner = await getCurrentUser();
    if (!owner || isGuestIdentity(owner)) return { ok: false as const, message: "Pro použití plánu se přihlas k uloženému účtu." };
    const parsed = applySchema.safeParse(input);
    if (!parsed.success) return { ok: false as const, message: "Načti aktuální plán a zkus to znovu." };
    await requirePortfolioLabUnlock(owner.id);
    await enforceMarketDataBudget(owner.id, "allocation-quotes");
    const result = await applyIpsTarget(owner.id, parsed.data);
    revalidatePath("/lab/portfolio");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, message: error instanceof PortfolioInputError ? error.message : "Cílový mix se nepodařilo uložit. Ověř odemčení Labu a dostupnost nástrojů a zkus to znovu." };
  }
}

/** Planning can happen before Lab unlock; discovery does not grant trading access. */
export async function searchIpsInstrumentsAction(query: string) {
  try {
    const owner = await getCurrentUser();
    if (!owner || isGuestIdentity(owner)) return { ok: false as const, results: [], message: "Pro hledání nástrojů se přihlas." };
    const parsed = z.string().trim().min(2).max(80).parse(query);
    await enforceMarketDataBudget(owner.id, "search");
    const results = await portfolioMarketData.service.searchInstruments(parsed);
    return { ok: true as const, results: results.filter(({ assetType }) => assetType === "equity" || assetType === "etf" || assetType === "bond") };
  } catch { return { ok: false as const, results: [], message: "Hledání se nepodařilo. Zkus jiný název nebo to zkus později." }; }
}
