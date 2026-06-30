type WorldReplacementSafetyStatus = "blocked" | "safe";

export type WorldReplacementBlockReason =
	| "craft_input_state"
	| "craft_job"
	| "producer_job"
	| "producer_runtime_state"
	| "stash_runtime_state";

export interface WorldReplacementSafetyFacts {
	blockReasons: WorldReplacementBlockReason[];
	itemInstanceId: string;
	status: WorldReplacementSafetyStatus;
}
