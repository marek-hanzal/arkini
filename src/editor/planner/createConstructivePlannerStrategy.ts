import { Effect } from "effect";

import type {
	ConstructivePlannerStrategy,
	ConstructivePlannerStrategyResult,
} from "~/editor/planner/ConstructivePlannerStrategy";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import {
	DefaultPlannerGoalSearchBudget,
	type PlannerGoalSearchResult,
} from "~/editor/planner/PlannerGoalSearch";
import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { searchPlannerGoalFx } from "~/editor/planner/searchPlannerGoalFx";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const projectConstructiveResult = (
	result: PlannerGoalSearchResult,
): ConstructivePlannerStrategyResult => {
	switch (result.type) {
		case "completed":
			return {
				availableQuantity: result.availableQuantity,
				diagnostics: result.diagnostics,
				execution: result.execution,
				strategyId: PlannerStrategyId.constructive,
				type: "completed",
			};
		case "no-finite-path":
			return {
				diagnostics: result.diagnostics,
				proof: result.proof,
				strategyId: PlannerStrategyId.constructive,
				type: "no-finite-path",
			};
		case "inconclusive":
			return {
				bestAvailableQuantity: result.bestAvailableQuantity,
				blockedActionIds: result.blockedActionIds,
				...(result.budgetLimit === undefined
					? {}
					: {
							budgetLimit: result.budgetLimit,
						}),
				diagnostics: result.diagnostics,
				frontierSize: result.frontierSize,
				reason: result.reason,
				strategyId: PlannerStrategyId.constructive,
				type: "inconclusive",
				unsupportedActionIds: result.unsupportedActionIds,
			};
	}
};

/** Adapts constructive goal-stack search to the common planner strategy contract. */
export const createConstructivePlannerStrategy = ({
	config,
	graph,
}: {
	readonly config: GameConfigSchema.Type;
	readonly graph: PlannerAcquisitionGraph;
}): ConstructivePlannerStrategy => {
	const searchFx: ConstructivePlannerStrategy["searchFx"] = Effect.fn(
		"ConstructivePlannerStrategy.searchFx",
	)((request, budget) =>
		searchPlannerGoalFx({
			budget,
			graph,
			itemId: request.goal.itemId,
			quantity: request.goal.quantity,
			runtime: request.runtime,
		}).pipe(Effect.provideService(GameConfigFx, config)),
	);
	return {
		defaultBudget: DefaultPlannerGoalSearchBudget,
		id: PlannerStrategyId.constructive,
		runFx: Effect.fn("ConstructivePlannerStrategy.runFx")((request, budget) =>
			searchFx(request, budget).pipe(Effect.map(projectConstructiveResult)),
		),
		searchFx,
	};
};
