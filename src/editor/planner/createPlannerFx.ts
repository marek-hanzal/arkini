import { Effect } from "effect";

import type { Planner } from "~/editor/planner/Planner";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerStrategy } from "~/editor/planner/PlannerStrategy";
import { createPlannerAcquisitionGraph } from "~/editor/planner/createPlannerAcquisitionGraph";
import { createPlannerInitialRuntimeFx } from "~/editor/planner/createPlannerInitialRuntimeFx";
import { runPlannerStrategyFx } from "~/editor/planner/runPlannerStrategyFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export namespace createPlannerFx {
	export interface StrategyFactoryProps {
		readonly config: GameConfigSchema.Type;
		readonly graph: PlannerAcquisitionGraph;
	}

	export interface Props<StrategyId extends string, Budget, Diagnostics> {
		readonly config: GameConfigSchema.Type;
		readonly createStrategy: (
			props: StrategyFactoryProps,
		) => PlannerStrategy<StrategyId, Budget, Diagnostics>;
	}
}

/** Creates one public planner orchestrator over a configured root strategy. */
export const createPlannerFx = <StrategyId extends string, Budget, Diagnostics>({
	config,
	createStrategy,
}: createPlannerFx.Props<StrategyId, Budget, Diagnostics>) =>
	Effect.gen(function* () {
		const graph = createPlannerAcquisitionGraph(config);
		const initialRuntime = yield* createPlannerInitialRuntimeFx(config);
		const strategy = createStrategy({
			config,
			graph,
		});
		return {
			estimateFx: Effect.fn("Planner.estimateFx")((request) =>
				runPlannerStrategyFx({
					graph,
					initialRuntime,
					request,
					strategy,
				}),
			),
			strategyId: strategy.id,
		} satisfies Planner<StrategyId, Budget, Diagnostics>;
	});
