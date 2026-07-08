import { z } from "zod";
import { IdSchema } from "./IdSchema";
import { WorkRecipeSchema } from "./WorkRecipeSchema";

export const BuildSchema = z.object({
	buildsItemId: IdSchema,
	recipe: WorkRecipeSchema,
});
