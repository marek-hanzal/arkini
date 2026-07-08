import { z } from "zod";
import { CapacityDepletionModeSchema } from "./CapacityDepletionModeSchema";
import { CountSchema } from "./CountSchema";
import { IdSchema } from "./IdSchema";

export const CapacitySchema = z.object({
	max: CountSchema,
	onDepleted: CapacityDepletionModeSchema.optional(),
	replaceItemId: IdSchema.optional(),
});
