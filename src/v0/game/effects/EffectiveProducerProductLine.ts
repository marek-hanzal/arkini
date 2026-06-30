import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

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
	kind: NonNullable<GameConfig["products"][string]["effects"]>[number]["kind"];
	sourceId: string;
	sourceItemInstanceId: string;
}

interface RuntimeLineEffectRequirement {
	label: string;
	ready: boolean;
	display: NonNullable<GameConfig["products"][string]["effects"]>[number]["display"];
	kind: NonNullable<GameConfig["products"][string]["effects"]>[number]["kind"];
}

export interface EffectiveProducerProductLine {
	appliedEffects: AppliedGameEffectOperation[];
	blocked: boolean;
	blockReasons: AppliedGameEffectOperation[];
	durationMs: number;
	grantIds?: string[];
	grantsReady?: boolean;
	lootPlan: {
		baseOutput: NonNullable<GameConfig["products"][string]["output"]>;
		chanceItems: EffectiveChanceItemEntry[];
	};
	requirements: RuntimeLineEffectRequirement[];
	visible: boolean;
}
