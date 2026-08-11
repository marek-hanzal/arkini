export type EditorItemSimulationScenario = "best" | "expected" | "guaranteed";

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

export interface EditorItemSimulationScenarioResult {
	readonly scenario: EditorItemSimulationScenario;
	readonly status: "estimated" | "no-finite-path";
	readonly runtimeMs?: number;
	readonly cost: ReadonlyArray<EditorItemSimulationCost>;
	readonly totalCostQuantity: number;
	readonly infrastructureItemIds: ReadonlySet<string>;
	readonly operations: ReadonlyArray<EditorItemSimulationOperation>;
	readonly warnings: ReadonlyArray<string>;
}

export interface EditorItemSimulation {
	readonly itemId: string;
	readonly quantity: number;
	readonly scenarios: ReadonlyArray<EditorItemSimulationScenarioResult>;
}
