import type { WorldEntityRef } from "~/world/WorldEntityRef";

export type WorldWakeReasonCode =
	| "active_effect_end"
	| "active_effect_start"
	| "craft_ready"
	| "item_spawn_ready"
	| "producer_queue_ready";

export interface WorldWakeReason {
	atMs: number;
	entity: WorldEntityRef;
	reason: WorldWakeReasonCode;
}
