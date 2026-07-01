import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

type ProductDefinition = GameConfig["products"][string];
type ProductOutput = NonNullable<ProductDefinition["output"]>;
type ProductOutputEntry = ProductOutput[number];
type WeightedProductOutput = Extract<
	ProductOutputEntry,
	{
		type: "weighted";
	}
>;
type NonWeightedProductOutput = Exclude<ProductOutputEntry, WeightedProductOutput>;
type WeightedProductOutputEntry = WeightedProductOutput["entries"][number];

type ProductDropEffect = NonNullable<NonWeightedProductOutput["effects"]>[number];

export interface EffectiveChanceItemEntry {
	dropEffects?: EffectiveDropEffectOutcome[];
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
	kind: NonNullable<ProductDefinition["effects"]>[number]["kind"];
	sourceId: string;
	sourceItemInstanceId: string;
}

interface RuntimeLineEffectRequirement {
	label: string;
	ready: boolean;
	display: NonNullable<ProductDefinition["effects"]>[number]["display"];
	kind: NonNullable<ProductDefinition["effects"]>[number]["kind"];
	phase?: "start" | "visibility";
}

export interface EffectiveDropEffectOutcome {
	active: boolean;
	display: ProductDropEffect["display"];
	effectId: string;
	effectName: string;
	impact: "availability" | "chance" | "visibility";
	kind: ProductDropEffect["kind"];
	label: string;
	phase?: "start" | "visibility";
	ready: boolean;
	result: string;
}

export type EffectiveNonWeightedProductOutputEntry = NonWeightedProductOutput & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	visible: boolean;
};

export type EffectiveWeightedProductOutputSubEntry = WeightedProductOutputEntry & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	visible: boolean;
};

export type EffectiveWeightedProductOutputEntry = Omit<WeightedProductOutput, "entries"> & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	entries: EffectiveWeightedProductOutputSubEntry[];
	visible: boolean;
};

export type EffectiveProductOutputEntry =
	| EffectiveNonWeightedProductOutputEntry
	| EffectiveWeightedProductOutputEntry;

export interface EffectiveProducerProductLine {
	appliedEffects: AppliedGameEffectOperation[];
	blocked: boolean;
	blockReasons: AppliedGameEffectOperation[];
	durationMs: number;
	grantIds?: string[];
	startRequirementsReady?: boolean;
	lootPlan: {
		baseOutput: EffectiveProductOutputEntry[];
		chanceItems: EffectiveChanceItemEntry[];
		visibleOutput: EffectiveProductOutputEntry[];
	};
	requirements: RuntimeLineEffectRequirement[];
	visible: boolean;
}
