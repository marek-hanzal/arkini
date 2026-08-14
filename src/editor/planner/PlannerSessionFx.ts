import { Context, type Effect } from "effect";

import type {
	PlannerBudgetExceeded,
	PlannerBudgetLimits,
	PlannerBudgetSnapshot,
} from "~/editor/planner/PlannerBudget";
import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { PlannerProblem, PlannerSubgoalRequest } from "~/editor/planner/PlannerProblem";
import type {
	AnyPlannerStrategyResult,
	PlannerStrategy,
	PlannerStrategyResult,
} from "~/editor/planner/PlannerStrategy";
import type { PlannerKernelFx } from "~/editor/planner/PlannerKernelFx";

export type PlannerStrategyInvocationOutcome =
	| "completed"
	| "failed"
	| "inconclusive"
	| "no-finite-path"
	| "running";

export interface PlannerStrategyInvocationDiagnostic {
	readonly depth: number;
	readonly goal: PlannerItemGoal;
	readonly index: number;
	readonly outcome: PlannerStrategyInvocationOutcome;
	readonly parentInvocationIndex?: number;
	readonly path: ReadonlyArray<string>;
	readonly reason: string;
	readonly strategyId: string;
}

export interface PlannerSessionDiagnostics {
	readonly budget: {
		readonly limits: PlannerBudgetLimits;
		readonly snapshot: PlannerBudgetSnapshot;
	};
	readonly invocations: ReadonlyArray<PlannerStrategyInvocationDiagnostic>;
}

export interface PlannerSessionRunStrategyProps<StrategyId extends string, Diagnostics> {
	readonly problem: PlannerProblem;
	readonly reason: string;
	readonly strategy: PlannerStrategy<StrategyId, Diagnostics>;
}

export interface PlannerSessionFxService {
	readonly readDiagnosticsFx: Effect.Effect<PlannerSessionDiagnostics>;
	readonly runStrategyFx: <StrategyId extends string, Diagnostics>(
		props: PlannerSessionRunStrategyProps<StrategyId, Diagnostics>,
	) => Effect.Effect<
		PlannerStrategyResult<StrategyId, Diagnostics>,
		PlannerBudgetExceeded,
		PlannerKernelFx | PlannerSessionFx
	>;
	readonly solveSubgoalFx: (
		request: PlannerSubgoalRequest,
	) => Effect.Effect<
		AnyPlannerStrategyResult,
		PlannerBudgetExceeded,
		PlannerKernelFx | PlannerSessionFx
	>;
}

/** Shared orchestration state for one estimate and all recursively delegated subgoals. */
export class PlannerSessionFx extends Context.Service<PlannerSessionFx, PlannerSessionFxService>()(
	"PlannerSessionFx",
) {
	//
}
