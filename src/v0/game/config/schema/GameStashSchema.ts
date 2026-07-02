import { z } from "zod";
import { PositiveNumberSchema } from "~/v0/game/config/schema/GameConfigScalarSchemas";
import {
	ProducerDepletedModeSchema,
	ProducerSchema,
} from "~/v0/game/config/schema/GameProducerSchema";
import {
	ProducerLineFragmentSchema,
	ProducerLineSchema,
} from "~/v0/game/config/schema/GameProducerLineSchema";

export const StashBaseSchema = ProducerSchema.omit({
	lines: true,
})
	.extend({
		line: ProducerLineSchema,
		charges: PositiveNumberSchema.default(1),
		onChargesDepleted: ProducerDepletedModeSchema.default("remove"),
	})
	.strict();

export const StashSchema = StashBaseSchema.superRefine((stash, ctx) => {
	if (stash.onChargesDepleted !== "remove") {
		ctx.addIssue({
			code: "custom",
			message: "Stashes must remove themselves when charges are depleted.",
			path: [
				"onChargesDepleted",
			],
		});
	}
});

export const StashFragmentSchema = StashBaseSchema.extend({
	line: ProducerLineFragmentSchema,
});
