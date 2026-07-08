import { z } from "zod";
import { CountSchema } from "./CountSchema";
import { IdSchema } from "./IdSchema";

export const WorkInputSchema = z.object({
	itemId: IdSchema,
	quantity: CountSchema.optional(),
	consume: z.boolean().optional(),
	buffer: CountSchema.optional(),
});
