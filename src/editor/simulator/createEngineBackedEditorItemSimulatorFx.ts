import { Effect } from "effect";

import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { createBestFirstPlannerStrategy } from "~/editor/planner/createBestFirstPlannerStrategy";
import { createPlannerAcquisitionGraph } from "~/editor/planner/createPlannerAcquisitionGraph";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import { projectPlannerResult } from "~/editor/simulator/projectPlannerResult";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export const EditorItemPlannerSearchBudget: PlannerSearchBudget = {
	maximumExpandedStates: 1_000,
	maximumQueuedStates: 16,
	maximumRoutePlans: 16,
	maximumTraceLength: 500,
};

export namespace createEngineBackedEditorItemSimulatorFx {
	export interface Service {
		readonly simulateFx: (
			itemId: string,
			quantity?: number,
			budget?: Partial<PlannerSearchBudget>,
		) => Effect.Effect<EditorItemSimulation>;
	}
}

/** Creates the editor estimate facade over one reusable engine-backed planner. */
export const createEngineBackedEditorItemSimulatorFx = Effect.fn(
	"createEngineBackedEditorItemSimulatorFx",
)((config: GameConfigSchema.Type) =>
	Effect.gen(function* () {
		const graph = createPlannerAcquisitionGraph(config);
		const planner = yield* createPlannerFx({
			config,
			createStrategy: ({ config: strategyConfig, graph: strategyGraph }) =>
				createBestFirstPlannerStrategy({
					budget: EditorItemPlannerSearchBudget,
					config: strategyConfig,
					graph: strategyGraph,
				}),
		});
		return {
			simulateFx: Effect.fn("EngineBackedEditorItemSimulator.simulateFx")(
				(itemId: string, quantity = 1, budget?: Partial<PlannerSearchBudget>) =>
					planner
						.estimateFx({
							budget,
							itemId,
							quantity,
						})
						.pipe(
							Effect.map((result) =>
								projectPlannerResult({
									config,
									graph,
									result,
								}),
							),
						),
			),
		} satisfies createEngineBackedEditorItemSimulatorFx.Service;
	}),
);
