import type { Effect } from "effect";

import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { PlannerStructuralReachability } from "~/editor/planner/PlannerStructuralReachability";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export const PlannerStrategyId = {
	bestFirst: "best-first",
	constructive: "constructive",
} as const;

export type PlannerStrategyId = (typeof PlannerStrategyId)[keyof typeof PlannerStrategyId];

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
	| "unsupported-routes";

/** Fully resolved strategy input over one immutable candidate runtime. */
export interface PlannerStrategyRequest {
	readonly goal: PlannerItemGoal;
	readonly runtime: RuntimeSchema.Type;
}

export type PlannerStrategyResult<StrategyId extends PlannerStrategyId, Diagnostics> =
	| {
			readonly availableQuantity: number;
			readonly diagnostics: Diagnostics;
			readonly execution: PlannerSearchExecutionState;
			readonly strategyId: StrategyId;
			readonly type: "completed";
	  }
	| {
			readonly diagnostics: Diagnostics;
			readonly proof: PlannerNoFinitePathProof;
			readonly strategyId: StrategyId;
			readonly type: "no-finite-path";
	  }
	| {
			readonly bestAvailableQuantity: number;
			readonly blockedActionIds: ReadonlyArray<string>;
			readonly budgetLimit?: string;
			readonly diagnostics: Diagnostics;
			readonly frontierSize: number;
			readonly reason: PlannerStrategyInconclusiveReason;
			readonly strategyId: StrategyId;
			readonly type: "inconclusive";
			readonly unsupportedActionIds: ReadonlyArray<string>;
	  };

/** One planning algorithm. It decides what to try; the engine remains the transition authority. */
export interface PlannerStrategy<StrategyId extends PlannerStrategyId, Budget, Diagnostics> {
	readonly defaultBudget: Budget;
	readonly id: StrategyId;
	readonly runFx: (
		request: PlannerStrategyRequest,
		budget?: Partial<Budget>,
	) => Effect.Effect<PlannerStrategyResult<StrategyId, Diagnostics>>;
}
