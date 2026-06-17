export interface GameEngineError {
	type: "invalid-save" | "invalid-config-reference";
	message: string;
}
