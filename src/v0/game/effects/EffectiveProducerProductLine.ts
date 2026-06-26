import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

interface EffectiveLootTableEntry {
	lootTableId: string;
	chance: number;
}

interface EffectiveChanceItemEntry {
	itemId: string;
	chance: number;
	quantity?:
		| number
		| {
				max: number;
				min: number;
		  };
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
		baseOutput: GameConfig["lootTables"][string]["output"];
		chanceItems: EffectiveChanceItemEntry[];
		lootTableIds: string[];
	};
	visible: boolean;
}
