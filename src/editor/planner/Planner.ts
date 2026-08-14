import type { Effect } from "effect";

import type { PlannerBudgetLimits } from "~/editor/planner/PlannerBudget";
import type { PlannerResult } from "~/editor/planner/PlannerResult";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface PlannerEstimateRequest {
	readonly budget?: Partial<PlannerBudgetLimits>;
	readonly itemId: IdSchema.Type;
	readonly quantity?: number;
	readonly runtime?: RuntimeSchema.Type;
}

/** Public orchestration boundary above one configured root strategy and canonical engine. */
export interface Planner<StrategyId extends string = string, Diagnostics = unknown> {
	readonly estimateFx: (
		request: PlannerEstimateRequest,
	) => Effect.Effect<PlannerResult<StrategyId, Diagnostics>>;
	readonly strategyId: StrategyId;
}
