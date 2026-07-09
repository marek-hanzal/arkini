import type { GameEffect } from "~/config/readGameConfigEffects";
import type { GameSave } from "~/engine/model/GameSaveSchema";

type WorldActiveEffectStatus =
	| "active"
	| "blocked_by_paused_queue_head"
	| "expired"
	| "inactive_source_missing"
	| "out_of_scope"
	| "producer_paused"
	| "scheduled";

export interface WorldActiveEffectFacts {
	definition?: GameEffect;
	effect: GameSave["activeEffects"][string];
	producerJobId?: string;
	sourceLocation?: "board" | "inventory";
	status: WorldActiveEffectStatus;
}
