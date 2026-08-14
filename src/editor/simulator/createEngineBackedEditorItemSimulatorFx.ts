import { Effect } from "effect";

import type { PlannerBudgetLimits } from "~/editor/planner/PlannerBudget";
import type { PlannerGoalSearchBudget } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { createGoalDirectedPlannerStrategy } from "~/editor/planner/createGoalDirectedPlannerStrategy";
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

export const EditorItemPlannerGoalSearchBudget: PlannerGoalSearchBudget = {
	maximumAgendaDepth: 256,
	maximumConcurrentBranches: 4,
	maximumExpandedBranches: 256,
	maximumQueuedBranches: 256,
	maximumTraceLength: 500,
};

export const EditorItemPlannerSessionBudget: PlannerBudgetLimits = {
	maximumDelegationDepth: 64,
	maximumEngineTransitions: 100_000,
	maximumStrategyInvocations: 10_000,
};

export interface EditorItemPlannerBudget {
	readonly bestFirst?: Partial<PlannerSearchBudget>;
	readonly constructive?: Partial<PlannerGoalSearchBudget>;
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

/** Creates the editor estimate facade over one reusable adaptive engine-backed planner. */
export const createEngineBackedEditorItemSimulatorFx = Effect.fn(
	"createEngineBackedEditorItemSimulatorFx",
)((config: GameConfigSchema.Type) =>
	Effect.gen(function* () {
		const graph = createPlannerAcquisitionGraph(config);
		const createPlannerForBudgetFx = (budget: EditorItemPlannerBudget) =>
			createPlannerFx({
				budget: {
					...EditorItemPlannerSessionBudget,
					...budget.session,
				},
				config,
				strategy: createGoalDirectedPlannerStrategy({
					constructiveBudget: {
						...EditorItemPlannerGoalSearchBudget,
						...budget.constructive,
					},
					delegatedBestFirstBudget: {
						...EditorItemPlannerSearchBudget,
						...budget.bestFirst,
					},
				}),
			});
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
