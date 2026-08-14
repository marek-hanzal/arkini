import type { Effect } from "effect";

import type { PlannerBudgetExceeded } from "~/editor/planner/PlannerBudget";
import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { AnyPlannerStrategyResult } from "~/editor/planner/PlannerStrategy";
import type { PlannerStructuralReachability } from "~/editor/planner/PlannerStructuralReachability";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface PlannerGoalSearchBudget {
	readonly maximumAgendaDepth: number;
	readonly maximumConcurrentBranches: number;
	readonly maximumExpandedBranches: number;
	readonly maximumQueuedBranches: number;
	readonly maximumTraceLength: number;
}

export const DefaultPlannerGoalSearchBudget: PlannerGoalSearchBudget = {
	maximumAgendaDepth: 256,
	maximumConcurrentBranches: 4,
	maximumExpandedBranches: 2_000,
	maximumQueuedBranches: 512,
	maximumTraceLength: 500,
};

export type PlannerGoalSearchBudgetLimit = Exclude<
	keyof PlannerGoalSearchBudget,
	"maximumConcurrentBranches"
>;

export interface PlannerGoalSearchDiagnostics {
	readonly attemptedActions: number;
	readonly backtracks: number;
	readonly blockedBranches: number;
	readonly createdBranches: number;
	readonly deadEndBranches: number;
	readonly delegatedCompletedSubgoals: number;
	readonly delegatedExpandedNodes: number;
	readonly delegatedInconclusiveSubgoals: number;
	readonly delegatedMaximumFrontierSize: number;
	readonly delegatedNoFinitePathSubgoals: number;
	readonly delegatedSubgoals: number;
	readonly delegatedVisitedNodes: number;
	readonly duplicateBranches: number;
	readonly expandedBranches: number;
	readonly maximumAgendaDepth: number;
	readonly maximumConcurrentBranches: number;
	readonly maximumFrontierSize: number;
	readonly unsupportedBranches: number;
	readonly winningChoicePath?: ReadonlyArray<number>;
}

export interface PlannerGoalSearchSubgoalRequest {
	readonly agenda: ReadonlyArray<PlannerItemGoal>;
	readonly goal: PlannerItemGoal;
	readonly reason: string;
	readonly runtime: RuntimeSchema.Type;
}

export type PlannerGoalSearchSubgoalSolver = (
	request: PlannerGoalSearchSubgoalRequest,
) => Effect.Effect<AnyPlannerStrategyResult, PlannerBudgetExceeded>;

interface PlannerGoalSearchResultBase {
	readonly diagnostics: PlannerGoalSearchDiagnostics;
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
}

export type PlannerGoalSearchResult =
	| (PlannerGoalSearchResultBase & {
			readonly availableQuantity: number;
			readonly execution: PlannerSearchExecutionState;
			readonly type: "completed";
	  })
	| (PlannerGoalSearchResultBase & {
			readonly proof: Exclude<
				PlannerStructuralReachability,
				{
					readonly type: "reachable";
				}
			>;
			readonly type: "no-finite-path";
	  })
	| (PlannerGoalSearchResultBase & {
			readonly bestAvailableQuantity: number;
			readonly bestExecution: PlannerSearchExecutionState;
			readonly blockedActionIds: ReadonlyArray<string>;
			readonly budgetLimit?: string;
			readonly frontierSize: number;
			readonly reason:
				| "action-unsupported"
				| "non-quiescent-runtime"
				| "search-budget"
				| "search-exhausted";
			readonly type: "inconclusive";
			readonly unsupportedActionIds: ReadonlyArray<string>;
	  });
