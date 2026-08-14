import type { Effect } from "effect";

import type { BestFirstPlannerStrategy } from "~/editor/planner/BestFirstPlannerStrategy";
import type { ConstructivePlannerStrategy } from "~/editor/planner/ConstructivePlannerStrategy";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerResult } from "~/editor/planner/PlannerResult";
import type { PlannerStrategyPlanEntry } from "~/editor/planner/PlannerStrategyPlan";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface PlannerStrategies {
	readonly bestFirst: BestFirstPlannerStrategy;
	readonly constructive: ConstructivePlannerStrategy;
}

export interface PlannerEstimateRequest {
	readonly itemId: IdSchema.Type;
	readonly quantity?: number;
	readonly runtime?: RuntimeSchema.Type;
	readonly strategyPlan?: ReadonlyArray<PlannerStrategyPlanEntry>;
}

/** Public orchestration boundary above planner strategies and canonical engine transitions. */
export interface Planner {
	readonly estimateFx: (request: PlannerEstimateRequest) => Effect.Effect<PlannerResult>;
	readonly graph: PlannerAcquisitionGraph;
	readonly initialRuntime: RuntimeSchema.Type;
	readonly strategies: PlannerStrategies;
}
