import { Effect } from "effect";

import type { PlannerBudgetLimits } from "~/editor/planner/PlannerBudget";
import type { PlannerGoalSearchBudget } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerProducerExpansionBudget } from "~/editor/planner/PlannerProducerExpansion";
import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import {
	DefaultEditorPlannerBestFirstBudget,
	DefaultEditorPlannerConstructiveBudget,
	DefaultEditorPlannerProducerExpansionBudget,
	createEditorPlannerStrategyFx,
} from "~/editor/planner/createEditorPlannerStrategyFx";
import { createPlannerAcquisitionGraphFx } from "~/editor/planner/createPlannerAcquisitionGraphFx";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import { projectPlannerResult } from "~/editor/simulator/projectPlannerResult";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export const EditorItemPlannerSearchBudget: PlannerSearchBudget = {
	...DefaultEditorPlannerBestFirstBudget,
};

export const EditorItemPlannerGoalSearchBudget: PlannerGoalSearchBudget = {
	...DefaultEditorPlannerConstructiveBudget,
};

export const EditorItemPlannerProducerExpansionBudget: PlannerProducerExpansionBudget = {
	...DefaultEditorPlannerProducerExpansionBudget,
};

export const EditorItemPlannerSessionBudget: PlannerBudgetLimits = {
	maximumDelegationDepth: 64,
	maximumEngineTransitions: 100_000,
	maximumStrategyInvocations: 10_000,
};

export interface EditorItemPlannerBudget {
	readonly bestFirst?: Partial<PlannerSearchBudget>;
	readonly constructive?: Partial<PlannerGoalSearchBudget>;
	readonly producerExpansion?: Partial<PlannerProducerExpansionBudget>;
	readonly session?: Partial<PlannerBudgetLimits>;
}

export namespace createEngineBackedEditorItemSimulatorFx {
	export interface Service {
		readonly simulateFx: (
			itemId: string,
			quantity?: number,
			budget?: EditorItemPlannerBudget,
		) => Effect.Effect<EditorItemSimulation>;
	}
}

/** Creates the editor estimate facade over one reusable resilient engine-backed planner. */
export const createEngineBackedEditorItemSimulatorFx = Effect.fn(
	"createEngineBackedEditorItemSimulatorFx",
)((config: GameConfigSchema.Type) =>
	Effect.gen(function* () {
		const graph = yield* createPlannerAcquisitionGraphFx(config);
		const createPlannerForBudgetFx = Effect.fn("createPlannerForBudgetFx")(
			(budget: EditorItemPlannerBudget) =>
				Effect.gen(function* () {
					const strategy = yield* createEditorPlannerStrategyFx({
						constructiveBudget: {
							...EditorItemPlannerGoalSearchBudget,
							...budget.constructive,
						},
						bestFirstBudget: {
							...EditorItemPlannerSearchBudget,
							...budget.bestFirst,
						},
						producerExpansionBudget: {
							...EditorItemPlannerProducerExpansionBudget,
							...budget.producerExpansion,
						},
					});
					return yield* createPlannerFx({
						budget: {
							...EditorItemPlannerSessionBudget,
							...budget.session,
						},
						config,
						strategy,
					});
				}),
		);
		const defaultPlanner = yield* createPlannerForBudgetFx({});
		return {
			simulateFx: Effect.fn("EngineBackedEditorItemSimulator.simulateFx")(
				(itemId: string, quantity = 1, budget?: EditorItemPlannerBudget) =>
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
