import { z } from "zod";
import { CountSchema } from "./CountSchema";
import { IdSchema } from "./IdSchema";
import { WorkRecipeSchema } from "./WorkRecipeSchema";

export const StashLineSchema = z.object({
	id: IdSchema,
	name: z.string().optional(),
	chargeCost: CountSchema.optional(),
	recipe: WorkRecipeSchema,
});
