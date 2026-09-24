import type { GraphFlow } from "~/graph/type/GraphFlow";
import type { GraphEdge, GraphNode, GraphOperation } from "~/graph/type/GraphFacts";
import type { GraphResult } from "~/graph/type/GraphResult";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { ItemScheduleSchema } from "~/item-schedule/schema/ItemScheduleSchema";

export interface GraphDiscoveryNode {
	readonly id: string;
	readonly kind: GraphNode["kind"];
	readonly title: string;
	readonly missing?: boolean;
}

/** Explicit scalar whitelist; authored documents belong to hydration readers. */
export interface GraphDiscoveryEdge {
	readonly id: string;
	readonly from: string;
	readonly to: string;
	readonly kind: GraphEdge["kind"];
	readonly operationId?: string;
	readonly metadata: Pick<
		GraphEdge["annotations"],
		"alternative" | "chance" | "inputIndex" | "role" | "boardLocal"
	> & {
		readonly inputType?: "simple" | "materials" | "units";
		readonly mode?: "consume" | "reserve";
		readonly distance?: QuerySchema.Type["distance"];
		readonly quantityMin?: number;
		readonly quantityMax?: number;
		readonly unitCost?: number;
		readonly unitFrom?: "self" | "target";
		readonly x?: number;
		readonly y?: number;
	};
}

export type GraphDiscoveryOperation = {
	readonly id: string;
	readonly title: string;
	readonly owner: string;
	readonly hasOutcomes: boolean;
} & (
	| {
			readonly kind: "line";
			readonly lineUid: string;
			readonly runtimeMs: number;
			readonly default: boolean;
			readonly clock: boolean;
			readonly clockWeight: number;
			readonly show: boolean;
			readonly enable: boolean;
	  }
	| {
			readonly kind: "merge";
			readonly action: MergeSchema.Type["action"];
			readonly effect: MergeSchema.Type["effect"];
			readonly ownership: "source" | "receiver";
			readonly target?: string;
			readonly replacement?: string;
			readonly destination?: string;
	  }
	| {
			readonly kind: "clock";
			readonly intervalMs?: number;
			readonly durationMs?: number;
			readonly expiryMode?: ItemScheduleSchema.Type["expiryMode"];
			readonly enable: boolean;
	  }
	| {
			readonly kind: "depletion";
			readonly amount: number;
	  }
);

/** Query-local evidence; repeated authored occurrences remain separate and are never summed. */
export interface GraphDiscoveryMatch {
	readonly operationId: string;
	readonly nodeId: string;
	readonly role: "owner" | "target" | "input" | "output" | "reference";
	readonly edgeKind?: GraphEdge["kind"];
	readonly metadata?: GraphDiscoveryEdge["metadata"];
}

export interface GraphDiscoveryResult {
	readonly projectId: string;
	readonly revision: number;
	readonly snapshotId: string;
	readonly status: GraphResult["status"];
	readonly truncated: boolean;
	readonly reasons: GraphResult["reasons"];
	readonly expansions: number;
	readonly nodes: readonly GraphDiscoveryNode[];
	readonly edges: readonly GraphDiscoveryEdge[];
	readonly operations: readonly GraphDiscoveryOperation[];
	readonly matches?: readonly GraphDiscoveryMatch[];
	readonly paths: GraphResult["paths"];
	readonly flows?: readonly GraphFlow[];
	readonly nextCursor?: string;
}

export interface GraphBatchResult {
	readonly projectId: string;
	readonly revision: number;
	readonly snapshotId: string;
	readonly nodes: readonly GraphDiscoveryNode[];
	readonly edges: readonly GraphDiscoveryEdge[];
	readonly operations: readonly GraphDiscoveryOperation[];
	readonly queries: readonly {
		readonly id: string;
		readonly status: GraphResult["status"];
		readonly truncated: boolean;
		readonly reasons: GraphResult["reasons"];
		readonly expansions: number;
		readonly nodeIds: readonly string[];
		readonly edgeIds: readonly string[];
		readonly operationIds: readonly string[];
		readonly matches?: readonly GraphDiscoveryMatch[];
		readonly paths: GraphResult["paths"];
		readonly flows?: readonly GraphFlow[];
		readonly nextCursor?: string;
		readonly error?: {
			readonly reason: string;
			readonly message: string;
		};
	}[];
}

export interface GraphOperationReadResult {
	readonly projectId: string;
	readonly revision: number;
	readonly snapshotId: string;
	readonly operations: readonly GraphOperation[];
	readonly issues: readonly {
		readonly operationId: string;
		readonly reason: "missing-operation";
	}[];
}
