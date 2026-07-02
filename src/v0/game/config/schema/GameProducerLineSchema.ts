import { z } from "zod";
import { ProducerInputsSchema } from "~/v0/game/config/schema/GameActivationInputSchema";
import {
	ActivationOutputAuthoringSchema,
	ActivationOutputSchema,
} from "~/v0/game/config/schema/GameActivationOutputSchema";
import {
	IdSchema,
	NonNegativeIntegerSchema,
	NonNegativeNumberSchema,
	PlacementSchema,
} from "~/v0/game/config/schema/GameConfigScalarSchemas";

export const ProducerLineSchema = z
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
		inputs: ProducerInputsSchema.optional(),
		output: ActivationOutputSchema.min(1).optional(),
		activatesEffectId: IdSchema.optional(),
	})
	.strict();

export const ProducerLineFragmentSchema = ProducerLineSchema.extend({
	name: z.string().min(1).optional(),
	output: ActivationOutputAuthoringSchema.min(1).optional(),
});
