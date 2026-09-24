import type { GraphOperation } from "~/graph/type/GraphFacts";

/** Exact authored role occurrence; parallel edges and unavailable operations remain discoverable. */
export interface GraphOperationParticipant {
	readonly operationId: string;
	readonly nodeId: string;
	readonly edgeId?: string;
	readonly role: "owner" | "target" | "input" | "output" | "reference";
}

/** Whole-operation effect, regardless of the selected output branch. */
export interface GraphOperationParticipantEffect {
	readonly node: string;
	readonly effect: "preserved" | "consumed" | "replaced" | "removed" | "spent";
}

export interface GraphOperationRequirement extends GraphOperationParticipantEffect {
	readonly role: "owner" | "input" | "target";
}

/** One possible output occurrence, with only compatible co-products. */
export interface GraphOperationOutput {
	readonly edgeId: string;
	readonly to: string;
	readonly output: "replacement" | "outcome";
	readonly createdNodes: readonly string[];
	readonly prerequisites: readonly string[];
	readonly chance?: number;
	readonly alternative?: boolean;
	readonly quantityMin?: number;
	readonly quantityMax?: number;
}

export interface GraphIndexedOperation {
	readonly operation: GraphOperation;
	readonly required: readonly GraphOperationRequirement[];
	readonly prerequisites: readonly string[];
	readonly outputs: readonly GraphOperationOutput[];
}

/** Snapshot normalization shared by authored discovery, audits and causal lineage queries. */
export interface GraphOperationIndex {
	readonly nodes: ReadonlySet<string>;
	readonly participants: readonly GraphOperationParticipant[];
	readonly operations: readonly GraphIndexedOperation[];
	readonly outgoing: ReadonlyMap<string, readonly GraphIndexedOperation[]>;
}
