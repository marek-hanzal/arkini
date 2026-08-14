import { Effect } from "effect";

import type { Planner } from "~/editor/planner/Planner";
import { createBestFirstPlannerStrategy } from "~/editor/planner/createBestFirstPlannerStrategy";
import { createConstructivePlannerStrategy } from "~/editor/planner/createConstructivePlannerStrategy";
import { createPlannerAcquisitionGraph } from "~/editor/planner/createPlannerAcquisitionGraph";
import { createPlannerInitialRuntimeFx } from "~/editor/planner/createPlannerInitialRuntimeFx";
import { runPlannerStrategyPlanFx } from "~/editor/planner/runPlannerStrategyPlanFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Creates the public planner orchestrator and its registered strategies over one config snapshot. */
export const createPlannerFx = Effect.fn("createPlannerFx")((config: GameConfigSchema.Type) =>
	Effect.gen(function* () {
		const graph = createPlannerAcquisitionGraph(config);
		const initialRuntime = yield* createPlannerInitialRuntimeFx(config);
		const strategies = {
			bestFirst: createBestFirstPlannerStrategy({
				config,
				graph,
			}),
			constructive: createConstructivePlannerStrategy({
				config,
				graph,
			}),
		};
		return {
			estimateFx: Effect.fn("Planner.estimateFx")((request) =>
				runPlannerStrategyPlanFx({
					graph,
					initialRuntime,
					request,
					strategies,
				}),
			),
			graph,
			initialRuntime,
			strategies,
		} satisfies Planner;
	}),
);
