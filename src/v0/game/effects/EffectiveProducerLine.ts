import type { GameProducerLineDefinition } from "~/v0/game/config/GameItemCapabilities";

type ProducerLineDefinition = GameProducerLineDefinition;
type ProducerLineOutput = NonNullable<ProducerLineDefinition["output"]>;
type ProducerLineOutputEntry = ProducerLineOutput[number];
type WeightedProducerLineOutput = Extract<
	ProducerLineOutputEntry,
	{
		type: "weighted";
	}
>;
type NonWeightedProducerLineOutput = Exclude<ProducerLineOutputEntry, WeightedProducerLineOutput>;
type WeightedProducerLineOutputEntry = WeightedProducerLineOutput["entries"][number];

type ProducerLineDropEffect = NonNullable<NonWeightedProducerLineOutput["effects"]>[number];

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
	kind: ProducerLineDropEffect["kind"];
	sourceId: string;
	sourceItemInstanceId: string;
}

interface RuntimeLineEffectRequirement {
	label: string;
	ready: boolean;
	display: ProducerLineDropEffect["display"];
	kind: ProducerLineDropEffect["kind"];
	phase?: "start" | "visibility";
}

export interface EffectiveDropEffectOutcome {
	active: boolean;
	display: ProducerLineDropEffect["display"];
	effectId: string;
	effectName: string;
	impact: "availability" | "chance" | "visibility";
	kind: ProducerLineDropEffect["kind"];
	label: string;
	phase?: "start" | "visibility";
	ready: boolean;
	result: string;
}

export type EffectiveNonWeightedProducerLineOutputEntry = NonWeightedProducerLineOutput & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	visible: boolean;
};

export type EffectiveWeightedProducerLineOutputSubEntry = WeightedProducerLineOutputEntry & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	visible: boolean;
};

export type EffectiveWeightedProducerLineOutputEntry = Omit<
	WeightedProducerLineOutput,
	"entries"
> & {
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	entries: EffectiveWeightedProducerLineOutputSubEntry[];
	visible: boolean;
};

export type EffectiveProducerLineOutputEntry =
	| EffectiveNonWeightedProducerLineOutputEntry
	| EffectiveWeightedProducerLineOutputEntry;

export interface EffectiveProducerLine {
	appliedEffects: AppliedGameEffectOperation[];
	blocked: boolean;
	blockReasons: AppliedGameEffectOperation[];
	durationMs: number;
	effectDurationMultiplier?: number;
	grantIds?: string[];
	startRequirementsReady?: boolean;
	lootPlan: {
		baseOutput: EffectiveProducerLineOutputEntry[];
		chanceItems: EffectiveChanceItemEntry[];
		visibleOutput: EffectiveProducerLineOutputEntry[];
	};
	requirements: RuntimeLineEffectRequirement[];
	visible: boolean;
}
