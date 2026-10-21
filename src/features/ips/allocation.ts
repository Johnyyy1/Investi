import { validateAllocation, type AllocationInput } from "@/features/portfolio/allocation";
import { PortfolioInputError } from "@/features/portfolio/decimal";
import { ipsSchema, type IpsPlan } from "./schema";

/** No guessed mapping from an asset class to an instrument or a recommended portfolio. */
export function ipsTargetAllocation(input: IpsPlan): AllocationInput {
  const plan = ipsSchema.parse(input);
  if (!plan.allocation.lines.length || plan.allocation.lines.some((line) => "assetClass" in line)) {
    throw new PortfolioInputError("InvalidAllocation", "Pro cílový mix vyber konkrétní instrumenty. Třídy aktiv ani samotnou hotovost Lab automaticky nepřevádí.");
  }
  return validateAllocation({
    lines: plan.allocation.lines.map((line) => ({ instrumentId: "instrumentId" in line ? line.instrumentId : "", weightBasisPoints: line.weightBps })),
    cashWeightBasisPoints: plan.allocation.cashBps,
  });
}
