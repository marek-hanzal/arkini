import { z } from "zod";
import { IdSchema } from "./IdSchema";
import { LineVisibilitySchema } from "./LineVisibilitySchema";
import { WorkRecipeSchema } from "./WorkRecipeSchema";

export const ProducerLineSchema = z.object({
	id: IdSchema,
	name: z.string().optional(),
	tags: z.array(IdSchema).optional(),
	visibility: LineVisibilitySchema.optional(),
	recipe: WorkRecipeSchema,
});
