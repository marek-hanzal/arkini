import type { Effect } from "effect";

import type { PlannerResult } from "~/editor/planner/PlannerResult";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface PlannerEstimateRequest<Budget = never> {
	readonly budget?: Partial<Budget>;
	readonly itemId: IdSchema.Type;
	readonly quantity?: number;
	readonly runtime?: RuntimeSchema.Type;
}

/** Public orchestration boundary above one configured root strategy and canonical engine transitions. */
export interface Planner<
	StrategyId extends string = string,
	Budget = never,
	Diagnostics = unknown,
> {
	readonly estimateFx: (
		request: PlannerEstimateRequest<Budget>,
	) => Effect.Effect<PlannerResult<StrategyId, Diagnostics>>;
	readonly strategyId: StrategyId;
}
