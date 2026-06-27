import type { WorldEntityRef } from "~/v0/game/world/WorldEntityRef";

type WorldWakeReasonCode =
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
