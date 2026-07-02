import { z } from "zod";
import {
	PositiveIntegerSchema,
	PositiveNumberSchema,
} from "~/config/schema/GameConfigScalarSchemas";
import { LineFragmentSchema, LineSchema } from "~/config/schema/GameLineSchema";

export const ProducerDepletedModeSchema = z.enum([
	"stop",
	"remove",
]);

export const ProducerSchema = z
	.object({
		maxQueueSize: PositiveIntegerSchema.default(1),
		lines: z.array(LineSchema).min(1),
		charges: PositiveNumberSchema.optional(),
		onChargesDepleted: ProducerDepletedModeSchema.default("stop"),
	})
	.strict();

export const ProducerFragmentSchema = ProducerSchema.extend({
	lines: z.array(LineFragmentSchema).min(1),
});
