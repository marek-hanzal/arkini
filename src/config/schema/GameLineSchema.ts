import { z } from "zod";
import { ProducerInputsSchema } from "~/config/schema/GameActivationInputSchema";
import {
	ActivationOutputAuthoringSchema,
	ActivationOutputSchema,
} from "~/config/schema/GameActivationOutputSchema";
import { GameEffectSchema } from "~/config/schema/GameEffectSchema";
import {
	GameLineEffectAuthoringSchema,
	GameLineEffectSchema,
} from "~/config/schema/GameLineEffectSchema";
import {
	IdSchema,
	NonNegativeIntegerSchema,
	NonNegativeNumberSchema,
	PlacementSchema,
} from "~/config/schema/GameConfigScalarSchemas";

export const LineSchema = z
	.object({
		id: IdSchema,
		name: z.string().min(1),
		tags: z.array(z.string().min(1)).default([]),
		visibility: z
			.enum([
				"visible",
				"hidden",
			])
			.default("visible"),
		durationMs: NonNegativeIntegerSchema,
		placement: PlacementSchema,
		chargeCost: NonNegativeNumberSchema.default(0),
		effects: z.array(GameLineEffectSchema).optional(),
		inputs: ProducerInputsSchema.optional(),
		output: ActivationOutputSchema.min(1).optional(),
		effect: GameEffectSchema.optional(),
	})
	.strict();

export const LineFragmentSchema = LineSchema.extend({
	name: z.string().min(1).optional(),
	effects: z.array(GameLineEffectAuthoringSchema).optional(),
	output: ActivationOutputAuthoringSchema.min(1).optional(),
});
