import { z } from "zod";
import { CraftRecipeInputSchema } from "~/config/schema/GameActivationInputSchema";
import {
	ActivationOutputAuthoringSchema,
	ActivationOutputSchema,
} from "~/config/schema/GameActivationOutputSchema";
import { NonNegativeIntegerSchema } from "~/config/schema/GameConfigScalarSchemas";
import {
	GameLineEffectAuthoringSchema,
	GameLineEffectSchema,
} from "~/config/schema/GameLineEffectSchema";

export const CraftRecipeSchema = z
	.object({
		inputs: z.array(CraftRecipeInputSchema),
		effects: z.array(GameLineEffectSchema).optional(),
		durationMs: NonNegativeIntegerSchema,
		output: ActivationOutputSchema.min(1),
	})
	.strict();

export const CraftRecipeFragmentSchema = CraftRecipeSchema.extend({
	effects: z.array(GameLineEffectAuthoringSchema).optional(),
	output: ActivationOutputAuthoringSchema.min(1).optional(),
});
