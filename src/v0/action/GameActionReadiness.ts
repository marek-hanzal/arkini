import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";

export type GameActionReadiness =
	| {
			type: "ready";
	  }
	| {
			errorTag:
				| "GameActionInvalid"
				| "GameActionRejected"
				| "GamePlacementFailed"
				| "GameConfigReferenceMissing"
				| "GameSaveInvalid";
			message: string;
			reason?:
				| "input_mismatch"
				| "input_unavailable"
				| "invalid_actor"
				| "invalid_merge"
				| "item_busy"
				| "craft_in_progress"
				| "effect:missing-grant"
				| "effect:missing-capacity"
				| "effect:disabled-output"
				| "producer_queue_full"
				| "producer_charges_depleted"
				| "blocked"
				| "storage_restricted"
				| "unsupported_target"
				| GamePlacementFailureReason;
			type: "rejected";
	  };
