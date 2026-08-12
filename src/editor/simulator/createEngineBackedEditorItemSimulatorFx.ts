import { Effect } from "effect";

import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { createEnginePlannerFx } from "~/editor/planner/createEnginePlannerFx";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import { projectPlannerSearchResult } from "~/editor/simulator/projectPlannerSearchResult";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export const EditorItemPlannerSearchBudget: PlannerSearchBudget = {
	maximumExpandedStates: 1_000,
	maximumQueuedStates: 16,
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
		const planner = yield* createEnginePlannerFx(config);
		return {
			simulateFx: Effect.fn("EngineBackedEditorItemSimulator.simulateFx")(
				(itemId: string, quantity = 1, budget?: Partial<PlannerSearchBudget>) =>
					planner
						.searchFx(itemId, quantity, {
							...EditorItemPlannerSearchBudget,
							...budget,
						})
						.pipe(
							Effect.map((result) =>
								projectPlannerSearchResult({
									config,
									graph: planner.graph,
									result,
								}),
							),
						),
			),
		} satisfies createEngineBackedEditorItemSimulatorFx.Service;
	}),
);
