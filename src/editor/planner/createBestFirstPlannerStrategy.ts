import { Effect } from "effect";

import type {
	BestFirstPlannerStrategy,
	BestFirstPlannerStrategyResult,
} from "~/editor/planner/BestFirstPlannerStrategy";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import {
	DefaultPlannerSearchBudget,
	type PlannerSearchResult,
} from "~/editor/planner/PlannerSearch";
import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { searchPlannerRuntimeFx } from "~/editor/planner/searchPlannerRuntimeFx";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const projectBestFirstResult = (result: PlannerSearchResult): BestFirstPlannerStrategyResult => {
	switch (result.type) {
		case "completed":
			return {
				availableQuantity: result.availableQuantity,
				diagnostics: result.diagnostics,
				execution: {
					elapsedMs: result.elapsedMs,
					outputCertainty: result.outputCertainty,
					runtime: result.runtime,
					selectedWitnessProbability: result.selectedWitnessProbability,
					trace: result.trace,
				},
				strategyId: PlannerStrategyId.bestFirst,
				type: "completed",
			};
		case "no-finite-path":
			return {
				diagnostics: result.diagnostics,
				proof: result.proof,
				strategyId: PlannerStrategyId.bestFirst,
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
				strategyId: PlannerStrategyId.bestFirst,
				type: "inconclusive",
				unsupportedActionIds: result.unsupportedActionIds,
			};
	}
};

/** Adapts the established global runtime search to the common planner strategy contract. */
export const createBestFirstPlannerStrategy = ({
	config,
	graph,
}: {
	readonly config: GameConfigSchema.Type;
	readonly graph: PlannerAcquisitionGraph;
}): BestFirstPlannerStrategy => {
	const searchFx: BestFirstPlannerStrategy["searchFx"] = Effect.fn(
		"BestFirstPlannerStrategy.searchFx",
	)((request, budget) =>
		searchPlannerRuntimeFx({
			budget,
			graph,
			itemId: request.goal.itemId,
			quantity: request.goal.quantity,
			runtime: request.runtime,
		}).pipe(Effect.provideService(GameConfigFx, config)),
	);
	return {
		defaultBudget: DefaultPlannerSearchBudget,
		id: PlannerStrategyId.bestFirst,
		runFx: Effect.fn("BestFirstPlannerStrategy.runFx")((request, budget) =>
			searchFx(request, budget).pipe(Effect.map(projectBestFirstResult)),
		),
		searchFx,
	};
};
