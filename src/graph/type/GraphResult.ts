import type { GraphEdge, GraphNode, GraphOperation } from "~/graph/type/GraphFacts";

export interface GraphResult {
	readonly projectId: string;
	readonly revision: number;
	readonly status: "yes" | "no" | "unknown";
	readonly truncated: boolean;
	readonly reasons: readonly ("depth" | "limit" | "expansions" | "timeout")[];
	readonly nodes: readonly GraphNode[];
	readonly edges: readonly GraphEdge[];
	readonly operations: readonly GraphOperation[];
	/** Each path stores node order and edge IDs; edge orientation remains authored in edges. */
	readonly paths: readonly {
		readonly nodes: readonly string[];
		readonly edges: readonly string[];
	}[];
	readonly expansions: number;
}
