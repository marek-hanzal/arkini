import { z } from "zod";
import { WorkRecipeSchema } from "./WorkRecipeSchema";

export const CraftSchema = z.object({
	recipe: WorkRecipeSchema,
});
