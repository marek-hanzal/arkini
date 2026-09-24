import type { GraphEdge, GraphNode, GraphOperation } from "~/graph/type/GraphFacts";

/** Exact authored role occurrence; parallel edges and unavailable operations remain discoverable. */
export interface GraphOperationParticipant {
	readonly operationId: string;
	readonly nodeId: string;
	readonly edgeId?: string;
	readonly role: "owner" | "target" | "input" | "output" | "reference";
}

/** Traversal entry into an operation; no claim about availability or consumption. */
export interface GraphOperationSource {
	readonly node: string;
	readonly role: "owner" | "input" | "target";
}

export interface GraphIndexedOperation {
	readonly operation: GraphOperation;
	readonly sources: readonly GraphOperationSource[];
	readonly outputs: readonly GraphEdge[];
}

/** Snapshot adjacency shared by authored discovery, audits and operation paths. */
export interface GraphOperationIndex {
	readonly nodes: ReadonlyMap<string, GraphNode>;
	readonly participants: readonly GraphOperationParticipant[];
	readonly operations: readonly GraphIndexedOperation[];
	readonly outgoing: ReadonlyMap<string, readonly GraphIndexedOperation[]>;
}
