import { z } from "zod";
import { PositiveNumberSchema } from "~/config/schema/GameConfigScalarSchemas";
import { ProducerDepletedModeSchema, ProducerSchema } from "~/config/schema/GameProducerSchema";
import { LineFragmentSchema, LineSchema } from "~/config/schema/GameLineSchema";

const StashBaseSchema = ProducerSchema.omit({
	lines: true,
})
	.extend({
		line: LineSchema,
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
	line: LineFragmentSchema,
});
