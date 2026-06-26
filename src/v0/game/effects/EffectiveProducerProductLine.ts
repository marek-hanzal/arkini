import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export type EffectiveLootQuantity =
	| number
	| {
			max: number;
			min: number;
	  };

export interface EffectiveLootTableEntry {
	lootTableId: string;
	chance: number;
}

export interface EffectiveChanceItemEntry {
	itemId: string;
	chance: number;
	quantity?: EffectiveLootQuantity;
}

export interface AppliedGameEffectOperation {
	effectId: string;
	effectName: string;
	kind: GameConfig["effects"][string]["operations"][number]["kind"];
	sourceId: string;
	sourceItemInstanceId: string;
}

export interface EffectiveProducerProductLine {
	appliedEffects: AppliedGameEffectOperation[];
	blocked: boolean;
	blockReasons: AppliedGameEffectOperation[];
	durationMs: number;
	lootPlan: {
		appendTables: EffectiveLootTableEntry[];
		baseDropChance: number;
		chanceItems: EffectiveChanceItemEntry[];
		lootTableIds: string[];
	};
	visible: boolean;
}
