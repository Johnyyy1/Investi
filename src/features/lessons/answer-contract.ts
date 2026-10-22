import { z } from "zod";

/** The same bounded wire format is used by every graded exercise and the cursor action. */
export const lessonAnswersSchema = z.record(z.string().min(1).max(100), z.string().max(100))
  .refine((value) => Object.keys(value).length <= 10, "At most ten answer fields");
