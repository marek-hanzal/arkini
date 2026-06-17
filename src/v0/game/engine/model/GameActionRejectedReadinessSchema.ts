import { z } from "zod";

export const GameActionRejectedReadinessSchema = z
	.object({
		errorTag: z.enum([
			"GameActionInvalid",
			"GameActionRejected",
			"GameConfigReferenceMissing",
			"GameSaveInvalid",
		]),
		message: z.string().min(1),
		reason: z
			.enum([
				"input_mismatch",
				"input_unavailable",
				"invalid_actor",
				"invalid_merge",
				"missing_requirement",
				"placement_unavailable",
				"stash_depleted",
				"unsupported_target",
				"unsupported_requirement",
			])
			.optional(),
		type: z.literal("rejected"),
	})
	.strict();

export type GameActionRejectedReadinessSchema = typeof GameActionRejectedReadinessSchema;

export namespace GameActionRejectedReadinessSchema {
	export type Type = z.infer<typeof GameActionRejectedReadinessSchema>;
}
