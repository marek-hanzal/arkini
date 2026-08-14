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
		const createPlannerForBudgetFx = (budget: Partial<PlannerSearchBudget>) =>
			createPlannerFx({
				config,
				strategy: createBestFirstPlannerStrategy({
					budget: {
						...EditorItemPlannerSearchBudget,
						...budget,
					},
				}),
			});
		const defaultPlanner = yield* createPlannerForBudgetFx({});
		return {
			simulateFx: Effect.fn("EngineBackedEditorItemSimulator.simulateFx")(
				(itemId: string, quantity = 1, budget?: Partial<PlannerSearchBudget>) =>
					Effect.gen(function* () {
						const planner =
							budget === undefined
								? defaultPlanner
								: yield* createPlannerForBudgetFx(budget).pipe(Effect.orDie);
						const result = yield* planner.estimateFx({
							itemId,
							quantity,
						});
						return projectPlannerResult({
							config,
							graph,
							result,
						});
					}),
			),
		} satisfies createEngineBackedEditorItemSimulatorFx.Service;
	}),
);
