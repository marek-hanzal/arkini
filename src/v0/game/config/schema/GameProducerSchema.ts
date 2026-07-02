import { z } from "zod";
import {
	PositiveIntegerSchema,
	PositiveNumberSchema,
} from "~/v0/game/config/schema/GameConfigScalarSchemas";
import {
	ProducerLineFragmentSchema,
	ProducerLineSchema,
} from "~/v0/game/config/schema/GameProducerLineSchema";

export const ProducerDepletedModeSchema = z.enum([
	"stop",
	"remove",
]);

export const ProducerSchema = z
	.object({
		maxQueueSize: PositiveIntegerSchema.default(1),
		lines: z.array(ProducerLineSchema).min(1),
		charges: PositiveNumberSchema.optional(),
		onChargesDepleted: ProducerDepletedModeSchema.default("stop"),
	})
	.strict();

export const ProducerFragmentSchema = ProducerSchema.extend({
	lines: z.array(ProducerLineFragmentSchema).min(1),
});
