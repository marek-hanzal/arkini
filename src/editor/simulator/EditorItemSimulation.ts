export interface EditorItemSimulationOperation {
	readonly id: string;
	readonly ownerItemId: string;
	readonly lineId: string;
	readonly label: string;
	readonly runs: number;
	readonly runtimeMs: number;
}

export interface EditorItemSimulationCost {
	readonly itemId: string;
	readonly quantity: number;
}

export type EditorItemSimulationBlockerCode =
	| "dependency-cycle"
	| "missing-source"
	| "operation-blocked"
	| "production-stalled"
	| "run-limit";

export interface EditorItemSimulationBlocker {
	readonly code: EditorItemSimulationBlockerCode;
	readonly itemId: string;
	readonly message: string;
	readonly operationId?: string;
	readonly ownerItemId?: string;
	readonly path: ReadonlyArray<string>;
}

export interface EditorItemSimulation {
	readonly itemId: string;
	readonly quantity: number;
	readonly status: "estimated" | "no-finite-path";
	readonly runtimeMs?: number;
	readonly cost: ReadonlyArray<EditorItemSimulationCost>;
	readonly totalCostQuantity: number;
	readonly infrastructureItemIds: ReadonlySet<string>;
	readonly operations: ReadonlyArray<EditorItemSimulationOperation>;
	readonly blockers: ReadonlyArray<EditorItemSimulationBlocker>;
	readonly warnings: ReadonlyArray<string>;
}
