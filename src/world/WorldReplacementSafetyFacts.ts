type WorldReplacementSafetyStatus = "blocked" | "safe";

export type WorldReplacementBlockReason =
	| "craft_input_state"
	| "craft_job"
	| "item_capacity_state"
	| "producer_job"
	| "producer_runtime_state"
	| "stash_runtime_state";

export interface WorldReplacementSafetyFacts {
	blockReasons: WorldReplacementBlockReason[];
	itemInstanceId: string;
	status: WorldReplacementSafetyStatus;
}
