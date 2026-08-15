import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { PlannerNoFinitePathProof } from "~/editor/planner/PlannerStrategy";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

export interface PlannerProducerExpansionBudget {
	readonly maximumExpandedActions: number;
	readonly maximumTraceLength: number;
}

export const DefaultPlannerProducerExpansionBudget: PlannerProducerExpansionBudget = {
	maximumExpandedActions: 1_000,
	maximumTraceLength: 500,
};

export type PlannerProducerExpansionBudgetLimit = keyof PlannerProducerExpansionBudget;

export interface PlannerProducerExpansionAvailability {
	readonly itemId: IdSchema.Type;
	readonly readyAtMs: number;
}

export interface PlannerProducerExpansionDiagnostics {
	readonly advancedActions: number;
	readonly attemptedActions: number;
	readonly availability: ReadonlyArray<PlannerProducerExpansionAvailability>;
	readonly blockedActionIds: ReadonlyArray<string>;
	readonly deferredDestructiveActionIds: ReadonlyArray<string>;
	readonly demandedItemIds: ReadonlyArray<IdSchema.Type>;
	readonly discoveredItemIds: ReadonlyArray<IdSchema.Type>;
	readonly maximumCandidateCount: number;
	readonly unsupportedActionIds: ReadonlyArray<string>;
}

export type PlannerProducerExpansionResult =
	| {
			readonly availableQuantity: number;
			readonly diagnostics: PlannerProducerExpansionDiagnostics;
			readonly execution: PlannerSearchExecutionState;
			readonly expandedActions: number;
			readonly type: "completed";
			readonly visitedWorlds: number;
	  }
	| {
			readonly diagnostics: PlannerProducerExpansionDiagnostics;
			readonly proof: PlannerNoFinitePathProof;
			readonly type: "no-finite-path";
	  }
	| {
			readonly bestAvailableQuantity: number;
			readonly bestExecution: PlannerSearchExecutionState;
			readonly blockedActionIds: ReadonlyArray<string>;
			readonly budgetLimit?: PlannerProducerExpansionBudgetLimit;
			readonly diagnostics: PlannerProducerExpansionDiagnostics;
			readonly expandedActions: number;
			readonly reason: "search-budget" | "search-exhausted";
			readonly type: "inconclusive";
			readonly unsupportedActionIds: ReadonlyArray<string>;
			readonly visitedWorlds: number;
	  };
