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
				| "missing_requirement"
				| "unsupported_requirement";
			readonly message: string;
	  }
	| {
			readonly _tag: "GameConfigReferenceMissing";
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
};
