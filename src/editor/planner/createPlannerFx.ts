import { Effect } from "effect";

import type { PlannerBudgetLimits } from "~/editor/planner/PlannerBudget";
import type { Planner } from "~/editor/planner/Planner";
import { PlannerKernelFx } from "~/editor/planner/PlannerKernelFx";
import type { PlannerStrategy } from "~/editor/planner/PlannerStrategy";
import type { PlannerStrategyEnvironment } from "~/editor/planner/PlannerStrategyEnvironment";
import { createPlannerKernelFx } from "~/editor/planner/createPlannerKernelFx";
import { runPlannerFx } from "~/editor/planner/runPlannerFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export namespace createPlannerFx {
	export interface Props<StrategyId extends string, Diagnostics> {
		readonly budget?: Partial<PlannerBudgetLimits>;
		readonly config: GameConfigSchema.Type;
		readonly strategy: PlannerStrategy<StrategyId, Diagnostics, PlannerStrategyEnvironment>;
	}
}

/** Creates one public planner orchestrator around exactly one root strategy. */
export const createPlannerFx = <StrategyId extends string, Diagnostics>({
	budget,
	config,
	strategy,
}: createPlannerFx.Props<StrategyId, Diagnostics>) =>
	Effect.gen(function* () {
		const kernel = yield* createPlannerKernelFx(config);
		return {
			estimateFx: Effect.fn("Planner.estimateFx")((request) =>
				runPlannerFx({
					budget,
					request,
					strategy,
				}).pipe(Effect.provideService(PlannerKernelFx, kernel)),
			),
			strategyId: strategy.id,
		} satisfies Planner<StrategyId, Diagnostics>;
	});
