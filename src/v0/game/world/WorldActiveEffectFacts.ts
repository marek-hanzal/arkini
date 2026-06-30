import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

type WorldActiveEffectStatus =
	| "active"
	| "blocked_by_paused_queue_head"
	| "expired"
	| "inactive_source_missing"
	| "out_of_scope"
	| "producer_paused"
	| "scheduled";

export interface WorldActiveEffectFacts {
	effect: GameSave["activeEffects"][string];
	producerJobId?: string;
	sourceLocation?: "board" | "inventory";
	status: WorldActiveEffectStatus;
}
