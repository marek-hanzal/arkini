import type { Effect } from "effect";

import type { PlannerBudgetExceeded } from "~/editor/planner/PlannerBudget";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerExpectedEconomics } from "~/editor/planner/PlannerExpectedEconomics";
import type { PlannerGoalViability, PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { PlannerSearchTraceEntry } from "~/editor/planner/PlannerSearch";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { PlannerSearchAction } from "~/editor/planner/PlannerSearchScope";
import type { PlannerStructuralReachability } from "~/editor/planner/PlannerStructuralReachability";
import type { PlannerSearchCandidateResult } from "~/editor/planner/runPlannerSearchCandidateFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export interface PlannerKernelCandidateRequest {
	readonly candidate: PlannerSearchAction;
	readonly state: PlannerSearchExecutionState;
}

export interface PlannerKernelEconomicsRequest {
	readonly initialRuntime: RuntimeSchema.Type;
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
	readonly trace: ReadonlyArray<PlannerSearchTraceEntry>;
}

/**
 * Shared immutable mechanics between planner strategies and the canonical engine boundary.
 *
 * Strategies decide what to try. The kernel owns authored graph data, exact engine execution,
 * future-snapshot viability and economics projection. It exposes no live gameplay store.
 */
export interface PlannerKernel {
	readonly config: GameConfigSchema.Type;
	readonly graph: PlannerAcquisitionGraph;
	readonly initialRuntime: RuntimeSchema.Type;
	readonly readExpectedEconomicsFx: (
		request: PlannerKernelEconomicsRequest,
	) => Effect.Effect<PlannerExpectedEconomics>;
	readonly readGoalViability: (request: {
		readonly goal: PlannerItemGoal;
		readonly runtime: RuntimeSchema.Type;
	}) => PlannerGoalViability;
	readonly readStructuralReachability: (itemId: IdSchema.Type) => PlannerStructuralReachability;
	readonly runCandidateFx: (
		request: PlannerKernelCandidateRequest,
	) => Effect.Effect<PlannerSearchCandidateResult, PlannerBudgetExceeded>;
}
