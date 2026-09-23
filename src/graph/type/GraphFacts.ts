import type { GraphEdgeKindSchema } from "~/graph/schema/GraphEdgeKindSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { ItemScheduleSchema } from "~/item-schedule/schema/ItemScheduleSchema";
import type { UnitsSchema } from "~/item-definition/schema/UnitsSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";

export interface GraphNode {
	readonly id: string;
	readonly kind: "item" | "template" | "space" | "start";
	readonly title: string;
	readonly missing: boolean;
	readonly source: readonly (string | number)[];
}

/** Reified operations retain participants, scheduling, guards, costs and all alternative groups. */
export type GraphOperation = {
	readonly id: string;
	readonly owner: string;
	readonly source: readonly (string | number)[];
} & (
	| {
			readonly kind: "line";
			readonly data: LineSchema.Type;
	  }
	| {
			readonly kind: "merge";
			readonly data: MergeSchema.Type;
	  }
	| {
			readonly kind: "clock";
			readonly data: ItemScheduleSchema.Type;
	  }
	| {
			readonly kind: "depletion";
			readonly data: UnitsSchema.Type;
	  }
);

export interface GraphEdge {
	readonly id: string;
	readonly from: string;
	readonly to: string;
	readonly kind: GraphEdgeKindSchema.Type;
	readonly operationId?: string;
	/** Exact config path of the reference, including each distinct repeated occurrence. */
	readonly source: readonly (string | number)[];
	readonly annotations: {
		readonly input?: InputSchema.Type;
		readonly rule?: {
			readonly type: string;
			readonly when: readonly WhenSchema.Type[];
		};
		readonly condition?: WhenSchema.Type;
		readonly outcome?: OutcomeSchema.Type;
		readonly setId?: string;
		readonly setIndex?: number;
		readonly setWeight?: number;
		readonly alternative?: boolean;
		readonly rollId?: string;
		readonly rollIndex?: number;
		readonly rollType?: "guaranteed" | "chance";
		readonly chance?: number;
		readonly outcomeIndex?: number;
		readonly ruleIndex?: number;
		readonly whenIndex?: number;
		readonly inputIndex?: number;
		readonly role?: "source" | "target" | "receiver";
		readonly boardLocal?: boolean;
		readonly position?: {
			readonly x: number;
			readonly y: number;
		};
	};
}

export interface GraphFacts {
	readonly nodes: readonly GraphNode[];
	readonly operations: readonly GraphOperation[];
	readonly edges: readonly GraphEdge[];
}
