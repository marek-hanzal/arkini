import { z } from "zod";
import { CraftRecipeInputSchema } from "~/config/schema/GameActivationInputSchema";
import { IdSchema, NonNegativeIntegerSchema } from "~/config/schema/GameConfigScalarSchemas";
import {
	GameLineEffectAuthoringSchema,
	GameLineEffectSchema,
} from "~/config/schema/GameLineEffectSchema";

export const CraftResultPlacementSchema = z.enum([
	"replace-target",
	"random-board",
]);

export const CraftRecipeSchema = z
	.object({
		resultItemId: IdSchema,
		inputs: z.array(CraftRecipeInputSchema),
		effects: z.array(GameLineEffectSchema).optional(),
		durationMs: NonNegativeIntegerSchema,
		resultPlacement: CraftResultPlacementSchema.optional(),
	})
	.strict();

export const CraftRecipeFragmentSchema = CraftRecipeSchema.extend({
	resultItemId: IdSchema.optional(),
	effects: z.array(GameLineEffectAuthoringSchema).optional(),
});
