import { z } from "zod";

export const instrumentIdSchema = z.string().trim().min(1).max(100);
export const quantitySchema = z.string().trim().min(1).max(40);
export const idempotencySchema = z.string().uuid();

/** Reject extra market fields: price and FX are always resolved by the server. */
export const tradeInputSchema = z.object({
  instrumentId: instrumentIdSchema,
  quantity: quantitySchema,
  clientIdempotencyKey: idempotencySchema,
}).strict();

const weightSchema = z.number().int().min(0).max(10_000);

/** A target mix: instrument identities and integer basis-point weights only. Prices,
 * FX, amounts and quantities are resolved by the server. */
export const allocationInputSchema = z.object({
  lines: z.array(z.object({ instrumentId: instrumentIdSchema, weightBasisPoints: weightSchema }).strict()).min(1).max(12),
  cashWeightBasisPoints: weightSchema,
}).strict();

export const allocationExecutionSchema = allocationInputSchema.extend({ clientIdempotencyKey: idempotencySchema }).strict();
