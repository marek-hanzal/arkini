import { z } from "zod";
import { GamePlacementFailureReasonSchema } from "~/v0/game/placement/GamePlacementFailureReasonSchema";

export const GameActionRejectedReadinessSchema = z
	.object({
		errorTag: z.enum([
			"GameActionInvalid",
			"GameActionRejected",
			"GamePlacementFailed",
			"GameConfigReferenceMissing",
			"GameSaveInvalid",
		]),
		message: z.string().min(1),
		reason: z
			.union([
				z.enum([
					"input_mismatch",
					"input_unavailable",
					"invalid_actor",
					"invalid_merge",
					"item_busy",
					"craft_in_progress",
					"missing_requirement",
					"product_line_disabled",
					"producer_queue_full",
					"stash_depleted",
					"unsupported_target",
					"unsupported_requirement",
					"upgrade_complete",
					"upgrade_in_progress",
				]),
				GamePlacementFailureReasonSchema,
			])
			.optional(),
		type: z.literal("rejected"),
	})
	.strict();

export type GameActionRejectedReadinessSchema = typeof GameActionRejectedReadinessSchema;

export namespace GameActionRejectedReadinessSchema {
	export type Type = z.infer<typeof GameActionRejectedReadinessSchema>;
}
