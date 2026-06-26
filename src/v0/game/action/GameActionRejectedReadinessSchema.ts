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
					"exclusive_conflict",
					"input_mismatch",
					"input_unavailable",
					"invalid_actor",
					"invalid_merge",
					"item_busy",
					"craft_in_progress",
					"missing_requirement",
					"producer_queue_full",
					"blocked",
					"storage_restricted",
					"stash_depleted",
					"unsupported_target",
					"unsupported_requirement",
				]),
				GamePlacementFailureReasonSchema,
			])
			.optional(),
		type: z.literal("rejected"),
	})
	.strict();
