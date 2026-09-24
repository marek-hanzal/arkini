import type { GraphOperation } from "~/graph/type/GraphFacts";
import type { GraphOperationParticipantEffect } from "~/graph/type/GraphOperationIndex";
import type { GraphResult } from "~/graph/type/GraphResult";

/** One causal link through a complete authored operation, never an owner-membership hop. */
export interface GraphFlowStep {
	readonly from: string;
	readonly to: string;
	readonly operationId: string;
	readonly kind: GraphOperation["kind"];
	readonly owner: string;
	readonly evidence: {
		readonly participantEffects: readonly GraphOperationParticipantEffect[];
		/** Only products compatible with this selected outcome occurrence. */
		readonly createdNodes: readonly string[];
		readonly fromRole: "owner" | "input" | "target";
		readonly output: "replacement" | "outcome";
		readonly prerequisiteNodes: readonly string[];
		readonly prerequisites: readonly string[];
		readonly chance?: number;
		readonly alternative?: boolean;
		readonly quantityMin?: number;
		readonly quantityMax?: number;
	};
}

export interface GraphFlow {
	readonly nodes: readonly string[];
	readonly steps: readonly GraphFlowStep[];
	readonly externalPrerequisiteNodes: readonly string[];
}

export interface GraphFlowResult {
	readonly flows: readonly GraphFlow[];
	readonly status: GraphResult["status"];
	readonly truncated: boolean;
	readonly reasons: GraphResult["reasons"];
	readonly expansions: number;
}
