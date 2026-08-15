import type { Effect } from "effect";

import type { PlannerBudgetExceeded } from "~/editor/planner/PlannerBudget";
import type { PlannerProblem } from "~/editor/planner/PlannerProblem";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { PlannerStructuralReachability } from "~/editor/planner/PlannerStructuralReachability";

export const PlannerStrategyId = {
	adaptive: "adaptive",
	bestFirst: "best-first",
	constructive: "constructive",
	editor: "editor",
	producerExpansion: "producer-expansion",
} as const;

export type BuiltInPlannerStrategyId = (typeof PlannerStrategyId)[keyof typeof PlannerStrategyId];

export type PlannerNoFinitePathProof = Exclude<
	PlannerStructuralReachability,
	{
		readonly type: "reachable";
	}
>;

export type PlannerStrategyInconclusiveReason =
	| "action-unsupported"
	| "non-quiescent-runtime"
	| "search-budget"
	| "search-exhausted"
	| "session-budget"
	| "unsupported-routes";

export interface PlannerStrategyMetrics {
	readonly expandedNodes: number;
	readonly frontierSize: number;
	readonly traceLength: number;
	readonly visitedNodes: number;
}

export type PlannerStrategyResult<StrategyId extends string, Diagnostics> =
	| {
			readonly availableQuantity: number;
			readonly diagnostics: Diagnostics;
			readonly execution: PlannerSearchExecutionState;
			readonly metrics: PlannerStrategyMetrics;
			readonly strategyId: StrategyId;
			readonly type: "completed";
	  }
	| {
			readonly diagnostics: Diagnostics;
			readonly metrics: PlannerStrategyMetrics;
			readonly proof: PlannerNoFinitePathProof;
			readonly strategyId: StrategyId;
			readonly type: "no-finite-path";
	  }
	| {
			readonly bestAvailableQuantity: number;
			readonly blockedActionIds: ReadonlyArray<string>;
			readonly budgetLimit?: string;
			readonly diagnostics: Diagnostics;
			readonly metrics: PlannerStrategyMetrics;
			readonly reason: PlannerStrategyInconclusiveReason;
			readonly strategyId: StrategyId;
			readonly type: "inconclusive";
			readonly unsupportedActionIds: ReadonlyArray<string>;
	  };

/** One planning algorithm. It chooses what to try; the engine remains the transition authority. */
export interface PlannerStrategy<StrategyId extends string, Diagnostics, Environment> {
	readonly id: StrategyId;
	readonly solveFx: (
		problem: PlannerProblem,
	) => Effect.Effect<
		PlannerStrategyResult<StrategyId, Diagnostics>,
		PlannerBudgetExceeded,
		Environment
	>;
}

export type AnyPlannerStrategyResult = PlannerStrategyResult<string, unknown>;
