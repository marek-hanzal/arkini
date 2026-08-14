import { Effect } from "effect";

import type {
	BestFirstPlannerStrategy,
	BestFirstPlannerStrategyResult,
} from "~/editor/planner/BestFirstPlannerStrategy";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import {
	DefaultPlannerSearchBudget,
	type PlannerSearchBudget,
	type PlannerSearchResult,
} from "~/editor/planner/PlannerSearch";
import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { searchPlannerRuntimeFx } from "~/editor/planner/searchPlannerRuntimeFx";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const projectBestFirstResult = (result: PlannerSearchResult): BestFirstPlannerStrategyResult => {
	const metrics = {
		expandedNodes: result.type === "no-finite-path" ? 0 : result.expandedStates,
		frontierSize: result.type === "inconclusive" ? result.frontierSize : 0,
		traceLength:
			result.type === "completed"
				? result.trace.length
				: result.type === "inconclusive"
					? result.trace.length
					: 0,
		visitedNodes: result.type === "no-finite-path" ? 0 : result.visitedStates,
	};
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
				metrics,
				strategyId: PlannerStrategyId.bestFirst,
				type: "completed",
			};
		case "no-finite-path":
			return {
				diagnostics: result.diagnostics,
				metrics,
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
				metrics,
				reason: result.reason,
				strategyId: PlannerStrategyId.bestFirst,
				type: "inconclusive",
				unsupportedActionIds: result.unsupportedActionIds,
			};
	}
};

/** Adapts the established global runtime search to the common strategy contract. */
export const createBestFirstPlannerStrategy = ({
	budget: configuredBudget,
	config,
	graph,
}: {
	readonly budget?: Partial<PlannerSearchBudget>;
	readonly config: GameConfigSchema.Type;
	readonly graph: PlannerAcquisitionGraph;
}): BestFirstPlannerStrategy => ({
	defaultBudget: {
		...DefaultPlannerSearchBudget,
		...configuredBudget,
	},
	id: PlannerStrategyId.bestFirst,
	runFx: Effect.fn("BestFirstPlannerStrategy.runFx")((problem, budget) =>
		searchPlannerRuntimeFx({
			budget: {
				...DefaultPlannerSearchBudget,
				...configuredBudget,
				...budget,
			},
			graph,
			itemId: problem.activeGoal.itemId,
			quantity: problem.activeGoal.quantity,
			runtime: problem.runtime,
		}).pipe(Effect.provideService(GameConfigFx, config), Effect.map(projectBestFirstResult)),
	),
});
