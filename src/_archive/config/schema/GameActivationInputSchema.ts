import { z } from "zod";
import {
	ActivationInputModeSchema,
	IdSchema,
	PositiveIntegerSchema,
} from "~/config/schema/GameConfigScalarSchemas";

const ProducerInputSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema.default(1),
		capacity: PositiveIntegerSchema,
		consume: z.boolean(),
		mode: ActivationInputModeSchema.optional(),
	})
	.strict();

export const ProducerInputsSchema = z.array(ProducerInputSchema);

export const CraftRecipeInputSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema.default(1),
		consume: z.boolean(),
	})
	.strict();
