export type GameEngineError =
	| {
			readonly _tag: "GameActionInvalid";
			readonly message: string;
	  }
	| {
			readonly _tag: "GameActionRejected";
			readonly reason:
				| "input_mismatch"
				| "input_unavailable"
				| "invalid_actor"
				| "invalid_merge"
				| "missing_requirement"
				| "placement_unavailable"
				| "stash_depleted"
				| "unsupported_target"
				| "unsupported_requirement"
				| "upgrade_complete"
				| "upgrade_in_progress";
			readonly message: string;
	  }
	| {
			readonly _tag: "GameConfigReferenceMissing";
			readonly message: string;
	  }
	| {
			readonly _tag: "GameSaveInvalid";
			readonly message: string;
	  };

export const GameEngineError = {
	actionInvalid(message: string): GameEngineError {
		return {
			_tag: "GameActionInvalid",
			message,
		};
	},
	actionRejected(
		reason: Extract<
			GameEngineError,
			{
				_tag: "GameActionRejected";
			}
		>["reason"],
		message: string,
	): GameEngineError {
		return {
			_tag: "GameActionRejected",
			message,
			reason,
		};
	},
	configReferenceMissing(message: string): GameEngineError {
		return {
			_tag: "GameConfigReferenceMissing",
			message,
		};
	},
	saveInvalid(message: string): GameEngineError {
		return {
			_tag: "GameSaveInvalid",
			message,
		};
	},
};
