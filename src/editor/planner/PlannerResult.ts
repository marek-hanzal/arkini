import type { PlannerExpectedEconomics } from "~/editor/planner/PlannerExpectedEconomics";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type {
	PlannerNoFinitePathProof,
	PlannerStrategyInconclusiveReason,
	PlannerStrategyMetrics,
} from "~/editor/planner/PlannerStrategy";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

interface PlannerResultBase<StrategyId extends string, Diagnostics> {
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
	readonly strategyDiagnostics: Diagnostics;
	readonly strategyId: StrategyId;
	readonly strategyMetrics: PlannerStrategyMetrics;
}

export type PlannerResult<StrategyId extends string = string, Diagnostics = unknown> =
	| (PlannerResultBase<StrategyId, Diagnostics> & {
			readonly availableQuantity: number;
			readonly economics: PlannerExpectedEconomics;
			readonly execution: PlannerSearchExecutionState;
			readonly type: "completed";
	  })
	| (PlannerResultBase<StrategyId, Diagnostics> & {
			readonly proof: PlannerNoFinitePathProof;
			readonly type: "no-finite-path";
	  })
	| (PlannerResultBase<StrategyId, Diagnostics> & {
			readonly bestAvailableQuantity: number;
			readonly blockedActionIds: ReadonlyArray<string>;
			readonly budgetLimit?: string;
			readonly reason: PlannerStrategyInconclusiveReason;
			readonly type: "inconclusive";
			readonly unsupportedActionIds: ReadonlyArray<string>;
	  });
