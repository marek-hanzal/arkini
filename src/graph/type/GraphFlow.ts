import type { GraphOperation } from "~/graph/type/GraphFacts";
import type { GraphResult } from "~/graph/type/GraphResult";

/** One directed authored operation step, without gameplay feasibility evaluation. */
export interface GraphFlowStep {
	readonly from: string;
	readonly to: string;
	readonly operationId: string;
	readonly kind: GraphOperation["kind"];
	readonly owner: string;
	readonly evidence: {
		readonly fromRole: "owner" | "input" | "target";
		readonly output: "replacement" | "outcome";
		readonly participants: readonly string[];
		/** Explicit authored facts, including scoped rules and stochastic selection; never evaluated. */
		readonly facts: readonly string[];
	};
}

export interface GraphFlow {
	readonly nodes: readonly string[];
	readonly steps: readonly GraphFlowStep[];
}

export interface GraphFlowResult {
	readonly flows: readonly GraphFlow[];
	readonly status: GraphResult["status"];
	readonly truncated: boolean;
	readonly reasons: GraphResult["reasons"];
	readonly expansions: number;
}
