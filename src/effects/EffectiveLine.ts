import type { GameLineDefinition } from "~/config/GameItemCapabilities";

type LineDefinition = GameLineDefinition;
type LineOutput = NonNullable<LineDefinition["output"]>;
type LineOutputEntry = LineOutput[number];
type WeightedLineOutput = Extract<
	LineOutputEntry,
	{
		type: "weighted";
	}
>;
type NonWeightedLineOutput = Exclude<LineOutputEntry, WeightedLineOutput>;
type WeightedLineOutputEntry = WeightedLineOutput["entries"][number];

type LineDropEffect = NonNullable<NonWeightedLineOutput["effects"]>[number];

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
	effectId: string;
	effectName: string;
	kind: LineDropEffect["kind"];
	sourceId: string;
	sourceItemInstanceId: string;
}

interface RuntimeLineEffectRequirement {
	label: string;
	ready: boolean;
	display: LineDropEffect["display"];
	kind: LineDropEffect["kind"];
	phase?: "start" | "visibility";
}

export interface EffectiveDropEffectOutcome {
	active: boolean;
	display: LineDropEffect["display"];
	effectId: string;
	effectName: string;
	impact: "availability" | "chance" | "visibility";
	kind: LineDropEffect["kind"];
	label: string;
	phase?: "start" | "visibility";
	ready: boolean;
	result: string;
}

export type EffectiveNonWeightedLineOutputEntry = NonWeightedLineOutput & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	visible: boolean;
};

export type EffectiveWeightedLineOutputSubEntry = WeightedLineOutputEntry & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	visible: boolean;
};

export type EffectiveWeightedLineOutputEntry = Omit<WeightedLineOutput, "entries"> & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	entries: EffectiveWeightedLineOutputSubEntry[];
	visible: boolean;
};

export type EffectiveLineOutputEntry =
	| EffectiveNonWeightedLineOutputEntry
	| EffectiveWeightedLineOutputEntry;

export interface EffectiveLine {
	appliedEffects: AppliedGameEffectOperation[];
	blocked: boolean;
	blockReasons: AppliedGameEffectOperation[];
	durationMs: number;
	effectDurationMultiplier?: number;
	grantIds?: string[];
	startRequirementsReady?: boolean;
	lootPlan: {
		baseOutput: EffectiveLineOutputEntry[];
		chanceItems: EffectiveChanceItemEntry[];
		visibleOutput: EffectiveLineOutputEntry[];
	};
	requirements: RuntimeLineEffectRequirement[];
	visible: boolean;
}
