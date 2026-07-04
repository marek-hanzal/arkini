import { Data } from "effect";
import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";

type GameActionRejectedReason =
	| "input_mismatch"
	| "input_unavailable"
	| "invalid_actor"
	| "invalid_merge"
	| "item_busy"
	| "craft_in_progress"
	| "effect:missing-grant"
	| "effect:missing-capacity"
	| "effect:disabled-output"
	| GamePlacementFailureReason
	| "producer_queue_full"
	| "producer_charges_depleted"
	| "blocked"
	| "storage_restricted"
	| "unsupported_target";

class GameActionInvalidError extends Data.TaggedError("GameActionInvalid")<{
	readonly message: string;
}> {}

class GamePlacementFailedError extends Data.TaggedError("GamePlacementFailed")<{
	readonly reason: GamePlacementFailureReason;
	readonly message: string;
}> {}

class GameActionRejectedError extends Data.TaggedError("GameActionRejected")<{
	readonly reason: GameActionRejectedReason;
	readonly message: string;
}> {}

class GameConfigReferenceMissingError extends Data.TaggedError("GameConfigReferenceMissing")<{
	readonly message: string;
}> {}

class GameSaveInvalidError extends Data.TaggedError("GameSaveInvalid")<{
	readonly message: string;
}> {}

export type GameEngineError =
	| GameActionInvalidError
	| GamePlacementFailedError
	| GameActionRejectedError
	| GameConfigReferenceMissingError
	| GameSaveInvalidError;

export const GameEngineError = {
	actionInvalid(message: string): GameEngineError {
		return new GameActionInvalidError({
			message,
		});
	},
	placementFailed(reason: GamePlacementFailureReason, message: string): GameEngineError {
		return new GamePlacementFailedError({
			message,
			reason,
		});
	},
	actionRejected(reason: GameActionRejectedReason, message: string): GameEngineError {
		return new GameActionRejectedError({
			message,
			reason,
		});
	},
	configReferenceMissing(message: string): GameEngineError {
		return new GameConfigReferenceMissingError({
			message,
		});
	},
	saveInvalid(message: string): GameEngineError {
		return new GameSaveInvalidError({
			message,
		});
	},
};
