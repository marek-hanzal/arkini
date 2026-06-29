import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

interface EffectiveOutputAppend {
	output: NonNullable<GameConfig["products"][string]["output"]>;
	chance: number;
}

interface EffectiveChanceItemEntry {
	effectId?: string;
	effectName?: string;
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
		appendOutputs: EffectiveOutputAppend[];
		baseDropChance: number;
		baseOutput: NonNullable<GameConfig["products"][string]["output"]>;
		chanceItems: EffectiveChanceItemEntry[];
	};
	visible: boolean;
}
