import type { PlannerSearchDiagnostics } from "~/editor/planner/PlannerSearch";

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

export interface EditorItemSimulationChargeCost {
	readonly charges: number;
	readonly itemId: string;
}

export type EditorItemSimulationOutputCertainty = "deterministic" | "possible";

export type EditorItemSimulationSearchDiagnostics = PlannerSearchDiagnostics;

export type EditorItemSimulationPlanner =
	| {
			readonly assumptions: ReadonlyArray<string>;
			readonly diagnostics: EditorItemSimulationSearchDiagnostics;
			readonly expectedActionRuns: number;
			readonly expectedSpentCharges: ReadonlyArray<EditorItemSimulationChargeCost>;
			readonly expandedStates: number;
			readonly method: "engine-backed-search";
			readonly observedActionRuns: number;
			readonly observedRuntimeMs: number;
			readonly outputCertainty: EditorItemSimulationOutputCertainty;
			readonly selectedWitnessProbability: number;
			readonly type: "completed";
			readonly visitedStates: number;
	  }
	| {
			readonly diagnostics: EditorItemSimulationSearchDiagnostics;
			readonly method: "engine-backed-search";
			readonly proofType: "no-finite-path" | "target-missing";
			readonly type: "no-finite-path";
	  }
	| {
			readonly bestAvailableQuantity: number;
			readonly budgetLimit?: string;
			readonly expandedStates: number;
			readonly diagnostics: EditorItemSimulationSearchDiagnostics;
			readonly method: "engine-backed-search";
			readonly reason:
				| "action-unsupported"
				| "non-quiescent-runtime"
				| "search-budget"
				| "search-exhausted"
				| "session-budget"
				| "unsupported-routes";
			readonly type: "inconclusive";
			readonly visitedStates: number;
	  };

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
	readonly status: "estimated" | "inconclusive" | "no-finite-path";
	readonly runtimeMs?: number;
	readonly cost: ReadonlyArray<EditorItemSimulationCost>;
	readonly totalCostQuantity: number;
	readonly infrastructureItemIds: ReadonlySet<string>;
	readonly operations: ReadonlyArray<EditorItemSimulationOperation>;
	readonly blockers: ReadonlyArray<EditorItemSimulationBlocker>;
	readonly warnings: ReadonlyArray<string>;
	/** Engine-backed feasibility and expected-economics diagnostics when projected by planner. */
	readonly planner?: EditorItemSimulationPlanner;
}
