import type { GameLineDefinition } from "~/config/GameItemCapabilities";

type LineDefinition = GameLineDefinition;
type LineOutput = NonNullable<LineDefinition["output"]>;
type LineOutputSet = LineOutput[number];
type LineOutputEntry = LineOutputSet["entries"][number];
type WeightedLineOutput = Extract<
	LineOutputEntry,
	{
		type: "weighted";
	}
>;
type NonWeightedLineOutput = Exclude<LineOutputEntry, WeightedLineOutput>;
type WeightedLineOutputEntry = WeightedLineOutput["entries"][number];

type LineDropEffect = NonNullable<NonWeightedLineOutput["effects"]>[number];
type CommonLineEffect = NonNullable<LineDefinition["effects"]>[number];
type RuntimeLineEffect = LineDropEffect | CommonLineEffect;

export interface EffectiveChanceItemEntry {
	dropEffects?: EffectiveDropEffectOutcome[];
	effectId?: string;
	effectName?: string;
	sourceDropId: string;
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
	durationMultiplier?: number;
	effectId: string;
	effectName: string;
	kind: RuntimeLineEffect["kind"];
	sourceId: string;
	sourceItemInstanceId: string;
	targetItemId?: string;
}

interface RuntimeLineEffectRequirement {
	label: string;
	ready: boolean;
	display: RuntimeLineEffect["display"];
	kind: RuntimeLineEffect["kind"];
	phase?: "start" | "visibility";
}

export interface EffectiveDropEffectOutcome {
	active: boolean;
	display: LineDropEffect["display"];
	effectId: string;
	effectName: string;
	impact: "availability" | "chance" | "visibility";
	kind: RuntimeLineEffect["kind"];
	label: string;
	phase?: "start" | "visibility";
	ready: boolean;
	result: string;
}

type EffectiveNonWeightedLineOutputEntry = NonWeightedLineOutput & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	visible: boolean;
};

export type EffectiveWeightedLineOutputSubEntry = WeightedLineOutputEntry & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	visible: boolean;
};

type EffectiveWeightedLineOutputEntry = Omit<WeightedLineOutput, "entries"> & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	entries: EffectiveWeightedLineOutputSubEntry[];
	visible: boolean;
};

export type EffectiveLineOutputEntry =
	| EffectiveNonWeightedLineOutputEntry
	| EffectiveWeightedLineOutputEntry;

export interface EffectiveLineOutputSet {
	weight: number;
	baseOutput: EffectiveLineOutputEntry[];
	chanceItems: EffectiveChanceItemEntry[];
	visibleOutput: EffectiveLineOutputEntry[];
}

export interface EffectiveLootPlan {
	outputSets?: EffectiveLineOutputSet[];
	baseOutput: EffectiveLineOutputEntry[];
	chanceItems: EffectiveChanceItemEntry[];
	visibleOutput: EffectiveLineOutputEntry[];
}

export interface EffectiveLine {
	appliedEffects: AppliedGameEffectOperation[];
	blocked: boolean;
	blockReasons: AppliedGameEffectOperation[];
	durationMs: number;
	effectDurationMultiplier?: number;
	grantIds?: string[];
	startRequirementsReady?: boolean;
	lootPlan: {
		outputSets?: EffectiveLineOutputSet[];
		baseOutput: EffectiveLineOutputEntry[];
		chanceItems: EffectiveChanceItemEntry[];
		visibleOutput: EffectiveLineOutputEntry[];
	};
	requirements: RuntimeLineEffectRequirement[];
	visible: boolean;
}
