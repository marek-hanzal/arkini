import { z } from "zod";
import { GamePlacementFailureReasonSchema } from "~/placement/GamePlacementFailureReasonSchema";

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
					"effect:missing-grant",
					"effect:disabled-output",
					"producer_queue_full",
					"producer_charges_depleted",
					"blocked",
					"storage_restricted",
					"unsupported_target",
				]),
				GamePlacementFailureReasonSchema,
			])
			.optional(),
		type: z.literal("rejected"),
	})
	.strict();
